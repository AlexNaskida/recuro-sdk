# pauseSubscription()

Temporarily pause an active subscription without cancelling it.

## Overview

Pauses a subscription, stopping automatic payments. The SPL delegate approval remains active, so you can resume at any time without re-approving. Trial period also pauses.

## Parameters

| Parameter            | Type      | Required | Description                           |
| -------------------- | --------- | -------- | ------------------------------------- |
| `subscriptionPubkey` | PublicKey | ✓        | Address of your subscription to pause |

## Returns

```typescript
Promise<string>; // Transaction signature
```

## Example

```typescript
const signature = await sdk.pauseSubscription(subscriptionPubkey);

console.log("✓ Subscription paused:", signature);
console.log("  Payments will not execute until you resume");
```

## What happens

- Subscription status becomes **"Paused"**
- Keeper stops attempting payments
- Delegate approval **remains active** (no new approval needed to resume)
- Trial period **pauses** as well
- You can resume anytime with `resumeSubscription()`

## When to use

- **Temporarily stop payments** - You need a break but plan to continue
- **Avoid cancellation fees** - Some plans may charge for cancellation, but pause is free
- **Budget tight** - Pause for a month, resume when ready
- **Try before committing** - Pause during trial to check if you'll like the service

## Comparison with Cancel

| Operation        | Paused | Cancelled            |
| ---------------- | ------ | -------------------- |
| Payments stop    | ✓      | ✓                    |
| Delegate remains | ✓      | ❌ Revoked           |
| Can resume       | ✓      | ❌ Must re-subscribe |
| Future exposure  | ✓      | ✓ Zero               |

## Error handling

```typescript
try {
  const signature = await sdk.pauseSubscription(subscriptionPubkey);
} catch (error) {
  if (error.message.includes("Subscription not found")) {
    console.error("Subscription address is invalid");
  } else if (error.message.includes("is not active")) {
    console.error("Already paused or cancelled");
  } else {
    console.error("Pause failed:", error.message);
  }
}
```

## Next steps

- [Cancel a Subscription](./cancel-subscription.md) - Permanently end subscription
- [Resume a Subscription](./resume-subscription.md) - Restart payments
- [View Your Subscriptions](./fetch-methods.md) - Check subscription status

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
