# How it Works

## Architecture overview

| Traditional SaaS          | Recuro                                        |
| ------------------------- | --------------------------------------------- |
| Merchant holds your card  | Funds stay in your wallet                     |
| Cancel requires merchant  | Cancel revokes on-chain instantly             |
| Price can change any time | Price locked at subscribe time                |
| Single point of failure   | Any keeper can process payments - no downtime |
| Single point of failure   | Any keeper can process payments               |

## What happens when a subscriber subscribes

1. **Merchant creates a plan** with fixed price, interval, and trial period.
   - Price is **immutable** in the Plan PDA.
   - Cannot be changed without a new plan.

2. **Subscriber approves SPL delegate**.
   - Solves: "Did you sign this? I don't remember."
   - Limited to plan amount per cycle (e.g., 9.99 USDC for 30 days).
   - Can be revoked from any Phantom wallet at any time = instant opt-out.

3. **Subscription PDA is created** linking Plan + Subscriber + amounts + next payment time.
   - Trial period delay is respected (payment_time = now + trial_seconds).
   - Once created, only the subscriber can cancel; merchant cannot force expiry.

4. **Keeper detects new subscription** and waits for next payment time.
   - Any keeper can execute, or multiple keepers for redundancy.
   - Gas is paid by keeper; rewards come from protocol treasury.

5. **Keeper calls `execute_payment()`** after next_payment_time.
   - Checks Plan PDA for amount (immutable).
   - Checks delegate approval on subscriber's token account.
   - Transfers USDC: subscriber → merchant.
   - On-chain, atomically enforced. Can never transfer wrong amount.

6. **Payment succeeds or fails**.
   - **Success**: next_payment_time += interval_seconds
   - **Failure** (low balance, revoked delegate, etc.): failure counter increments
   - **3 failures in a row**: Subscription auto-expires, subscriber rent returned

## Why the SPL delegate is safe

The SPL token program allows "delegate approval"-each source account can approve one delegated signer to transfer up to an amount. Recuro uses this instead of giving the program direct custody.

- **Subscriber keeps control**: Can revoke the delegate from Phantom in one click.
- **Bounded exposure**: Delegate is limited to plan amount per cycle, not total balance.
- **No private keys**: Merchant never holds subscriber keys; keeper doesn't either.
- **Composable**: Subscriber can still use their wallet for other transactions.

## Why the keeper model works

The keeper is **stateless**-it just polls subscriptions and calls an on-chain instruction. No database, no private keys, no magic.

- Any keeper can run it (open source).
- Multiple keepers can coexist without collision (last one wins; payment is idempotent by next_payment_time check).
- If a keeper goes down, another picks up the slack with no downtime.
- Rewards are funded by protocol treasury, not deducted from subscribers.

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)

```

```
