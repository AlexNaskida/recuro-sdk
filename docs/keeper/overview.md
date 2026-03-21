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

- **Gas cost**: ~0.001 SOL per payment (varies by network congestion)
- **Rewards**: Protocol treasury reimburses keeper for gas
- **Net cost to merchant**: 0 (rewards cover gas; merchant pays protocol fee embedded in transaction)

## Reliability

- **No single point of failure**: Multiple keepers can run simultaneously
- **Idempotent**: If two keepers execute the same subscription, the second fails gracefully (already paid at that time)
- **Offline tolerance**: If keeper goes down, payments are simply delayed until it restarts
- **Auto-recovery**: After recovery, keeper catches up without backlog

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
