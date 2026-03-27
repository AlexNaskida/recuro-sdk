# unarchivePlan()

Reactivate an archived plan to accept new subscriptions again.

> **Note**: This is a plan management method. Most merchants handle plan administration through admin dashboards rather than the SDK. See [Merchant Overview](../for-merchants/overview.md) for recommended architecture.

## Overview

Unarchiving reverses the archive operation:

- **Restores** the plan to "Active" status
- **Allows** new subscriptions to be created
- **Does not affect** existing subscriptions (they continue as normal)

## Method Signature

```typescript
async unarchivePlan(planPubkey: PublicKey): Promise<TransactionSignature>
```

## Parameters

| Parameter    | Type        | Required | Description                      |
| ------------ | ----------- | -------- | -------------------------------- |
| `planPubkey` | `PublicKey` | Yes      | Address of the plan to unarchive |

## Example

```typescript
import { SubscriptionSdk } from "@recuro/sdk";

const sdk = new SubscriptionSdk(provider);

// Reactivate an archived plan
const signature = await sdk.unarchivePlan(new PublicKey("PLAN_ADDRESS_HERE"));

console.log("Plan reactivated:", signature);
```

## Use Cases

### Seasonal Reactivation

```typescript
// Reactivate a seasonal plan
const summerPlan = new PublicKey("...");

if (isSummerSeason()) {
  await sdk.unarchivePlan(summerPlan);
  console.log("Summer plan is now accepting subscriptions!");
}
```

### Mistake Recovery

```typescript
// Accidentally archived? Undo it
try {
  await sdk.unarchivePlan(planAddress);
  console.log("Plan restored successfully");
} catch (error) {
  console.error("Failed to unarchive:", error.message);
}
```

## Errors

| Error               | Cause                             |
| ------------------- | --------------------------------- |
| `Plan not found`    | Invalid `planPubkey`              |
| `Unauthorized`      | Caller is not the plan's merchant |
| `Plan not archived` | Plan is already active            |

## Related

- [archivePlan()](./archive-plan.md) - Archive a plan
- [deletePlan()](./delete-plan.md) - Permanently delete a plan
- [createPlan()](./create-plan.md) - Create a new plan

---

> Questions? [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
