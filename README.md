# @recuro/sdk

Non-custodial recurring USDC subscription protocol on Solana.

## What is Recuro?

Recuro enables merchants to accept automated recurring USDC payments
without ever taking custody of subscriber funds. Subscribers approve
a limited SPL delegate — funds stay in their wallet until payment time.

## Install
```bash
yarn add @recuro/sdk
```

## Quick Start
```ts
import { SubscriptionSdk } from "@recuro/sdk";
import { AnchorProvider } from "@coral-xyz/anchor";

const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });

// Merchant: create a plan
const { planPubkey } = await sdk.createPlan({
  name: "Pro Plan",
  amountUsdc: 29.99,
  intervalDays: 30,
});

// Subscriber: subscribe to a plan
const { subscriptionPubkey } = await sdk.createSubscription({ planPubkey });

// Subscriber: cancel any time
await sdk.cancelSubscription(subscriptionPubkey);
```

## How it works

1. Merchant creates a **Plan PDA** — price is locked forever, merchant cannot change it after subscribers join
2. Subscriber approves an **SPL delegate** — funds stay in their wallet
3. An off-chain **keeper** watches `next_payment_at` on-chain
4. Keeper calls `execute_payment` — program validates timing, transfers funds
5. **0.25% protocol fee** taken on top, merchant always receives full advertised price

## Security model

- Funds never leave subscriber wallet until payment time
- SPL delegate cap = maximum possible exposure per subscriber
- Keeper cannot change amounts, redirect funds, or double charge
- Cancel = immediate delegate revoke, zero future exposure
- Program validates all accounts from on-chain state

## Key features

- `createPlan` / `updatePlan` / `archivePlan`
- `createSubscription` / `cancelSubscription` / `renewSubscription`
- `pauseSubscription` / `resumeSubscription`
- `fetchPlan` / `fetchMerchantPlans` / `fetchSubscriberSubscriptions`
- `getAnalytics` — aggregated on-chain merchant analytics
- Event listeners for real-time payment tracking

## License

MIT
