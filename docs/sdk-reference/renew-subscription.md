# renewSubscription()

Renew an expired subscription for another billing cycle.

## Overview

When a subscription expires (due to 3 consecutive payment failures or merchant cancellation), a subscriber can renew it to resume automatic payments. Renewal creates a new Subscription PDA with a fresh payment schedule.

## Parameters

| Parameter    | Type      | Required | Description                                |
| ------------ | --------- | -------- | ------------------------------------------ |
| `planPubkey` | PublicKey | ✓        | Address of the Plan PDA to resubscribe to. |

## Returns

```typescript
interface CreateSubscriptionResult {
  subscriptionPubkey: PublicKey; // New Subscription PDA address
  signature: string; // Transaction signature
}
```

## Example

```typescript
const { subscriptionPubkey, signature } = await sdk.renewSubscription({
  planPubkey: new PublicKey("..."),
});

console.log("Renewed:", subscriptionPubkey.toBase58());
```

## When to use

- **After auto-expiry** - 3 payment failures triggered auto-expiry; user wants to resume.
- **After cancellation** - Subscriber wants to re-enable same plan.
- **Plan upgrade** - Create a new subscription to a different (higher-tier) plan.

## What happens

1. A **new Subscription PDA** is created (different address than the original).
2. Trial period (if any) is applied again.
3. SPL delegate approval is requested again in Phantom.
4. Keeper resumes making scheduled payments on the new subscription.

## Difference from cancellation

| Action                 | Result                                      | Reversible                       |
| ---------------------- | ------------------------------------------- | -------------------------------- |
| `cancelSubscription()` | Stops payments; keeps same subscription PDA | N/A (new subscription via renew) |
| `renewSubscription()`  | Creates new subscription; restarts payments | Yes (can cancel again)           |
| Auto-expiry            | Stops payments after 3 failures             | Yes (renew)                      |

## Example: renewal flow

```typescript
// Check if subscription expired
const subscription = await sdk.fetchSubscription(subscriptionPubkey);

if (subscription.status === "Expired") {
  // Show "Reactivate" button to subscriber
  const handleReactivate = async () => {
    const { subscriptionPubkey: newSubPubkey } = await sdk.renewSubscription({
      planPubkey: subscription.plan,
    });
    console.log("New subscription:", newSubPubkey.toBase58());
  };
}
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
