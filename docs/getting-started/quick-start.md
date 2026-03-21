# Quick Start

Get your first plan live and accept your first subscriber in under 5 minutes.

## 1. Install the SDK

```typescript
yarn add @recuro/sdk
```

## 2. Initialize the SDK

```typescript
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";

const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });
```

## 3. Create a plan (merchant)

```typescript
const { planPubkey, signature } = await sdk.createPlan({
  planId: Date.now(),
  name: "Pro Plan",
  description: "Unlimited access",
  amountUsdc: 9.99,
  intervalDays: 30,
  trialDays: 7,
  maxSubscribers: 0, // unlimited
});

console.log("Plan created:", planPubkey.toBase58());
```

## 4. Subscribe (subscriber)

```typescript
const { subscriptionPubkey, signature } = await sdk.createSubscription({
  planPubkey,
});

console.log("Subscribed:", subscriptionPubkey.toBase58());
```

## 5. Cancel (subscriber or merchant)

```typescript
await sdk.cancelSubscription(subscriptionPubkey);
console.log("Cancelled");
```

## What just happened

- You created an immutable Plan PDA with a fixed price and billing interval.
- The subscriber approved a scoped SPL delegate (limited to 9.99 USDC per 30 days).
- A Subscription PDA was created linking both accounts.
- The keeper will detect this and execute the first payment after the trial period.
- Anyone can call `executePayment()` on that subscription afterward, but the amounts are enforced on-chain.

## Next steps

- [**How it works**](./how-it-works.md) - Understand the architecture
- [**Integration Guide**](./integration-guide.md) - Full walkthrough with UI examples
- [**SDK Reference**](../sdk-reference/create-plan.md) - Deep dive into each method

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
