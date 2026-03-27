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

## Keeper Incentivization (Future Roadmap)

**Current status (v1):** Keepers are **permissionless and unrewarded**. Anyone can run a keeper, but there's no on-chain incentive beyond:

- Merchants ensuring their own subscription payments execute reliably
- Protocol supporters running keepers altruistically
- Developers testing or building on the platform

### Planned v2: On-Chain Keeper Rewards

The planned incentivization model will reward keepers for successfully executing valid subscription payments.

#### How It Will Work

```
┌──────────────────────────────────────────────────────────────┐
│                    Payment Execution Flow                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Keeper detects due subscription                          │
│  2. Keeper calls executePayment()                            │
│  3. On-chain program verifies:                               │
│     - Subscription is active                                 │
│     - Payment is actually due (nextPaymentAt <= now)         │
│     - Subscriber has sufficient USDC balance                 │
│  4. If valid → Payment executes + Keeper receives reward     │
│  5. If invalid → Transaction fails, no reward paid           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Reward Structure (Proposed)

| Component            | Details                                                   |
| -------------------- | --------------------------------------------------------- |
| **Reward amount**    | 0.1% of payment OR fixed 0.01 USDC (whichever is greater) |
| **Source**           | Protocol treasury (not deducted from merchant/subscriber) |
| **Distribution**     | Instant, same transaction as payment                      |
| **Winner selection** | First valid execution wins (race-based)                   |

#### Security Considerations

- **Spam prevention**: Rewards only paid for valid executions that actually transfer funds
- **No fake subscriptions**: Can't create fake subscriptions to farm rewards (requires real USDC flow)
- **Rate limiting**: Natural rate limit - can only execute each subscription once per billing cycle
- **Sybil resistance**: Running multiple keepers doesn't increase rewards (same payment, same reward)

#### Why Not Included in v1

1. **Simplicity**: Keeps the protocol auditable and easy to understand
2. **Bootstrapping**: Allows organic growth before adding financial incentives
3. **Volume threshold**: Incentives make sense when there's sufficient payment volume
4. **Community feedback**: Gathering input on optimal reward structure

#### Timeline

Keeper incentivization will be introduced once:

- Protocol reaches meaningful subscription volume
- Community consensus on reward structure is achieved
- Smart contract is audited with incentive logic

**Want to run a keeper now?** Merchants are encouraged to run their own keepers for guaranteed payment reliability. See [Running Your Own Keeper](./running-your-own.md).

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
