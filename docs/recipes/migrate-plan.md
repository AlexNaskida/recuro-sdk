# Migrate subscribers off an old plan

Plan prices are immutable. To "raise the price" or change the interval, create a new plan and migrate willing subscribers.

## The migration playbook

```
1. Create the new plan (createPlan)
2. Stop new sign-ups on the old plan (archivePlan)
3. Email subscribers: "We're moving to <new plan>, your old plan stays at the old price"
4. New subscriptions go to the new plan automatically
5. Old subscribers continue paying the old price until they cancel
6. Once all old subscribers have churned, deletePlan on the old one
```

## Step 1 — Create the new plan

```typescript
const { planPubkey: newPlanPubkey } = await sdk.createPlan({
  planId: Date.now(),
  name: "Pro Monthly (2026)",
  amountUsdc: 14.99,        // new price
  intervalDays: 30,
});
```

## Step 2 — Archive the old plan

```typescript
await sdk.archivePlan({ planPubkey: oldPlanPubkey });
```

This stops new subscribers but **does not affect existing subscriptions**. Existing subscribers continue at the old price.

## Step 3 — Find affected subscribers

```typescript
const oldSubs = await sdk.fetchPlanSubscriptions(oldPlanPubkey);
const active = oldSubs.filter((s) => s.status === "Active");

// Email/notify these subscribers
for (const sub of active) {
  console.log(`Notify ${sub.subscriber.toBase58()}`);
}
```

## Step 4 — Make the new plan easy to switch to

In your UI, on the user's "manage subscription" page, when the plan they're on is archived, surface a CTA:

```tsx
{plan.status === "Archived" && (
  <UpgradeCard
    newPlanPubkey={newPlanPubkey}
    onSwitch={async () => {
      await sdk.cancelSubscription(currentSub.publicKey);
      await sdk.createSubscription({ planPubkey: newPlanPubkey });
    }}
  />
)}
```

## Step 5 — Delete the old plan when empty

```typescript
const remaining = await sdk.fetchPlanSubscriptions(oldPlanPubkey);
const stillActive = remaining.filter((s) => s.status === "Active" || s.status === "Paused");

if (stillActive.length === 0) {
  await sdk.deletePlan({ planPubkey: oldPlanPubkey });
}
```

## Why immutable pricing is a feature, not a bug

- **Subscriber trust**: nobody wakes up to a 3× price hike.
- **Compliance**: clear audit trail of every price the merchant has ever offered.
- **Forces good behavior**: pricing changes are a deliberate event, not a config flag.
