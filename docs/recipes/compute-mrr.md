# Compute MRR from on-chain accounts

Calculate Monthly Recurring Revenue (MRR) without `getAnalytics()` — useful when you want a custom slice (e.g. MRR for a single plan, MRR by cohort).

## Definition

MRR = sum, across all *active* subscriptions, of the monthly-equivalent revenue from each.

A subscription billed every `intervalSeconds` at `amountUsdc` contributes:

```
monthly_equivalent = amountUsdc * (30 days / intervalDays)
```

So a $9.99 monthly plan contributes $9.99. A $99 yearly plan contributes ~$8.25/month. A $1 weekly plan contributes ~$4.30/month.

## Implementation

```typescript
import { microToUsdc } from "@recuro/sdk";

async function computeMrr(merchantPubkey: PublicKey): Promise<number> {
  const plans = await sdk.fetchMerchantPlans(merchantPubkey);

  let mrr = 0;
  for (const plan of plans) {
    if (plan.status === "Archived") continue; // archived plans still earn

    const subs = await sdk.fetchPlanSubscriptions(plan.publicKey);
    const active = subs.filter((s) => s.status === "Active");
    const intervalDays = plan.intervalSeconds.toNumber() / 86_400;

    const amountUsdc = microToUsdc(plan.amountUsdc);
    const monthlyEquiv = amountUsdc * (30 / intervalDays);

    mrr += active.length * monthlyEquiv;
  }

  return mrr;
}

const mrr = await computeMrr(merchantPubkey);
console.log(`MRR: $${mrr.toFixed(2)}`);
```

## Variations

### MRR for a single plan

```typescript
const subs = await sdk.fetchPlanSubscriptions(planPubkey);
const active = subs.filter((s) => s.status === "Active").length;
const monthlyEquiv = (plan.amountUsdc.toNumber() / 1e6) * (30 / intervalDays);
const planMrr = active * monthlyEquiv;
```

### MRR excluding paused subscriptions
Already done above (`status === "Active"` only). Paused don't bill.

### ARR (Annual Recurring Revenue)

```typescript
const arr = mrr * 12;
```

### MRR delta this month

```typescript
const newSubs = subs.filter((s) =>
  s.startedAt.toNumber() * 1000 > Date.now() - 30 * 86_400_000
);
const churnedSubs = subs.filter((s) =>
  (s.status === "Cancelled" || s.status === "Expired") &&
  s.endedAt.toNumber() * 1000 > Date.now() - 30 * 86_400_000
);

const newMrr = newSubs.length * monthlyEquiv;
const churnedMrr = churnedSubs.length * monthlyEquiv;
const netNewMrr = newMrr - churnedMrr;
```

## Or just use `getAnalytics()`

The SDK ships `sdk.getAnalytics(merchantPubkey)` which returns precomputed MRR plus time-series. Roll your own only if you need custom slicing. See the [Analytics page](../sdk-reference/analytics.md).
