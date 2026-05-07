# Charge a subscriber immediately (off-cycle)

Sometimes a merchant wants to charge a subscriber outside the normal billing cycle - e.g. a one-time add-on, a usage overage, or a manual catch-up after a fix.

> **Important**: this still goes through Guard. The amount is the plan amount; you can't override it. For variable charges, use a separate one-shot transfer flow, not Recuro.

## When `chargeNow` is appropriate

- Recovering after a payment failure: subscriber topped up; you want the next payment to fire now instead of waiting for the keeper.
- Migrating from another provider: collect a partial-period charge upon migration.
- Manual operations: testing, one-off resyncs.

## Usage

```typescript
const signature = await sdk.chargeNow({ subscriptionPubkey });
console.log("Charged off-cycle:", signature);
```

This calls the program's `charge_now` instruction, which routes through Guard exactly like a keeper-triggered payment - Guard still enforces every constraint.

## Caveats

- Only the **merchant** or the **subscriber themselves** can call this; arbitrary keepers can't.
- The amount is fixed at the plan amount. No partial charges.
- Subsequent automated payments still follow the original interval - `nextPaymentAt` advances by `intervalSeconds` from the charge-now timestamp.

## React example

```tsx
async function handleManualCharge() {
  try {
    const sig = await sdk.chargeNow({ subscriptionPubkey });
    toast.success(`Charged: ${shortenPubkey(sig)}`);
    await refresh();
  } catch (err) {
    if (err instanceof Error && err.message.includes("PaymentNotDue")) {
      toast.error("Already paid this period.");
    } else {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  }
}
```

## What if I need variable amounts?

Recuro is purpose-built for **fixed-price recurring billing**. For variable charges (usage-based, metered, prorated), do a normal SPL token transfer outside Recuro and record it in your own ledger. Keep Recuro for the recurring portion.
