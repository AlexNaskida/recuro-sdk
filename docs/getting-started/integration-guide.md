# Integration Guide

Full 8-step walkthrough to integrate Recuro subscriptions into your app.

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

## Step 2: Create a plan (merchant backend)

```typescript
// Call this once, store the planPubkey for later
const { planPubkey } = await sdk.createPlan({
  planId: 1, // or Date.now() for unique plans
  name: "Pro Plan",
  description: "Unlimited access + priority support",
  amountUsdc: 29.99,
  intervalDays: 30,
  trialDays: 7,
  maxSubscribers: 1000,
});

console.log("Plan created:", planPubkey.toBase58());
// Save this to your database
```

## Step 3: Add subscribe button to frontend (React example)

```typescript
import { useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";
import { Connection, clusterApiUrl } from "@solana/web3.js";

export function SubscribeButton({ planPubkey }: { planPubkey: string }) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!wallet.publicKey) {
      alert("Connect wallet first");
      return;
    }

    setLoading(true);
    try {
      const connection = new Connection(clusterApiUrl("devnet"));
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });

      const { subscriptionPubkey, signature } = await sdk.createSubscription({
        planPubkey: new PublicKey(planPubkey),
      });

      console.log("Subscription created:", subscriptionPubkey.toBase58());
      console.log("Tx:", signature);
      alert("Subscribed! Check your wallet for approval prompt.");
    } catch (error) {
      console.error("Subscribe failed:", error);
      alert(`Error: ${(error as any).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? "Processing..." : "Subscribe Now"}
    </button>
  );
}
```

## Step 4: Show subscription status to users

```typescript
// Fetch all active subscriptions for the current user
const subscriptions = await sdk.fetchSubscriberSubscriptions(wallet.publicKey);

subscriptions.forEach((sub) => {
  console.log({
    plan: sub.plan.toBase58(),
    status: sub.status, // "Active" | "Paused" | "Cancelled" | "Expired"
    nextPaymentAt: new Date(sub.nextPaymentAt.toNumber() * 1000),
    totalPaid: sub.totalPaid.toNumber() / 1e6, // Convert to human USDC
  });
});

// Render a dashboard showing:
// - Plan name
// - Amount and frequency
// - Next payment date
// - Total amount paid to date
// - "Cancel" button
```

## Step 5: Handle cancellation

```typescript
const handleCancel = async () => {
  const { signature } = await sdk.cancelSubscription(subscriptionPubkey);
  console.log("Cancelled:", signature);

  // On subscriber's wallet: Show confirmation
  // "Your subscription has been cancelled. No more payments will be charged."
};
```

## Step 6: Handle renewal (expired subscriptions)

```typescript
// Subscribers see expired subscription in their list
// Show a "Resubscribe" button

const handleResubscribe = async () => {
  // Create a new subscription (same plan or updated plan)
  const { subscriptionPubkey } = await sdk.createSubscription({
    planPubkey: new PublicKey(planPubkey),
  });
  console.log("Resubscribed:", subscriptionPubkey.toBase58());
};
```

## Step 7: Listen to payment events

```typescript
// Set up listener for payment execution
const listenerId = sdk.onPaymentExecuted((event, slot, signature) => {
  console.log({
    grossAmount: event.grossAmount.toNumber() / 1e6,
    feesCharged: event.feesCharged.toNumber() / 1e6,
    netAmount: event.netAmount.toNumber() / 1e6,
    signature,
  });

  // Update your database: record the payment
  // Send customer receipt email
  // Update dashboard analytics
});

// Clean up when component unmounts
return () => {
  sdk.removeEventListener(listenerId);
};
```

## Step 8: Run the keeper on your server

The keeper automatically executes scheduled payments. See [**Keeper Setup**](../keeper/running-your-own.md).

```bash
# Environment variables
SOLANA_CLUSTER=devnet
SOLANA_RPC=https://api.devnet.solana.com
KEEPER_KEYPAIR_PATH=/path/to/keypair.json
POLL_INTERVAL_MS=30000

# Run the keeper
node keeper.mjs
```

---

## Common patterns

### Merchant dashboard

Pull analytics for all your plans:

```typescript
const analytics = await sdk.getAnalytics(merchant.publicKey);

console.log({
  totalRevenue: analytics.totalRevenue,
  mrr: analytics.monthlyRecurringRevenue,
  activeSubscriptions: analytics.activeSubscriptions,
});
```

### Subscriber portal

Show status and history:

```typescript
const subs = await sdk.fetchSubscriberSubscriptions(subscriber.publicKey);
const plans = await Promise.all(subs.map((sub) => sdk.fetchPlan(sub.plan)));

// Display:
// Plan name, amount, last payment, next payment, etc.
```

### Webhook simulation

Listen to on-chain events and update your server:

```typescript
sdk.onPaymentExecuted((event, slot) => {
  fetch("/api/payment-webhook", {
    method: "POST",
    body: JSON.stringify({ event, slot }),
  });
});
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
