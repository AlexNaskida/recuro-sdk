# Detect a failed payment

Notify a subscriber when their payment fails so they can top up before auto-expiry.

## Listen via the SDK

```typescript
const id = sdk.onPaymentFailed((event, slot, signature) => {
  if (event.subscription.equals(mySubscriptionPubkey)) {
    notifyUser({
      reason: event.reason,
      consecutiveFailures: event.consecutiveFailures,
      txUrl: solscanTxUrl(signature, "devnet"),
    });
  }
});

// On unmount
await sdk.removeEventListener(id);
```

## Or read it from the subscription account

If you can't keep a long-lived listener (e.g. a serverless cron):

```typescript
const sub = await sdk.fetchSubscription(subscriptionPubkey);

if (sub.consecutiveFailures > 0) {
  // Last attempt failed — but we have grace period before auto-expire
  const failsLeft = 3 - sub.consecutiveFailures;
  return {
    state: "at_risk",
    failsLeft,
    lastFailedAt: sub.lastFailedAt.toNumber(),
  };
}
```

## Common failure reasons

| `event.reason`      | What it means                                      | What the user should do                    |
| ------------------- | -------------------------------------------------- | ------------------------------------------ |
| `InsufficientFunds` | USDC ATA balance < amount.                         | Top up USDC, then wait for the next retry. |
| `DelegateRevoked`   | User revoked the SPL approval.                     | Re-create the subscription.                |
| `Other`             | Misc failure (mint mismatch, ATA closed, etc.).    | Check transaction logs.                    |

## Auto-expiry warning

After **3 consecutive failures**, the subscription auto-expires. Surface a warning UI starting at `consecutiveFailures === 1` so the user has a chance to recover.

```tsx
{sub.consecutiveFailures > 0 && (
  <Alert variant="warning">
    Last payment failed. {3 - sub.consecutiveFailures} attempts remain
    before this subscription expires.
  </Alert>
)}
```
