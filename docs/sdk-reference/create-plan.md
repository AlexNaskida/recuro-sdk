# createPlan()

Create a new subscription plan with fixed, immutable pricing.

> **For Merchants**: This documentation covers programmatic plan creation via the SDK. While fully functional, **most merchants create plans through admin dashboards** rather than directly calling this method. See [Merchant Overview](../for-merchants/overview.md) for recommended integration architecture.
>
> **When to use this method:**
>
> - Automated plan import (migrating from Stripe, etc.)
> - Seeding test plans in development
> - API integrations that need programmatic plan creation
> - Dynamic plan generation based on external data

## Overview

Plans define the terms of a subscription: price, billing interval, trial period, and capacity. Once created, a plan's price and interval **cannot be changed** — this protects subscribers from surprise price increases mid-subscription.

## Parameters

| Parameter                | Type               | Required | Description                                                                             |
| ------------------------ | ------------------ | -------- | --------------------------------------------------------------------------------------- |
| `planId`                 | number             | ✓        | Unique identifier for this plan. Use a timestamp or incremental ID.                     |
| `name`                   | string             | ✓        | Plan name (e.g., "Pro Monthly"). Max 64 chars.                                          |
| `description`            | string             |          | Plan description. Max 256 chars.                                                        |
| `imageUrl`               | string             |          | Plan icon URL (for dashboards).                                                         |
| `amountUsdc`             | number             | ✓        | Price in human USDC (e.g., 9.99). SDK converts to micro-USDC.                           |
| `intervalDays`           | number             | ✓        | Billing interval in days. Common: 30 (monthly), 365 (yearly).                           |
| `trialDays`              | number             |          | Free trial period in days. Defaults to 0.                                               |
| `gracePeriodDays`        | number             |          | Grace period after failed payment before incrementing failure counter. Default: 3 days. |
| `maxSubscribers`         | number             |          | Max concurrent subscribers. 0 = unlimited. Default: 0.                                  |
| `merchantReceiveAddress` | string / PublicKey |          | Optional: alternate address to receive funds. Defaults to plan creator.                 |

## Returns

```typescript
interface CreatePlanResult {
  planPubkey: PublicKey; // Address of the Plan PDA
  signature: string; // Transaction signature
}
```

## Example

```typescript
const { planPubkey, signature } = await sdk.createPlan({
  planId: Date.now(),
  name: "Pro Plan",
  description: "Unlimited access + priority support",
  amountUsdc: 29.99,
  intervalDays: 30,
  trialDays: 7,
  maxSubscribers: 1000,
});

console.log("Plan created:", planPubkey.toBase58());
console.log("Tx:", signature);

// Save planPubkey to your database for later subscriptions
```

## Important notes

### Price immutability

Once a plan is live, the price and interval are locked forever. You cannot update them. To change pricing, create a new plan and migrate subscribers off the old one.

### Plan ID uniqueness

`planId` must be unique per merchant. If you call `createPlan` with the same `planId` twice, the second call will fail with "account already exists". Use a timestamp or UUID to ensure uniqueness.

### Trial period

If `trialDays` is set, the first payment will execute `trialDays` after subscription creation, not immediately. Subsequent payments follow the normal interval.

Example:

- Plan interval: 30 days
- Trial: 7 days
- Day 0: User subscribes
- Day 7: First payment
- Day 37: Second payment
- Day 67: Third payment, etc.

### Receive address

By default, payments are sent to `merchant` (the signer). You can override this with `merchantReceiveAddress` for programmatic fund routing. Must be a valid USDC ATA.

### Gas cost

Creating a plan requires rent for the Plan PDA (~0.002 SOL on mainnet). The keeper reimburses this from protocol treasury over time.

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
