# Build a "manage subscription" page

A complete React component letting a user view and control their subscription.

```tsx
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  formatRelative,
  formatDate,
  formatUsdc,
  type SubscriptionAccount,
  type PlanAccount,
} from "@recuro/sdk";

export function ManageSubscription({
  sdk,
  subscriptionPubkey,
}: {
  sdk: SubscriptionSdk;
  subscriptionPubkey: PublicKey;
}) {
  const [sub, setSub] = useState<SubscriptionAccount | null>(null);
  const [plan, setPlan] = useState<PlanAccount | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const s = await sdk.fetchSubscription(subscriptionPubkey);
    const p = await sdk.fetchPlan(s.plan);
    setSub(s);
    setPlan(p);
  };

  useEffect(() => {
    refresh();
  }, [subscriptionPubkey]);

  // Auto-refresh on payment events
  useEffect(() => {
    const ids = [
      sdk.onPaymentExecuted((e) => e.subscription.equals(subscriptionPubkey) && refresh()),
      sdk.onPaymentFailed((e) => e.subscription.equals(subscriptionPubkey) && refresh()),
      sdk.onSubscriptionPaused((e) => e.subscription.equals(subscriptionPubkey) && refresh()),
      sdk.onSubscriptionResumed((e) => e.subscription.equals(subscriptionPubkey) && refresh()),
      sdk.onSubscriptionCancelled((e) => e.subscription.equals(subscriptionPubkey) && refresh()),
    ];
    return () => {
      ids.forEach((id) => sdk.removeEventListener(id));
    };
  }, [subscriptionPubkey]);

  if (!sub || !plan) return <Spinner />;

  const action = async (fn: () => Promise<unknown>, label: string) => {
    try {
      setBusy(true);
      await fn();
      toast.success(`${label} ✓`);
      await refresh();
    } catch (err) {
      toast.error(`${label} failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1>{plan.name}</h1>
        <p className="text-muted">{plan.description}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Status" value={sub.status} />
        <Stat label="Price" value={`$${formatUsdc(sub.amountUsdc.toNumber() / 1e6)}`} />
        <Stat label="Started" value={formatDate(sub.startedAt.toNumber())} />
        <Stat label="Total paid" value={`$${formatUsdc(sub.totalPaid.toNumber() / 1e6)}`} />
        <Stat label="Payments" value={String(sub.paymentCount.toNumber())} />
        {sub.status === "Active" && (
          <Stat
            label="Next charge"
            value={formatRelative(sub.nextPaymentAt.toNumber())}
          />
        )}
      </dl>

      {sub.consecutiveFailures > 0 && (
        <Alert variant="warning">
          Last payment failed. {3 - sub.consecutiveFailures} attempts remain
          before this subscription auto-expires.
        </Alert>
      )}

      <div className="flex gap-2">
        {sub.status === "Active" && (
          <>
            <Button
              disabled={busy}
              onClick={() => action(() => sdk.pauseSubscription(subscriptionPubkey), "Paused")}
            >
              Pause
            </Button>
            <Button
              disabled={busy}
              variant="destructive"
              onClick={() => action(() => sdk.cancelSubscription(subscriptionPubkey), "Cancelled")}
            >
              Cancel
            </Button>
          </>
        )}

        {sub.status === "Paused" && (
          <Button
            disabled={busy}
            onClick={() => action(() => sdk.resumeSubscription(subscriptionPubkey), "Resumed")}
          >
            Resume
          </Button>
        )}

        {sub.status === "Expired" && (
          <Button
            disabled={busy}
            onClick={() => action(() => sdk.renewSubscription(subscriptionPubkey), "Renewed")}
          >
            Renew
          </Button>
        )}
      </div>
    </div>
  );
}
```

## What this gives you

- ✅ Live data via event listeners (no polling)
- ✅ Status-aware action buttons (Pause is hidden when already paused, etc.)
- ✅ Auto-expiry warning when failures accumulate
- ✅ Toast feedback on every action
- ✅ Cleans up listeners on unmount
