# Multiple Keepers

Run multiple keepers for redundancy and increased payment throughput.

## Why multiple keepers

- **Uptime insurance**: If one keeper goes down, another continues.
- **Throughput**: Distribute payment load across multiple servers.
- **Regional latency**: Place keepers in different regions for lower RPC latency.
- **Keeper diversity**: Reduce trust in any single keeper operator.

## Architecture

Three independent keepers watch the same on-chain state and race to execute payments.
The first one to land the transaction wins. The others back off silently.

| Keeper   | Region       | Role                         |
| -------- | ------------ | ---------------------------- |
| Keeper 1 | US East      | Primary - polls every hour   |
| Keeper 2 | EU West      | Backup - polls every 2 hours |
| Keeper 3 | Asia Pacific | Optional - extra redunda`ncy |

The result is always the same regardless of which keeper fires:
`nextPaymentAt` advances by one interval and the cycle repeats.

## How double-charging is prevented

All keepers race to execute the same subscription. The first one succeeds; the others fail silently.

**On-chain check:**

```rust
// In execute_payment instruction
if subscription.lastPaymentAt >= subscription.nextPaymentAt {
    return Err(error!("PaymentAlreadyExecuted"));
}

// After successful transfer:
subscription.lastPaymentAt = clock.unix_timestamp;
subscription.nextPaymentAt += subscription.intervalSeconds;
```

Since this is atomic on-chain, only one keeper can win. The others see `lastPaymentAt` is already set and back off gracefully.

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
