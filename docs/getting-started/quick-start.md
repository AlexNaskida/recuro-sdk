# Quick Start

Subscribe to a plan and manage your subscription in under 5 minutes.

## 1. Install the SDK

```bash
yarn add @recuro/sdk
npm install @recuro/sdk
```

## 2. Initialize the SDK

```typescript
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });
```

## 3. Find and Subscribe to a Plan

```typescript
// Fetch available plans from a merchant
const merchantWallet = new PublicKey("merchant_address_here");
const plans = await sdk.fetchMerchantPlans(merchantWallet);

// Subscribe to first available plan
if (plans.length > 0) {
  const plan = plans[0];
  console.log(
    `Subscribing to: ${plan.name} - $${plan.amountUsdc.toNumber() / 1e6} USDC`,
  );

  const { subscriptionPubkey, signature } = await sdk.createSubscription({
    planPubkey: plan.publicKey,
  });

  console.log("✓ Subscribed:", subscriptionPubkey.toBase58());
  console.log("  Tx:", signature);
}
```

## 4. View Your Subscriptions

```typescript
const subscriptions = await sdk.fetchSubscriberSubscriptions(wallet.publicKey);

console.log(`You have ${subscriptions.length} subscription(s)`);

subscriptions.forEach((sub) => {
  const nextPaymentDate = new Date(sub.nextPaymentAt.toNumber() * 1000);
  console.log(`
    Status: ${sub.status}
    Amount: $${sub.amountUsdc.toNumber() / 1e6} USDC
    Next payment: ${nextPaymentDate.toLocaleDateString()}
    Total paid: $${sub.totalPaid.toNumber() / 1e6} USDC
  `);
});
```

## 5. Manage Your Subscription

```typescript
// Pause (temporarily stop payments)
await sdk.pauseSubscription(subscriptionPubkey);
console.log("✓ Subscription paused");

// Resume
await sdk.resumeSubscription(subscriptionPubkey);
console.log("✓ Subscription resumed");

// Cancel (permanently end and revoke delegate)
await sdk.cancelSubscription(subscriptionPubkey);
console.log("✓ Subscription cancelled - delegate revoked");
```

## What just happened

- You connected to a Recuro plan created by a merchant.
- When you subscribed, you approved a **scoped SPL delegate** limited to the plan amount per cycle.
- A Subscription PDA was created on-chain linking your wallet to the plan.
- The keeper will execute your first payment after any trial period.
- You can pause, resume, or cancel anytime—cancellation immediately revokes the delegate.

## Next steps

- [**How it Works**](./how-it-works.md) - Understand the architecture
- [**Integration Guide**](./integration-guide.md) - Full walkthrough with React components
- [**SDK Reference**](../sdk-reference/create-subscription.md) - Deep dive into each method

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
