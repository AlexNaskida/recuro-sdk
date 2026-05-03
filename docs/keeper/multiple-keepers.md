# Multiple Keepers

Run multiple keepers for redundancy and increased payment throughput.

## Why multiple keepers

- **Uptime insurance**: If one keeper goes down, another continues.
- **Throughput**: Distribute payment load across multiple servers.
- **Regional latency**: Place keepers in different regions for lower RPC latency.
- **Keeper diversity**: Reduce trust in any single keeper operator.

## Architecture

Multiple independent keepers watch the same on-chain state and **race** to execute payments.
The first one to land the transaction wins. The others back off silently.

**Key principle: No consensus required** - keepers operate completely independently. They don't communicate with each other or coordinate actions. The blockchain itself prevents double-charging through atomic state updates.

| Keeper   | Region       | Role                        |
| -------- | ------------ | --------------------------- |
| Keeper 1 | US East      | Primary - polls every 60s   |
| Keeper 2 | EU West      | Backup - polls every 60s    |
| Keeper 3 | Asia Pacific | Optional - extra redundancy |

The result is always the same regardless of which keeper fires:
`nextPaymentAt` advances by one interval and the cycle repeats.

## How subscription discovery works

Keepers **dynamically discover** all due subscriptions on every poll - they do NOT hardcode addresses.

**Discovery process:**

```javascript
// Fetch ALL subscription accounts from the program
const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
  filters: [{ dataSize: 173 }], // Subscription account size
});

// Filter for subscriptions that are:
// 1. Status = Active
// 2. Trial period expired
// 3. nextPaymentAt <= current_time

const dueSubscriptions = rawAccounts.filter(
  (sub) => sub.status === "Active" && sub.nextPaymentAt <= Date.now() / 1000,
);
```

**Security advantages:**

- ✅ Keepers can't manipulate which subscriptions are processed
- ✅ No need to register or hardcode subscription addresses
- ✅ New subscriptions are automatically discovered
- ✅ Expired/cancelled subscriptions are automatically skipped

## How double-charging is prevented

All keepers race to execute the same subscription. The first one succeeds; the others fail silently.

**On-chain atomic check:**

```rust
// In execute_payment instruction
require!(
    subscription.next_payment_at <= clock.unix_timestamp,
    SubscriptionError::NotDueYet
);

// Transfer USDC (plan amount + fee) from subscriber to merchant + treasury
// ... token transfer logic ...

// Update state atomically - this prevents double-charging
subscription.last_paid_at = clock.unix_timestamp;
subscription.next_payment_at += subscription.interval_seconds;
subscription.cycles_remaining -= 1;
```

**Why this prevents double-charging:**

- State updates are atomic on Solana
- Once `next_payment_at` is updated, the subscription is no longer "due"
- Second keeper attempting the same payment sees `next_payment_at > current_time` and skips it
- No consensus, voting, or coordination needed between keepers

## Handling missed subscriptions

Keepers automatically catch and process **missed subscriptions** - subscriptions where the payment time has passed but hasn't been executed yet.

**How it works:**

```javascript
const now = Math.floor(Date.now() / 1000);

// Fetch all subscriptions where next_payment_at <= current time
const dueSubscriptions = allSubscriptions.filter(
  (sub) => sub.nextPaymentAt <= now,
);

// This includes:
// - Payments due right now
// - Payments that were due 1 hour ago (missed)
// - Payments that were due 1 day ago (very missed)
```

**Example scenario:**

1. Subscription is due at 12:00 PM
2. All keepers are offline from 12:00 PM - 2:00 PM
3. Keeper comes back online at 2:05 PM
4. Keeper polls and finds subscription is 2 hours overdue
5. Keeper executes payment immediately
6. Subscription next_payment_at advances to 1 month from original 12:00 PM date

**Recovery guarantees:**

