# deletePlan()

Permanently delete a plan from the blockchain.

> **Note**: This is a plan management method. Most merchants handle plan administration through admin dashboards rather than the SDK. See [Merchant Overview](../for-merchants/overview.md) for recommended architecture.

## Overview

Deleting a plan:

- **Permanently removes** the plan account from the blockchain
- **Returns rent** (~0.002 SOL) to the merchant wallet
- **Cannot be undone** - the plan is gone forever

## Requirements

Before a plan can be deleted:

1. **Must be archived** - Call `archivePlan()` first
2. **No active subscribers** - All subscriptions must be cancelled or expired

## Method Signature

```typescript
async deletePlan(planPubkey: PublicKey): Promise<TransactionSignature>
```

## Parameters

| Parameter    | Type        | Required | Description                   |
| ------------ | ----------- | -------- | ----------------------------- |
| `planPubkey` | `PublicKey` | Yes      | Address of the plan to delete |

## Example

```typescript
import { SubscriptionSdk } from "@recuro/sdk";

const sdk = new SubscriptionSdk(provider);

// Step 1: Archive the plan first
await sdk.archivePlan(planAddress);

// Step 2: Wait for all subscribers to cancel/expire
// (or the delete will fail)

// Step 3: Delete permanently
const signature = await sdk.deletePlan(planAddress);

console.log("Plan deleted:", signature);
```

## Complete Deletion Flow

```typescript
async function safeDeletePlan(sdk: SubscriptionSdk, planPubkey: PublicKey) {
  // Check current state
  const plan = await sdk.fetchPlan(planPubkey);
  if (!plan) throw new Error("Plan not found");

  // Archive if not already
  if (plan.status !== "Archived") {
    console.log("Archiving plan first...");
    await sdk.archivePlan(planPubkey);
  }

  // Check for active subscribers
  const subscriptions = await sdk.fetchPlanSubscriptions(planPubkey);
  const activeCount = subscriptions.filter(
    (s) => s.status === "Active" || s.status === "Paused",
  ).length;

  if (activeCount > 0) {
    throw new Error(
      `Cannot delete: ${activeCount} active subscribers remain. ` +
        `Wait for them to cancel or expire.`,
    );
  }

  // Safe to delete
  const signature = await sdk.deletePlan(planPubkey);
  console.log("Plan permanently deleted:", signature);
  return signature;
}
```

## Errors

| Error                         | Cause                             |
| ----------------------------- | --------------------------------- |
| `Plan not found`              | Invalid `planPubkey`              |
| `Unauthorized`                | Caller is not the plan's merchant |
| `Plan must be archived`       | Archive the plan before deleting  |
| `Plan has active subscribers` | Wait for all subscriptions to end |

## When to Delete vs Archive

| Scenario                         | Recommendation      |
| -------------------------------- | ------------------- |
| Retiring a plan, keeping history | Use `archivePlan()` |
| Removing test/development plans  | Use `deletePlan()`  |
| Cleaning up unused plans         | Use `deletePlan()`  |
| Plan created by mistake          | Use `deletePlan()`  |
| Seasonal plan (may return)       | Use `archivePlan()` |

## Important Notes

1. **Irreversible**: Once deleted, the plan cannot be recovered. All on-chain data is permanently removed.

2. **Rent returned**: The ~0.002 SOL rent from the plan account is returned to the merchant.

3. **Historical data**: If you need to preserve plan history for analytics, archive instead of delete.

4. **Subscriber safety**: The requirement for zero active subscribers ensures no one loses access to a service they're paying for.

## Related

- [archivePlan()](./archive-plan.md) - Archive a plan (reversible)
- [unarchivePlan()](./unarchive-plan.md) - Reactivate an archived plan
- [createPlan()](./create-plan.md) - Create a new plan

---

> Questions? [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
