# resumeSubscription()

Resume a paused subscription.

## Overview

Resumes a paused subscription where it left off. The SPL delegate approval remains active, so no new approval is needed-just one transaction to restart.

## Parameters

| Parameter            | Type      | Required | Description                         |
| -------------------- | --------- | -------- | ----------------------------------- |
| `subscriptionPubkey` | PublicKey | ✓        | Address of your paused subscription |

## Returns

```typescript
Promise<string>; // Transaction signature
```

## Example

```typescript
const signature = await sdk.resumeSubscription(subscriptionPubkey);

console.log("✓ Subscription resumed:", signature);
console.log("  Payments will restart on schedule");
```

## What happens

- Subscription status returns to **"Active"**
- Keeper resumes attempting payments on schedule
- **Next payment time is recalculated** from the current time
- Delegate approval **remains valid** (no new signature needed from you)
- Trial period **resumes** from where it was paused

## When to use

- **Resume after pause** - You paused temporarily and now want to continue
- **Simple state management** - Pause/resume for testing or temporary suspension
- **No re-approval needed** - Faster than cancelling and re-subscribing

## Example: Pause for a month, then resume

```typescript
// Day 0: Subscribe
const { subscriptionPubkey } = await sdk.createSubscription({ planPubkey });

// Day 15: Oops, need to pause
await sdk.pauseSubscription(subscriptionPubkey);
console.log("Payments paused for 1 month");

// Day 45: Ready to resume
const resumeSignature = await sdk.resumeSubscription(subscriptionPubkey);
console.log("✓ Payments resumed:", resumeSignature);

// Next payment will execute 30 days from day 45 (not from original day 15)
```

## Error handling

```typescript
try {
  const signature = await sdk.resumeSubscription(subscriptionPubkey);
} catch (error) {
  if (error.message.includes("Subscription not found")) {
    console.error("Subscription address is invalid");
  } else if (error.message.includes("not paused")) {
    console.error("Subscription is already active");
  } else if (error.message.includes("insufficient balance")) {
    console.error("Wallet needs USDC and SOL for fees");
  } else {
    console.error("Resume failed:", error.message);
  }
}
```

## Verify resumption

After resuming, check the subscription to confirm:

```typescript
const sub = await sdk.fetchSubscription(subscriptionPubkey);

console.log({
  status: sub.status, // Should be "Active"
  nextPaymentAt: new Date(sub.nextPaymentAt.toNumber() * 1000),
  amountUsdc: sub.amountUsdc.toNumber() / 1e6,
});
```

## Next steps

- [Pause a Subscription](./pause-subscription.md) - Temporarily stop payments
- [Cancel a Subscription](./cancel-subscription.md) - Permanently end subscription
- [View Your Subscriptions](./fetch-methods.md) - Check subscription status

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
