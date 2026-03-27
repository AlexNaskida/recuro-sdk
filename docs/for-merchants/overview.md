# For Merchants

**Integrate subscription billing into your merchant platform in minutes.**

This guide helps merchants understand how to use the Recuro SDK effectively.

## TL;DR: What You'll Build

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Merchant Website                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │   Pricing   │   │  Subscribe  │   │   Account   │          │
│   │    Page     │   │   Button    │   │  Dashboard  │          │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│          │                 │                 │                  │
│          ▼                 ▼                 ▼                  │
│   ┌─────────────────────────────────────────────────┐          │
│   │              Recuro Subscription SDK             │          │
│   │  fetchPlans() │ subscribe() │ pause/cancel()    │          │
│   └─────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Primary Focus: Subscription Management

**The Recuro SDK is designed for customer-facing subscription management.** This means your integration will focus on:

| Feature       | What It Does                       | SDK Method             |
| ------------- | ---------------------------------- | ---------------------- |
| Display plans | Show pricing options to customers  | `fetchMerchantPlans()` |
| Subscribe     | Let customers start a subscription | `createSubscription()` |
| Pause         | Temporarily stop payments          | `pauseSubscription()`  |
| Resume        | Reactivate a paused subscription   | `resumeSubscription()` |
| Cancel        | End subscription permanently       | `cancelSubscription()` |
| View status   | Show subscription details          | `fetchSubscription()`  |

**This is the recommended integration approach** — and what 90% of the SDK documentation covers.

## About Plan Creation

The SDK includes a `createPlan()` method, and it works! However, **merchants typically don't need to use it directly**.

### Why?

Plans are usually created once and rarely change. Most merchants prefer:

1. **Admin dashboard** — Visual interface for non-technical team members
2. **Direct on-chain** — One-time setup during initial deployment
3. **Backend API** — If you need programmatic plan creation

### When to Use SDK Plan Creation

The SDK's `createPlan()` is useful for:

| Use Case             | Example                                      |
| -------------------- | -------------------------------------------- |
| **Automated import** | Migrating plans from Stripe/another provider |
| **Testing**          | Quickly creating test plans in development   |
| **Dynamic pricing**  | Generating plans based on external data      |
| **API integrations** | Exposing plan creation via your backend      |

→ See [createPlan() Reference](../sdk-reference/create-plan.md) for technical details

### The SDK Has Plan Code — Use It If You Need It

We want to be transparent: the SDK includes full plan management functionality. You can:

```typescript
// Create a plan (if you need to)
await sdk.createPlan({
  planId: Date.now(),
  name: "Pro Monthly",
  amountUsdc: 29.99,
  intervalDays: 30,
});

// The SDK supports this, but subscription management
// is where most merchants spend their time
```

**Bottom line:** The SDK can create plans, but you'll spend most of your integration time on subscription management — that's where your customers interact with Recuro.

## Quick Start Example

Here's a minimal merchant integration (React):

```typescript
import { SubscriptionSdk } from "@recuro/sdk";
import { useWallet } from "@solana/wallet-adapter-react";

// Your merchant wallet (where you created plans)
const MERCHANT_WALLET = new PublicKey("YOUR_MERCHANT_ADDRESS");

function SubscribePage() {
  const { publicKey } = useWallet();
  const [plans, setPlans] = useState([]);

  // 1. Fetch your plans
  useEffect(() => {
    sdk.fetchMerchantPlans(MERCHANT_WALLET).then(setPlans);
  }, []);

  // 2. Let customers subscribe
  const handleSubscribe = async (planPubkey) => {
    const { subscriptionPubkey } = await sdk.createSubscription({
      planPubkey,
    });
    console.log("Subscribed!", subscriptionPubkey.toBase58());
  };

  return (
    <div>
      {plans.map(plan => (
        <button onClick={() => handleSubscribe(plan.publicKey)}>
          Subscribe to {plan.name} - ${plan.amountUsdc / 1e6}/mo
        </button>
      ))}
    </div>
  );
}
```

→ See [Integration Guide](../getting-started/integration-guide.md) for the full walkthrough with error handling, loading states, and production checklist.

## Integration Checklist

### Essential (Day 1)

- [ ] Install SDK: `npm install @recuro/sdk`
- [ ] Initialize with your wallet and RPC
- [ ] Display your plans on pricing page
- [ ] Add subscribe button with `createSubscription()`
- [ ] Build subscription dashboard showing user's active subs

### Recommended (Week 1)

- [ ] Add pause/resume/cancel functionality
- [ ] Show payment history and next payment date
- [ ] Handle errors gracefully (insufficient balance, etc.)
- [ ] Test full lifecycle on devnet

### Production Ready

- [ ] Run your own keeper (or use multiple for redundancy)
- [ ] Set up monitoring and alerts
- [ ] Use dedicated RPC endpoint (Helius, QuickNode, etc.)
- [ ] Test with real USDC on mainnet

## SDK Documentation Map

| I want to...             | Read this                                                    |
| ------------------------ | ------------------------------------------------------------ |
| Get started quickly      | [Quick Start](../getting-started/quick-start.md)             |
| See full React examples  | [Integration Guide](../getting-started/integration-guide.md) |
| Understand how it works  | [How It Works](../getting-started/how-it-works.md)           |
| Run payment execution    | [Keeper Overview](../keeper/overview.md)                     |
| Learn about security     | [Security Overview](../security/overview.md)                 |
| Create plans (if needed) | [createPlan()](../sdk-reference/create-plan.md)              |

## Next Steps

1. **Start here**: [Integration Guide](../getting-started/integration-guide.md) — Full React walkthrough
2. **Run a keeper**: [Keeper Setup](../keeper/running-your-own.md) — Ensure payments execute
3. **Go live**: Follow the production checklist in the Integration Guide

---

> Questions? [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
