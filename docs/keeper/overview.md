# Keeper Overview

## What is the keeper

The keeper is a **stateless, permissionless bot** that executes on-chain subscription payments on schedule. It runs 24/7 and watches for subscriptions whose `nextPaymentAt` has arrived, then calls `executePayment()` to transfer USDC from subscriber to merchant.

The keeper is **not** a centralized service-it's an open-source script that anyone can run.

## Why the keeper exists

Solana blockchain cannot schedule transactions automatically. Without the keeper, payments would never happen unless a merchant manually triggered them-and that defeats the purpose of automation.

The keeper solves this by:

- Polling subscriptions on-chain
- Detecting when next_payment_time has passed
- Calling the on-chain instruction to transfer funds
- Handling gas costs (reimbursed from protocol treasury)

## Who should run it

- **Merchants** - Run your own keeper to ensure 100% uptime for your subscribers
- **Keeper networks** - Professional operators running keepers as a service
- **Redundancy** - Run multiple keepers for insurance against downtime

## How it works

```
Loop every 30 seconds:
  1. Fetch all subscriptions
  2. Filter: nextPaymentAt <= now
  3. For each subscription:
     - Verify delegate approval is active
     - Call executePayment() on-chain
     - Log result (success or failure)
```

## Keeper authority

The keeper signs transactions with its own keypair. It does **NOT** need access to subscriber or merchant private keys. The blockchain enforces that:

- Only the plan amount can be transferred (immutable on-chain)
- Only to the merchant's designated receive address
- Only if delegate approval is active

## Cost and rewards

### Current Model (v1)

| Item             | Details                                                  |
| ---------------- | -------------------------------------------------------- |
| **Gas cost**     | ~0.001 SOL per payment (~$0.0002 at current prices)      |
| **Rewards**      | None in v1 - keepers operate without on-chain incentives |
| **Who pays gas** | Keeper pays, not reimbursed                              |

### Who Should Run a Keeper (v1)

- **Merchants**: Run your own keeper to ensure your subscriptions always execute on time
- **Protocol supporters**: Help the network by running altruistic keepers
- **Developers**: Test integrations and understand the payment flow

### Future Incentivization (v2 Roadmap)

On-chain keeper rewards are planned for v2, where keepers will earn a small fee for each successful payment execution:

- **Reward**: ~0.1% of payment amount or fixed minimum
- **Source**: Protocol treasury (not deducted from merchants/subscribers)
- **Distribution**: Race-based - first valid execution wins

See [Multiple Keepers](./multiple-keepers.md#keeper-incentivization-future-roadmap) for full details on the incentivization roadmap.

## Reliability

- **No single point of failure**: Multiple keepers can run simultaneously without coordination
- **Idempotent**: If two keepers execute the same subscription, the second fails gracefully (blockchain prevents double-charging)
- **Offline tolerance**: If keeper goes down, payments are delayed until it restarts
- **Auto-recovery**: After keeper comes back online, it automatically catches up on all missed payments
- **Missed payment handling**: Subscriptions overdue by hours or days are automatically detected and processed on next poll

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
