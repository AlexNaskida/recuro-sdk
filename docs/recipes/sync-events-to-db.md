# Sync on-chain events to your database

Mirror Recuro's on-chain state into Postgres / Mongo / whatever you already have, so dashboards stay snappy and your business logic doesn't depend on RPC liveness.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Solana RPC │────►│ SDK listener │────►│  Your DB       │
│  (logs)     │  ws │  (Node.js)   │     │  (subscriptions│
└─────────────┘     └──────────────┘     │   table)       │
                                         └────────────────┘
```

Run a small Node service that holds open WebSocket subscriptions for each event you care about, and writes to your DB on each fire.

## Minimal listener service

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";
import { db } from "./db";

const connection = new Connection(process.env.RPC_URL!, "confirmed");
const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {});
const sdk = new SubscriptionSdk(provider, { cluster: "mainnet-beta" });

sdk.onSubscriptionCreated(async (event, slot, signature) => {
  await db.subscriptions.upsert({
    pubkey: event.subscription.toBase58(),
    plan: event.plan.toBase58(),
    subscriber: event.subscriber.toBase58(),
    status: "Active",
    created_slot: slot,
    created_tx: signature,
  });
});

sdk.onPaymentExecuted(async (event, slot, signature) => {
  await db.payments.insert({
    subscription: event.subscription.toBase58(),
    gross_micro: event.grossAmount.toString(),
    fee_micro: event.feesCharged.toString(),
    net_micro: event.netAmount.toString(),
    slot,
    signature,
    timestamp: new Date(),
  });
});

sdk.onPaymentFailed(async (event, slot, signature) => {
  await db.failures.insert({
    subscription: event.subscription.toBase58(),
    reason: event.reason,
    consecutive: event.consecutiveFailures,
    slot,
    signature,
  });
});

sdk.onSubscriptionCancelled(async (event) => {
  await db.subscriptions.update(
    { pubkey: event.subscription.toBase58() },
    { status: "Cancelled", ended_at: new Date() },
  );
});

sdk.onSubscriptionExpired(async (event) => {
  await db.subscriptions.update(
    { pubkey: event.subscription.toBase58() },
    { status: "Expired", ended_at: new Date() },
  );
});

console.log("Listening…");
```

## Don't trust WebSockets alone

WebSocket connections drop. Reconnects can lose a frame. For audit-grade sync, also run a periodic reconcile:

```typescript
import cron from "node-cron";

cron.schedule("*/5 * * * *", async () => {
  // Last 5 minutes worth of program signatures
  const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 1000 });

  for (const sig of sigs) {
    const known = await db.payments.findOne({ signature: sig.signature });
    if (known) continue;

    // Replay the tx logs and reconstruct the event
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
    });
    // … parse logs, write to DB
  }
});
```

## Backfill historical data

For the initial load, walk `getSignaturesForAddress` backward in pages of 1000 until you reach genesis.

```typescript
let before: string | undefined;
while (true) {
  const page = await connection.getSignaturesForAddress(PROGRAM_ID, {
    limit: 1000,
    before,
  });
  if (page.length === 0) break;
  for (const s of page) await ingest(s.signature);
  before = page[page.length - 1].signature;
}
```

## What to store

Recommended schema (Postgres):

```sql
CREATE TABLE subscriptions (
  pubkey TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  subscriber TEXT NOT NULL,
  status TEXT NOT NULL,
  created_slot BIGINT,
  created_tx TEXT,
  ended_at TIMESTAMP
);

CREATE TABLE payments (
  signature TEXT PRIMARY KEY,
  subscription TEXT NOT NULL REFERENCES subscriptions(pubkey),
  gross_micro NUMERIC(20) NOT NULL,
  fee_micro NUMERIC(20) NOT NULL,
  net_micro NUMERIC(20) NOT NULL,
  slot BIGINT,
  timestamp TIMESTAMPTZ
);

CREATE INDEX idx_payments_sub ON payments (subscription);
CREATE INDEX idx_subscriptions_subscriber ON subscriptions (subscriber);
```

Now your dashboards query Postgres in milliseconds instead of waiting on RPC.
