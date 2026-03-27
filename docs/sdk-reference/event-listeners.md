# Event Listeners

Listen to subscription events in real-time as they happen on-chain.

## Available Events

| Method                      | Triggered When                               |
| --------------------------- | -------------------------------------------- |
| `onPaymentExecuted()`       | Payment successfully transferred to merchant |
| `onPaymentFailed()`         | Payment attempt failed (low balance, etc.)   |
| `onSubscriptionCreated()`   | New subscription created                     |
| `onSubscriptionCancelled()` | Subscription manually cancelled              |
| `onSubscriptionPaused()`    | Subscription paused by subscriber            |
| `onSubscriptionResumed()`   | Paused subscription resumed                  |
| `onSubscriptionExpired()`   | Subscription auto-expired after failures     |

## onPaymentExecuted()

Triggered when the keeper successfully transfers USDC from subscriber to merchant.

```typescript
sdk.onPaymentExecuted((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    grossAmount: event.grossAmount.toNumber() / 1e6, // Before fees
    feesCharged: event.feesCharged.toNumber() / 1e6, // Protocol fee
    netAmount: event.netAmount.toNumber() / 1e6, // Received by merchant
    signature,
    slot,
  });
});
```

## onPaymentFailed()

Triggered when a keeper attempts payment but it fails (low balance, revoked delegate, etc.).

```typescript
sdk.onPaymentFailed((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    reason: event.reason, // "InsufficientFunds" | "DelegateRevoked" | "Other"
    consecutiveFailures: event.consecutiveFailures,
    signature,
  });
});
```

## onSubscriptionCreated()

Triggered when a subscriber approves and creates a new subscription.

```typescript
sdk.onSubscriptionCreated((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    plan: event.plan.toBase58(),
    subscriber: event.subscriber.toBase58(),
    signature,
  });
});
```

## onSubscriptionCancelled()

Triggered when a subscription is manually cancelled.

```typescript
sdk.onSubscriptionCancelled((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    cancelledBy: event.cancelledBy.toBase58(),
    signature,
  });
});
```

## onSubscriptionPaused()

Triggered when a subscriber pauses their subscription.

```typescript
sdk.onSubscriptionPaused((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    subscriber: event.subscriber.toBase58(),
    pausedAt: new Date(event.timestamp.toNumber() * 1000),
    signature,
  });
});
```

## onSubscriptionResumed()

Triggered when a subscriber resumes a paused subscription.

```typescript
sdk.onSubscriptionResumed((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    subscriber: event.subscriber.toBase58(),
    resumedAt: new Date(event.timestamp.toNumber() * 1000),
    signature,
  });
});
```

## onSubscriptionExpired()

Triggered when a subscription auto-expires after 3 consecutive payment failures.

```typescript
sdk.onSubscriptionExpired((event, slot, signature) => {
  console.log({
    subscription: event.subscription.toBase58(),
    reason: "MaxConsecutiveFailures",
    signature,
  });
});
```

## Full example: merchant webhook

```typescript
// Listen to all events and POST to your server

sdk.onPaymentExecuted((event, slot) => {
  fetch("/api/webhook/payment-executed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscriptionPubkey: event.subscription.toBase58(),
      netAmount: event.netAmount.toNumber() / 1e6,
      timestamp: new Date().toISOString(),
    }),
  });
});

sdk.onPaymentFailed((event, slot) => {
  fetch("/api/webhook/payment-failed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscriptionPubkey: event.subscription.toBase58(),
      reason: event.reason,
      timestamp: new Date().toISOString(),
    }),
  });
});

sdk.onSubscriptionExpired((event, slot) => {
  fetch("/api/webhook/subscription-expired", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscriptionPubkey: event.subscription.toBase58(),
      timestamp: new Date().toISOString(),
    }),
  });
});
```

## Cleaning up

Stop listening by calling `removeEventListener()`:

```typescript
const listenerId = sdk.onPaymentExecuted((event) => {
  console.log("Payment executed");
});

// Later...
sdk.removeEventListener(listenerId);
```

## Notes

- Events are emitted through Solana's event system and indexed by the SDK.
- Listeners are attached to the WebSocket connection; if the connection drops, listeners stop.
- For production systems, consider using a more robust indexer (e.g., Helius, Magic Eden indexing API).

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
