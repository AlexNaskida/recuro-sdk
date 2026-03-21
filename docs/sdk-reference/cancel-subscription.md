# cancelSubscription()

Cancel a subscription and prevent future payments.

## Overview

Cancels an active or paused subscription. Once cancelled, no further payments will be charged. SPL delegate approval remains in place (subscriber can manually revoke in Phantom), but Keeper will skip this subscription on future execution cycles.

## Parameters

| Parameter            | Type      | Required | Description                                |
| -------------------- | --------- | -------- | ------------------------------------------ |
| `subscriptionPubkey` | PublicKey | ✓        | Address of the Subscription PDA to cancel. |

## Returns

```typescript
interface TxResult {
  signature: string; // Transaction signature
}
```

## Example

```typescript
const { signature } = await sdk.cancelSubscription(subscriptionPubkey);
console.log("Cancelled:", signature);
```

## Who can cancel

- **Subscriber** - Can cancel their own subscription at any time.
- **Merchant** - Can cancel a subscriber's plan (e.g., to revoke access or terminate account).
- **Anyone with subscriber's ATA write permission** - Usually just the subscriber.

## What happens after cancellation

1. Subscription status changes from `Active` to `Cancelled`.
2. Keeper stops executing payments.
3. SPL delegate remains (must be manually revoked to remove approval).
4. Subscriber can resubscribe to the same plan anytime.

## Revoking the delegate (optional)

After cancellation, the subscriber should revoke the SPL delegate approval in Phantom to fully disconnect:

1. Open Phantom → Settings → Approve & Connect
2. Find "Recuro Subscription Program"
3. Click "Revoke"

Cancelling the subscription is sufficient to stop future charges, but revoking the delegate ensures zero approval remains.

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