- ✅ No payments are ever skipped or lost
- ✅ Keepers catch up on all missed payments when they come back online
- ✅ Payment schedule stays on the original billing cycle (doesn't drift)
- ✅ Subscribers are charged for the correct number of cycles

## Keeper Incentivization (Live)

**Status: Active and live on devnet** ✅

Keepers earn rewards for successfully executing subscription payments through a 60/40 fee split.

### How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    Payment Execution Flow                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Keeper detects due subscription                          │
│  2. Keeper provides their USDC ATA in the transaction        │
│  3. Keeper calls executePayment()                            │
│  4. On-chain program verifies:                               │
│     - Subscription is active                                 │
│     - Payment is actually due (nextPaymentAt <= now)         │
│     - Subscriber has sufficient USDC balance                 │
│     - Keeper's ATA is owned by keeper signer                 │
│  5. If valid → Payment executes + Fee split happens:         │
│     - 60% of fee → Keeper's wallet                           │
│     - 40% of fee → Protocol treasury                         │
│  6. If invalid → Transaction fails, no reward paid           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Reward Structure

| Component            | Details                                               |
| -------------------- | ----------------------------------------------------- |
| **Keeper reward**    | 60% of payment fee                                    |
| **Treasury cut**     | 40% of payment fee                                    |
| **Source**           | Deducted from total subscriber fee (not extra burden) |
| **Distribution**     | Instant, same transaction as payment                  |
| **Winner selection** | First valid execution wins (race-based)               |

### Keeper Account Security

**Keeper Identity Verification:**

- Keeper is the **signer** of the transaction (their keypair signs it)
- Keeper provides their own **USDC token account** (ATA) to receive rewards
- On-chain constraint verifies: `keeper_token_account.owner == keeper.key()`
- This prevents a malicious keeper from trying to send rewards to a different wallet

### Security Considerations

- **Spam prevention**: Rewards only paid for valid executions that actually transfer funds
- **No fake subscriptions**: Can't create fake subscriptions to farm rewards (requires real USDC flow)
- **Rate limiting**: Natural rate limit - can only execute each subscription once per billing cycle
- **Sybil resistance**: Running multiple keepers doesn't increase rewards (same payment, same reward)
- **Account verification**: Keeper rewards go only to the wallet that signed the transaction

### Economics Example

**Monthly subscription ($100):**

```
Fee rate:        0.25% (25 basis points)
Total fee:       $0.25
  ├─ Keeper:     $0.15 (60%)
  └─ Treasury:   $0.10 (40%)

Gas cost:        ~$0.0006 SOL (~0.02 cents)
Keeper profit:   $0.15 - $0.0006 = ~$0.149 per payment
```

**Annual volume (1000 subscriptions):**

```
Total keeper earnings: $0.15 × 1000 = $150/month = $1,800/year
```

### Running a Keeper Now

Keepers can start earning immediately by:

1. Running the keeper bot
2. Providing their USDC ATA on each `executePayment()` call
3. Receiving 60% of fees directly to their wallet

See [Running Your Own Keeper](./running-your-own.md) to get started.

## Setting up multiple keepers

### Local multi-threaded

```typescript
// Run N keeper threads in the same process
import { spawnKeeper } from "@recuro/sdk/keeper";

Promise.all([
  spawnKeeper({ pollIntervalMs: 30000 }),
  spawnKeeper({ pollIntervalMs: 30000 }),
  spawnKeeper({ pollIntervalMs: 30000 }),
]);
```

### Distributed (recommended)

**Keeper 1: US East**

```bash
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com (us-east)
KEEPER_KEYPAIR_PATH=/path/to/keypair
```

**Keeper 2: Europe**

```bash
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://api.main.eu.rpc.solana.com
KEEPER_KEYPAIR_PATH=/path/to/keypair
```

**Keeper 3: Asia**

```bash
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://rpc.jp.solanafm.com
KEEPER_KEYPAIR_PATH=/path/to/keypair
```

All three run independently with the same keypair and code. They race to execute payments.

## Monitoring multiple keepers

```typescript
// Central dashboard: query stats from each keeper

const stats = Promise.all([
  fetch("http://keeper-1:9090/stats").then((r) => r.json()),
  fetch("http://keeper-2:9090/stats").then((r) => r.json()),
  fetch("http://keeper-3:9090/stats").then((r) => r.json()),
]);

// Alert if any keeper offline > 5 minutes
stats.forEach((k) => {
  if (k.lastPoll > Date.now() - 300000) {
    alert(`Keeper ${k.id} is offline`);
  }
});
```

## Cost analysis (multiple keepers)

| Keepers | Throughput | Gas Cost  | Notes                                       |
| ------- | ---------- | --------- | ------------------------------------------- |
| 1       | 100 tx/day | $0.10/day | Single point of failure                     |
| 2       | 150 tx/day | $0.15/day | 50% chance first keeper fails, 2nd executes |
| 3       | 200 tx/day | $0.20/day | Very low failure probability                |

Since transactions are idempotent, extra keepers don't waste gas-failed attempts (when another keeper executed first) cost nothing.

## Recommended setup (production)

1. **Primary keeper** - High-traffic region (US)
2. **Backup keeper** - Different region (EU)
3. **Health monitoring** - Alert if primary offline > 5 min
4. **Shared keypair** - Both keepers use same key (can be rotated)
5. **Rotation policy** - Cycle keypair every 90 days as security best practice

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
