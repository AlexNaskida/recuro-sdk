# Security: How Funds Are Protected

Recuro uses multiple defense layers to protect subscriber funds.

## Layer 1: Price immutability

Once a plan is deployed, the price and interval are **frozen forever** in the Plan PDA. Merchants cannot unilaterally change them.

**Protection**: Subscribers know exactly what they're paying. No surprise increases mid-subscription.

## Layer 2: Scoped SPL delegate

Instead of giving the keeper direct custody of subscriber funds, subscribers approve a **scoped SPL delegate**. The delegate can transfer only:

- The exact plan amount
- Once per billing cycle
- From subscriber's USDC ATA to merchant's USDC ATA

**Example permission:**

```
SPL Delegate:
  Source: [Subscriber USDC ATA]
  Delegated signer: [Subscription PDA]
  Amount: 9.99 USDC
  Auth: subscriber's signature
```

**Protection**:

- If the Subscription PDA is compromised, blast radius is one payment (9.99 USDC).
- Subscriber can revoke in Phantom at any time.
- Cannot steal more than approved per cycle.

## Layer 3: On-chain amount verification

The `executePayment` instruction checks plan amount on-chain and enforces it in a CPIs (Cross-Program Invocation).

```rust
// On-chain, in execute_payment instruction
let plan = account_loader::<Plan>(ctx, &subscription.plan)?;

// Verify amount matches
require_eq!(subscription.amountUsdc, plan.amountUsdc,
    error!("SubscriptionAmountMismatch"));

// CPI to SPL token program
token::transfer(ctx, plan.amountUsdc)?;
```

**Protection**: Program cannot deviate from immutable plan price. Math is enforced at runtime.

## Layer 4: Keeper address non-hardcoding

The keeper address is **not hardcoded** in the program. Any account can call `executePayment()`.

**Why this is secure**:

- Prevents keeper DoS (hacker cannot block one keeper)
- Enables redundancy (multiple keepers competing to execute)
- Reduces trust in single operator

**Tradeoff**: Keeper could theoretically be censored if a single operator dominates. Mitigation: run your own keeper or contract with multiple keeper providers.

## Layer 5: Subscription PDA as SPL delegate

The SPL delegate is not the keeper keypair; it's the Subscription PDA account itself.

**Why this matters**:

- Subscription cannot exist without valid program derivation
- Prevents cross-subscription attacks
- Ensures 1:1 mapping of subscription → delegate approval

## Layer 6: Auto-expiry on repeated failures

After 3 consecutive payment failures, the subscription auto-expires and subscriber rent is returned.

**Protection**: Dead subscriptions don't become stuck zombie accounts draining merchant reputation or becoming targets for replay attacks.

## Layer 7: Delegate revoke recovery

If a delegate is compromised, subscriber can:

1. Revoke SPL approval in Phantom
2. Manually cancel subscription
3. Resubscribe to a new plan with fresh approval

**Recovery time**: < 1 minute. No customer service needed.

## Keeper cannot steal funds

Even if a keeper keypair is compromised:

1. Keeper can only call `executePayment()` (no other instructions)
2. `executePayment()` is constrained to exactly plan amount
3. Amount is checked against immutable Plan account
4. Transfer destination is subscription-linked merchant address

**Worst case**: Keeper can execute _scheduled_ payments on time, not unscheduled ones. It cannot:

- Transfer more than plan amount
- Transfer to arbitrary address
- Execute before scheduled time
- Execute after cancellation

---

## Auditing tips

**For merchants**:

- Review your Plan PDA for correct amount and interval
- Verify merchant receive address is under your control
- Monitor payment events for anomalies

**For subscribers**:

- Approve SPL delegates only for plans you recognize
- Revoke approval if you're unsure
- Check your subscription status regularly

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
