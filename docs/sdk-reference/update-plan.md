# updatePlan()

Update metadata and settings of an existing plan.

> **Note**: This is a plan management method. Most merchants handle plan administration through admin dashboards rather than the SDK. See [Merchant Overview](../for-merchants/overview.md) for recommended architecture.

## Overview

Allows merchants to update certain plan properties without affecting existing subscriptions. Changes apply immediately but do not retroactively modify active subscriptions.

## Method Signature

```typescript
async updatePlan(params: UpdatePlanParams): Promise<TransactionSignature>
```

## Parameters

| Parameter                | Type                  | Required | Description                          |
| ------------------------ | --------------------- | -------- | ------------------------------------ |
| `planPubkey`             | `PublicKey`           | Yes      | Address of the plan to update        |
| `name`                   | `string`              | No       | New plan name (max 64 chars)         |
| `description`            | `string`              | No       | New plan description (max 256 chars) |
| `maxSubscribers`         | `number`              | No       | New subscriber limit (0 = unlimited) |
| `merchantReceiveAddress` | `PublicKey \| string` | No       | New address for receiving payments   |

## What Can Be Updated

| Field           | Updatable | Notes                                   |
| --------------- | --------- | --------------------------------------- |
| Name            | Yes       | Display name only, no effect on billing |
| Description     | Yes       | For display purposes                    |
| Max Subscribers | Yes       | Can increase or decrease                |
| Receive Address | Yes       | Changes where future payments go        |
| **Price**       | **No**    | Immutable - protects subscribers        |
| **Interval**    | **No**    | Immutable - protects subscribers        |

## Example

```typescript
import { SubscriptionSdk } from "@recuro/sdk";

const sdk = new SubscriptionSdk(provider);

// Update plan name and description
const signature = await sdk.updatePlan({
  planPubkey: new PublicKey("..."),
  name: "Pro Plus Monthly",
  description: "Our best plan with all features included",
});

console.log("Plan updated:", signature);
```

### Update Receive Address

```typescript
// Change where payments are sent
await sdk.updatePlan({
  planPubkey: planAddress,
  merchantReceiveAddress: new PublicKey("NEW_RECEIVE_ADDRESS"),
});
```

### Update Subscriber Limit

```typescript
// Limit plan to 100 subscribers
await sdk.updatePlan({
  planPubkey: planAddress,
  maxSubscribers: 100,
});

// Remove limit (unlimited)
await sdk.updatePlan({
  planPubkey: planAddress,
  maxSubscribers: 0,
});
```

## Errors

| Error              | Cause                             |
| ------------------ | --------------------------------- |
| `Plan not found`   | Invalid `planPubkey`              |
| `Unauthorized`     | Caller is not the plan's merchant |
| `Plan is archived` | Cannot update archived plans      |

## Security

- Only the original merchant (plan creator) can update the plan
- Price and interval immutability protects subscribers from surprise changes
- Receive address changes affect future payments only, not pending ones

## Related

- [createPlan()](./create-plan.md) - Create a new plan
- [archivePlan()](./archive-plan.md) - Stop accepting new subscribers

---

> Questions? [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
