# @recuro/sdk

**Non-custodial recurring payments on Solana**

[![npm version](https://img.shields.io/npm/v/@recuro/sdk.svg)](https://www.npmjs.com/package/@recuro/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Recuro enables automated USDC subscription payments without custodying subscriber funds. Subscribers approve a limited delegate - funds stay in their wallet until each payment executes on-chain.

## Features

- **Non-custodial** - Funds remain in subscriber wallets until payment time
- **Immutable pricing** - Plan prices are locked on-chain, protecting subscribers
- **Instant cancellation** - Revoking delegate stops all future payments immediately
- **Open keeper architecture** - Anyone can run payment execution, no single point of failure

## Installation

```bash
npm install @recuro/sdk
```

## Quick Start

```typescript
import { SubscriptionSdk } from "@recuro/sdk";
import { AnchorProvider } from "@coral-xyz/anchor";

// Initialize
const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });

// Subscribe to a plan
const { subscriptionPubkey } = await sdk.createSubscription({
  planPubkey: new PublicKey("..."),
});

// Manage subscription
await sdk.pauseSubscription(subscriptionPubkey);
await sdk.resumeSubscription(subscriptionPubkey);
await sdk.cancelSubscription(subscriptionPubkey);

// Fetch data
const plans = await sdk.fetchMerchantPlans(merchantWallet);
const subscriptions = await sdk.fetchSubscriberSubscriptions(userWallet);
```

## SDK Methods

### Subscription Management

| Method                 | Description                    |
| ---------------------- | ------------------------------ |
| `createSubscription()` | Subscribe to a plan            |
| `pauseSubscription()`  | Temporarily stop payments      |
| `resumeSubscription()` | Resume a paused subscription   |
| `cancelSubscription()` | Permanently end subscription   |
| `renewSubscription()`  | Extend an expired subscription |

### Data Fetching

| Method                           | Description                        |
| -------------------------------- | ---------------------------------- |
| `fetchPlan()`                    | Get a single plan                  |
| `fetchSubscription()`            | Get a single subscription          |
| `fetchMerchantPlans()`           | Get all plans for a merchant       |
| `fetchSubscriberSubscriptions()` | Get all subscriptions for a user   |
| `fetchPlanSubscriptions()`       | Get all subscribers to a plan      |
| `getAnalytics()`                 | Get merchant analytics and metrics |

### Plan Management

| Method            | Description                    |
| ----------------- | ------------------------------ |
| `createPlan()`    | Create a new subscription plan |
| `updatePlan()`    | Update plan metadata           |
| `archivePlan()`   | Stop accepting new subscribers |
| `unarchivePlan()` | Reactivate an archived plan    |
| `deletePlan()`    | Permanently delete a plan      |

### Real-time Events

| Method                      | Description                    |
| --------------------------- | ------------------------------ |
| `onPaymentExecuted()`       | Listen for successful payments |
| `onPaymentFailed()`         | Listen for failed payments     |
| `onSubscriptionCreated()`   | Listen for new subscriptions   |
| `onSubscriptionCancelled()` | Listen for cancellations       |
| `onSubscriptionPaused()`    | Listen for pauses              |
| `onSubscriptionResumed()`   | Listen for resumes             |
| `onSubscriptionExpired()`   | Listen for expirations         |

## Configuration

```typescript
const sdk = new SubscriptionSdk(provider, {
  cluster: "devnet", // "devnet" | "mainnet-beta" | "localnet"
  programId: "...", // Optional: custom program address
  usdcMint: "...", // Optional: custom USDC mint
});
```

## How It Works

1. **Subscriber approves delegate** - Authorizes the subscription PDA to transfer up to 12 billing cycles
2. **Subscription PDA created** - Locks in plan price and subscriber details on-chain
3. **Keeper executes payments** - Off-chain bot validates timing and transfers USDC to merchant

Funds never leave the subscriber's wallet until payment time. Cancel anytime to immediately revoke delegate access.

## Documentation

For complete documentation, examples, and integration guides:

**[View Full Documentation](./docs/README.md)**

- [Quick Start Guide](./docs/getting-started/quick-start.md)
- [Integration Guide](./docs/getting-started/integration-guide.md)
- [Merchant Overview](./docs/for-merchants/overview.md)
- [Keeper Setup](./docs/keeper/overview.md)
- [Security Model](./docs/security/overview.md)

## License

MIT
