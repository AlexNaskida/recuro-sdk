# cancelSubscription()

Cancel a subscription and prevent future payments.

## Overview

Cancels an active or paused subscription. Once cancelled, no further payments will be charged. Delegate approval is revoked immediately and Keeper skips this subscription on future execution cycles.

## Parameters

| Parameter            | Type      | Required | Description                                |
| -------------------- | --------- | -------- | ------------------------------------------ |
| `subscriptionPubkey` | PublicKey | ✓        | Address of the Subscription PDA to cancel. |

## Returns

```typescript
Promise<string>; // Transaction signature
```

## Example

```typescript
const signature = await sdk.cancelSubscription(subscriptionPubkey);
console.log("Cancelled:", signature);
```

## Who can cancel

- **Subscriber** - Can cancel their own subscription at any time.
- **Merchant** - Can cancel a subscriber's plan (e.g., to revoke access or terminate account).
- **Anyone with subscriber's ATA write permission** - Usually just the subscriber.

## What happens after cancellation

1. Subscription status changes from `Active` to `Cancelled`.
2. Keeper stops executing payments.
3. SPL delegate is revoked immediately.
4. Subscriber can resubscribe to the same plan anytime.

## Auto-expiry (different from cancellation)

Subscriptions also auto-expire after **3 consecutive failed payments**. This is automatic and doesn't require calling `cancelSubscription()`:

```typescript
// Check if expired
if (subscription.status === "Expired") {
  console.log("Subscription auto-expired due to payment failures");
}
```

## Error handling

```typescript
try {
  await sdk.cancelSubscription(subscriptionPubkey);
} catch (error) {
  if (error.message.includes("SubscriptionNotFound")) {
    console.error("Subscription does not exist");
  } else if (error.message.includes("Unauthorized")) {
    console.error("Only subscriber or merchant can cancel");
  } else {
    console.error("Cancellation failed:", error.message);
  }
}
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
