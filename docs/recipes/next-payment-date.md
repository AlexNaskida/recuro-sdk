# Show the next payment date

Display the user's upcoming charge in human-readable form.

```typescript
import { formatRelative, formatDateTime } from "@recuro/sdk";

const sub = await sdk.fetchSubscription(subscriptionPubkey);

const next = sub.nextPaymentAt.toNumber(); // unix seconds

console.log(formatDateTime(next));   // "Mar 14, 2026, 10:30 AM"
console.log(formatRelative(next));   // "in 3 days"
```

## React example

```tsx
function NextPayment({ sub }: { sub: SubscriptionAccount }) {
  if (sub.status !== "Active") return null;

  const next = sub.nextPaymentAt.toNumber();
  const inTrial = next > Math.floor(Date.now() / 1000) + sub.intervalSeconds.toNumber();

  return (
    <div>
      <p className="text-sm text-muted">
        {inTrial ? "Trial ends" : "Next charge"}
      </p>
      <p className="text-base font-medium">
        {formatRelative(next)} — {formatDateTime(next)}
      </p>
    </div>
  );
}
```

## Edge cases

- **Trial period**: `nextPaymentAt` is the *trial end*, not the first interval boundary.
- **Just paid**: after a successful payment, `nextPaymentAt` jumps forward by exactly `intervalSeconds`. Subscribe to `onPaymentExecuted` to refresh.
- **Paused subscription**: `nextPaymentAt` doesn't auto-advance. Resume sets it relative to `now`.
