# createSubscription()

Subscribe a user to a plan and request SPL delegate approval.

## Overview

Creates a Subscription PDA linking a subscriber to a plan. Triggers a Phantom approval request for a **scoped SPL delegate**-granting the Subscription PDA permission to transfer up to the plan amount per billing cycle.

## Parameters

| Parameter    | Type      | Required | Description                                       |
| ------------ | --------- | -------- | ------------------------------------------------- |
| `planPubkey` | PublicKey | ✓        | Address of an existing plan provided by merchant. |

## Returns

```typescript
interface CreateSubscriptionResult {
  subscriptionPubkey: PublicKey; // Address of the Subscription PDA
  signature: string; // Transaction signature
}
```

## Example

```typescript
const { subscriptionPubkey, signature } = await sdk.createSubscription({
  planPubkey: new PublicKey("..."),
});

console.log("Subscribed:", subscriptionPubkey.toBase58());
console.log("Tx:", signature);
```

## What the subscriber sees

When `createSubscription()` is called, Phantom pops up an approval request:

```
⚠️ Request to Approve Token Delegate

Recuro Subscription Program requests permission to transfer from your
account.

Token: USDC
Delegate: [Subscription PDA]
Amount: 9.99
Authorized signer: [Your wallet]

[Approve] [Reject]
```

This approval does **not** transfer funds immediately. It grants permission for the keeper to pull the plan amount once per billing cycle.

## What happens after

1. **Keeper detects subscription** - Polls on-chain for new subscriptions.
2. **Waits for trial period** - If `trialDays` was set, waits that long.
3. **Executes first payment** - Keeper calls `executePayment()` at scheduled time.
4. **Repeats** - Keeper continues every `intervalDays` until cancelled or expired.

## Approval safety

- **Scoped to plan amount** - Delegate cannot transfer more per cycle.
- **Scoped to plan** - Different plans have different delegates; a breach in one doesn't expose others.
- **Revokable** - Subscriber can revoke in Phantom at any time.
- **One-time approval** - Doesn't require re-approval each payment cycle.

## Error handling

```typescript
try {
  const { subscriptionPubkey } = await sdk.createSubscription({
    planPubkey,
  });
} catch (error) {
  if (error.message.includes("PlanNotFound")) {
    console.error("Plan does not exist");
  } else if (error.message.includes("insufficient balance")) {
    console.error("USDC balance too low or no USDC ATA");
  } else {
    console.error("Subscription failed:", error.message);
  }
}
```

## Check subscription status

After creation, fetch the subscription to verify:

```typescript
const subscription = await sdk.fetchSubscription(subscriptionPubkey);

console.log({
  plan: subscription.plan.toBase58(),
  subscriber: subscription.subscriber.toBase58(),
  status: subscription.status, // "Active" | "Paused" | "Cancelled" | "Expired"
  nextPaymentAt: new Date(subscription.nextPaymentAt.toNumber() * 1000),
  amountUsdc: subscription.amountUsdc.toNumber() / 1e6,
});
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
