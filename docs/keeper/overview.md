# Keeper Overview

## What is the keeper

The keeper is a **stateless, permissionless bot** that executes on-chain subscription payments on schedule. It runs 24/7 and watches for subscriptions whose `nextPaymentAt` has arrived, then calls `executePayment()`.

`executePayment()` does not transfer principal directly anymore. It CPI-calls the Guard program, and Guard performs the merchant transfer only if its checks pass.

The keeper is **not** a centralized service-it's an open-source script that anyone can run.

## Why the keeper exists

Solana blockchain cannot schedule transactions automatically. Without the keeper, payments would never happen unless a merchant manually triggered them-and that defeats the purpose of automation.

The keeper solves this by:

- Polling subscriptions on-chain
- Detecting when next_payment_time has passed
- Calling the on-chain instruction that routes through Guard authorization
- Paying transaction fees for submitted transactions

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

- Only Guard-authorized amount can be transferred
- Only to Guard-authorized merchant receive ATA
- Only if Guard period check passes and delegate approval is active

## Cost and rewards

### Current Model (Incentivized)

| Item              | Details                                                   |
| ----------------- | --------------------------------------------------------- |
| **Gas cost**      | ~0.001 SOL per payment (paid by keeper)                   |
| **Keeper reward** | **60% of payment fee** - paid directly to keeper's wallet |
| **Treasury**      | **40% of payment fee** - goes to protocol treasury        |
| **Example**       | On a 0.25% fee: keeper earns 15 bps, treasury gets 10 bps |

### How Keeper Rewards Work

**Fee Split Structure:**

```
Subscriber pays:    plan_amount + fee
  ↓
plan_amount → Merchant (full advertised price)
fee (60%) → Keeper (execution incentive)
fee (40%) → Treasury (protocol revenue)
```

**Example (Monthly Subscription):**

- Subscription amount: $100
- Fee rate: 0.25% (25 basis points)
- Total fee: $0.25
  - Keeper earns: $0.15 (60%)
  - Treasury gets: $0.10 (40%)

### Who Should Run a Keeper

- **Professional operators**: Run keepers as a service and earn transaction fees
- **Merchants**: Run your own keeper to ensure reliable payment execution + earn fees
- **Protocol supporters**: Help the network while earning rewards
- **Developers**: Understand the payment flow and earn fees during testing

## Reliability

- **No single point of failure**: Multiple keepers can run simultaneously without coordination
- **Idempotent**: If two keepers execute the same subscription, the second fails gracefully (blockchain prevents double-charging)
- **Offline tolerance**: If keeper goes down, payments are delayed until it restarts
- **Auto-recovery**: After keeper comes back online, it automatically catches up on all missed payments
- **Missed payment handling**: Subscriptions overdue by hours or days are automatically detected and processed on next poll

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
