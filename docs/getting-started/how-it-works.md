# How It Works

## Subscriber Journey

| Step             | What Happens                               | Your Control |
| ---------------- | ------------------------------------------ | ------------ |
| 1. Discover Plan | Browse available plans from a merchant     | You choose   |
| 2. Subscribe     | Approve SPL delegate in Phantom (one-time) | You sign     |
| 3. Trial Period  | Free access (if plan includes trial)       | Automatic    |
| 4. First Payment | Keeper executes automatic payment on-chain | Automatic    |
| 5. Recurring     | Payment repeats every X days               | Automatic    |
| 6. Manage        | Pause, Resume, or Cancel anytime           | You control  |
| 7. Cancel        | Delegate revoked, zero future exposure     | One click    |

## What the SPL delegate approval means

When you subscribe, Phantom shows:

```
⚠️ Request to Approve Token Delegate

Recuro Subscription Program requests permission to transfer from your
account.

Token: USDC
Delegate: [Subscription PDA]
Amount: 9.99
Authorized signer: [Your wallet]

[Approve] [Reject]
```

### Why it's safe

- **Limited to plan amount** — Delegate cannot transfer more than the plan price per cycle
- **Bounded exposure** — If compromised, max loss is one billing cycle
- **Revokable anytime** — You can revoke it from Phantom instantly
- **One approval, all payments** — No re-approval needed each month

## Payment execution

1. **Keeper monitors** your subscription on-chain
2. **Waits for next_payment_time** (respects trial period)
3. **Checks conditions**:
   - Does delegate approval exist?
   - Is USDC balance sufficient?
   - Is three consecutive failures NOT reached?
4. **Executes transfer** if all conditions pass:
   - Reads plan amount (locked, cannot change)
   - Transfers USDC from your wallet to merchant
   - Updates next_payment_time += interval
5. **On failure**:
   - Low balance? Increments failure counter
   - Delegate revoked? Increments failure counter
   - 3 failures in a row? Subscription auto-expires, rent returned

## Your subscription lifecycle

### Active

- Payments execute on schedule
- Trial period (if any) reduces next payment time
- **Actions**: Pause, Resume, Cancel

### Paused

- Payments stop temporarily
- Delegate approval remains active
- **Actions**: Resume (continue from where it left off), Cancel

### Cancelled

- Subscription is terminated
- **Delegate is immediately revoked** — No future payments possible
- **Irreversible** — Must subscribe again to restart
- Rent may be returned to your wallet

### Expired

- After 12 billing cycles without renewal
- Delegate approval has expired
- **Actions**: Renew (re-approve delegate for 12 more cycles)

## Why the keeper model works

The keeper is **stateless**—it's just a process that:

- Polls subscriptions on-chain
- Checks if next_payment_time has arrived
- Calls `executePayment()` instruction
- Repeats forever

**Key advantages:**

- Any keeper can do this (no centralization)
- Multiple keepers can coexist without conflict
- If one keeper goes down, others continue
- Rewards funded by protocol, not deducted from you
- You benefit from redundancy

## Fund safety guarantees

| What Could Happen         | Your Protection                                                |
| ------------------------- | -------------------------------------------------------------- |
| Merchant gets hacked      | Funds never in merchant wallet until transfer                  |
| Keeper gets hacked        | Keeper can't change amounts or direction—all enforced on-chain |
| Delegate compromised      | Only plan amount per cycle, not your full balance              |
| Delegate approval revoked | You can revoke anytime; zero future exposure                   |
| USDC token bug            | Not Recuro's responsibility; same as any USDC holder           |

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)

```

```
