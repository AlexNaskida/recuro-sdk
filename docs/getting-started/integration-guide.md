# Integration Guide

Complete walkthrough to integrate Recuro subscription management into your app.

## Step 1: Install and initialize SDK

```typescript
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });
```

## Step 2: Load plans from a merchant

```typescript
import { PublicKey } from "@solana/web3.js";

const merchantWallet = new PublicKey("merchant_wallet_here");
const plans = await sdk.fetchMerchantPlans(merchantWallet);
const activePlans = plans.filter((p) => p.status === "Active");

activePlans.forEach((plan) => {
  console.log({
    planPubkey: plan.publicKey.toBase58(),
    name: plan.name,
    amountUsdc: plan.amountUsdc.toNumber() / 1e6,
    intervalDays: plan.intervalSeconds.toNumber() / 86_400,
  });
});
```

## Step 3: Subscribe from frontend (React example)

```typescript
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { SubscriptionSdk } from "@recuro/sdk";

export function SubscribeButton({
  planPubkey,
  sdk,
}: {
  planPubkey: string;
  sdk: SubscriptionSdk;
}) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { subscriptionPubkey, signature } = await sdk.createSubscription({
        planPubkey: new PublicKey(planPubkey),
      });

      console.log("Subscription created:", subscriptionPubkey.toBase58());
      console.log("Tx:", signature);
    } catch (error) {
      console.error("Subscribe failed:", error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? "Processing..." : "Subscribe"}
    </button>
  );
}
```

## Step 4: Show user subscriptions

```typescript
const subscriptions = await sdk.fetchSubscriberSubscriptions(wallet.publicKey);

for (const sub of subscriptions) {
  const plan = await sdk.fetchPlan(sub.plan);
  console.log({
    planName: plan?.name ?? "Unknown Plan",
    status: sub.status,
    amountUsdc: sub.amountUsdc.toNumber() / 1e6,
    nextPaymentAt: new Date(sub.nextPaymentAt.toNumber() * 1000),
    totalPaid: sub.totalPaid.toNumber() / 1e6,
  });
}
```

## Step 5: Manage subscription lifecycle

```typescript
// Pause temporary
await sdk.pauseSubscription(subscriptionPubkey);

// Resume later
await sdk.resumeSubscription(subscriptionPubkey);

// Cancel permanently
await sdk.cancelSubscription(subscriptionPubkey);

// Renew expired subscription
await sdk.renewSubscription(subscriptionPubkey, planPubkey);
```

## Step 6: Optional real-time updates

```typescript
const paymentListenerId = sdk.onPaymentExecuted((event, slot, signature) => {
  console.log("Payment executed", {
    subscription: event.subscription.toBase58(),
    signature,
    slot,
  });
});

const failedListenerId = sdk.onPaymentFailed((event, slot, signature) => {
  console.log("Payment failed", {
    subscription: event.subscription.toBase58(),
    reason: event.reason,
    signature,
  });
});

// cleanup when component unmounts
void sdk.removeEventListener(paymentListenerId);
void sdk.removeEventListener(failedListenerId);
```

## Production checklist

- Validate wallet is connected before every action
- Show clear errors for rejected wallet signatures
- Refresh subscription list after pause/resume/cancel/renew
- Cache plan metadata to avoid repeated RPC calls
- Use a dedicated RPC endpoint for stable production traffic

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
