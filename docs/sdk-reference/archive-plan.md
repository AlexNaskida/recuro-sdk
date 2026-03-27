# archivePlan()

Archive a plan to stop accepting new subscriptions.

> **Note**: This is a plan management method. Most merchants handle plan administration through admin dashboards rather than the SDK. See [Merchant Overview](../for-merchants/overview.md) for recommended architecture.

## Overview

Archiving a plan:

- **Stops** new subscriptions from being created
- **Preserves** all existing subscriptions (they continue billing normally)
- **Cannot be undone** - once archived, always archived

Use this to retire old plans while honoring commitments to existing subscribers.

## Method Signature

```typescript
async archivePlan(planPubkey: PublicKey): Promise<TransactionSignature>
```

## Parameters

| Parameter    | Type        | Required | Description                    |
| ------------ | ----------- | -------- | ------------------------------ |
| `planPubkey` | `PublicKey` | Yes      | Address of the plan to archive |

## Example

```typescript
import { SubscriptionSdk } from "@recuro/sdk";

const sdk = new SubscriptionSdk(provider);

// Archive an old plan
const signature = await sdk.archivePlan(new PublicKey("PLAN_ADDRESS_HERE"));

console.log("Plan archived:", signature);
```

## Behavior After Archiving

| Action                          | Allowed? |
| ------------------------------- | -------- |
| New subscriptions               | No       |
| Existing subscriptions continue | Yes      |
| Payments execute                | Yes      |
| Subscribers can cancel          | Yes      |
| Subscribers can pause/resume    | Yes      |
| Update plan metadata            | No       |

## Use Cases

### Retiring an Old Pricing Tier

```typescript
// 1. Create new plan with updated pricing
const { planPubkey: newPlan } = await sdk.createPlan({
  planId: Date.now(),
  name: "Pro Monthly v2",
  amountUsdc: 34.99,
  intervalDays: 30,
});

// 2. Archive old plan
await sdk.archivePlan(oldPlanAddress);

// Existing v1 subscribers continue at their locked price
// New subscribers can only join v2
```

### Limited-Time Offer

```typescript
// After promotion ends, archive the discounted plan
const promoEndDate = new Date("2024-12-31");

if (new Date() > promoEndDate) {
  await sdk.archivePlan(promoPlanAddress);
}
```

## Errors

| Error                   | Cause                             |
| ----------------------- | --------------------------------- |
| `Plan not found`        | Invalid `planPubkey`              |
| `Unauthorized`          | Caller is not the plan's merchant |
| `Plan already archived` | Plan was previously archived      |

## Important Notes

1. **Irreversible**: Archiving cannot be undone. Create a new plan if you need similar functionality.

2. **Existing subscribers unaffected**: All active subscriptions continue to work normally with their original pricing.

3. **Revenue continues**: The keeper will still execute payments for archived plans.

4. **Plan data preserved**: All plan data remains on-chain and queryable.

## Related

- [createPlan()](./create-plan.md) - Create a new plan
- [updatePlan()](./update-plan.md) - Modify plan metadata
- [Fetch Methods](./fetch-methods.md) - Query plans and subscriptions

---

> Questions? [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
