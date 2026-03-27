# Fetch Methods

Retrieve plan and subscription data for subscriber-facing integrations.

## fetchPlan()

Get a single plan by address.

```typescript
async fetchPlan(planPubkey: PublicKey): Promise<PlanAccount | null>
```

**Example:**

```typescript
const plan = await sdk.fetchPlan(new PublicKey("..."));

if (!plan) {
  throw new Error("Plan not found");
}

console.log({
  name: plan.name,
  amountUsdc: plan.amountUsdc.toNumber() / 1e6,
  intervalSeconds: plan.intervalSeconds.toNumber() / 86400, // convert to days
  activeSubscribers: plan.activeSubscribers.toNumber(),
  totalRevenue: plan.totalRevenue.toNumber() / 1e6,
  status: plan.status, // "Active" | "Paused" | "Archived"
});
```

## fetchSubscription()

Get a single subscription by address.

```typescript
async fetchSubscription(
  subscriptionPubkey: PublicKey,
): Promise<SubscriptionAccount | null>
```

**Example:**

```typescript
const subscription = await sdk.fetchSubscription(new PublicKey("..."));

if (!subscription) {
  throw new Error("Subscription not found");
}

console.log({
  plan: subscription.plan.toBase58(),
  subscriber: subscription.subscriber.toBase58(),
  amountUsdc: subscription.amountUsdc.toNumber() / 1e6,
  status: subscription.status, // "Active" | "Paused" | "Cancelled" | "Expired"
  nextPaymentAt: new Date(subscription.nextPaymentAt.toNumber() * 1000),
  totalPaid: subscription.totalPaid.toNumber() / 1e6,
  consecutiveFailures: subscription.consecutiveFailures,
});
```

## fetchMerchantPlans()

Get plans created by a merchant so subscribers can discover available options.

```typescript
async fetchMerchantPlans(merchantPublicKey: PublicKey): Promise<PlanAccount[]>
```

**Example:**

```typescript
const plans = await sdk.fetchMerchantPlans(merchantPublicKey);

plans.forEach((plan) => {
  console.log({
    name: plan.name,
    activeSubscribers: plan.activeSubscribers.toNumber(),
    mrr: (plan.activeSubscribers.toNumber() * plan.amountUsdc.toNumber()) / 1e6,
  });
});
```

## fetchSubscriberSubscriptions()

Get all subscriptions for a user.

```typescript
async fetchSubscriberSubscriptions(subscriberPublicKey: PublicKey): Promise<SubscriptionAccount[]>
```

**Example:**

```typescript
const subscriptions = await sdk.fetchSubscriberSubscriptions(userPublicKey);

subscriptions.forEach((sub) => {
  const plan = await sdk.fetchPlan(sub.plan);
  if (!plan) return;
  console.log({
    planName: plan.name,
    status: sub.status,
    nextPaymentDate: new Date(sub.nextPaymentAt.toNumber() * 1000),
    amountUsdc: sub.amountUsdc.toNumber() / 1e6,
  });
});
```

## fetchPlanSubscriptions()

Get all subscriptions for a specific plan. Useful for merchants to see who is subscribed.

```typescript
async fetchPlanSubscriptions(planPubkey: PublicKey): Promise<SubscriptionAccount[]>
```

**Example:**

```typescript
const subscriptions = await sdk.fetchPlanSubscriptions(planAddress);

console.log(`Plan has ${subscriptions.length} subscriptions`);

// Filter by status
const active = subscriptions.filter((s) => s.status === "Active");
const paused = subscriptions.filter((s) => s.status === "Paused");

console.log(`Active: ${active.length}, Paused: ${paused.length}`);
```

## Data types

### PlanAccount

```typescript
interface PlanAccount {
  publicKey: PublicKey;
  merchant: PublicKey;
  name: string;
  description: string;
  amountUsdc: BN; // Micro-USDC (divide by 1e6 for human)
  intervalSeconds: BN;
  trialSeconds: BN;
  gracePeriodSeconds: BN;
  activeSubscribers: BN;
  totalSubscribersEver: BN;
  grossRevenue: BN; // Micro-USDC
  feesPaid: BN; // Micro-USDC
  totalRevenue: BN; // Micro-USDC (net after fees)
  status: "Active" | "Paused" | "Archived";
  createdAt: BN; // Unix timestamp
  updatedAt: BN;
}
```

### SubscriptionAccount

```typescript
interface SubscriptionAccount {
  publicKey: PublicKey;
  plan: PublicKey;
  subscriber: PublicKey;
  subscriberTokenAccount: PublicKey;
  amountUsdc: BN; // Micro-USDC
  intervalSeconds: BN;
  nextPaymentAt: BN; // Unix timestamp
  startedAt: BN;
  endedAt: BN; // 0 if still active
  lastPaidAt: BN;
  lastFailedAt: BN;
  totalPaid: BN; // Micro-USDC
  paymentCount: BN;
  consecutiveFailures: number;
  status: "Active" | "Paused" | "Cancelled" | "Expired";
}
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
