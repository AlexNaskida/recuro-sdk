# Security: How Funds Are Protected

Recuro enforces payment safety with a Guard-program layer between keepers and token transfers.

## Layer 1: Guard PDA as delegate

Subscribers approve a per-subscription **Guard PDA** as SPL delegate. The keeper never receives spending authority.

**Protection**: spend authority is isolated to a PDA tied to one subscription.

## Layer 2: Immutable transfer parameters in Guard

At subscription creation, Recuro CPI-calls Guard `initialize_guard` and stores:

- `subscription`
- `subscriber`
- `merchant_receive`
- `recuro_program`
- `amount_per_period`
- `period_seconds`

Callers cannot override these at payment time.

**Protection**: payment amount, destination, and billing cadence are locked in Guard state.

## Layer 3: Guard authorization checks on every payment

Recuro `execute_payment` CPI-calls Guard `authorize_payment`. Guard enforces:

- caller must equal stored `recuro_program`
- current time must be >= `last_executed_at + period_seconds`
- destination ATA must equal `merchant_receive`
- transfer amount is always Guard `amount_per_period`

**Protection**: blocks unauthorized callers, early charges, wrong destination, and caller-supplied amounts.

## Layer 4: Open keeper caller model

Any keeper may call `execute_payment`, but keepers only trigger the flow; Guard and subscription constraints decide whether funds can move.

**Protection**: no single keeper bottleneck, while transfer safety remains on-chain.

## Layer 5: Fee path separation

Guard transfers merchant principal amount. Subscription program separately transfers protocol fee to treasury after Guard succeeds.

**Protection**: merchant payout path is guarded independently from protocol fee bookkeeping.

## Layer 6: Auto-expiry and failure handling

If balance/delegate conditions fail repeatedly, failed count increments and auto-expiry triggers after threshold.

**Protection**: prevents indefinite retries on broken subscriptions and keeps state consistent.

## Recovery steps

If a subscriber wants to stop future payments immediately:

1. Revoke token delegate approval in wallet.
2. Cancel subscription on-chain.

This halts future Guard-authorized transfers.

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
