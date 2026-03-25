# @recuro/sdk

**Non-custodial recurring USDC subscription protocol on Solana**

Accept automated, recurring payments without ever touching subscriber funds. Subscribers approve a limited SPL delegate—funds remain in their wallet until each payment executes. The protocol handles all recurring payment logic on-chain.

## What is Recuro?

Recuro enables subscription integration in three steps:

1. **Subscriber approves a delegate** — They authorize the subscription PDA to transfer up to 12 billing cycles worth of funds (delegate revokes automatically)
2. **SDK creates Subscription PDA** — Locks in the plan price, amount, and subscriber
3. **Off-chain keeper executes payments** — Validates timing and transfers USDC to merchant on schedule

**Critically: Funds never leave the subscriber's wallet until payment time.**

## Installation

Install from npm or use the local workspace package:

```bash
# npm
npm install @recuro/sdk

# yarn
yarn add @recuro/sdk
```

## Quick Start

Initialize the SDK with your Solana provider:

```typescript
import { SubscriptionSdk } from "@recuro/sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, clusterApiUrl } from "@solana/web3.js";

// Setup connection and provider
const connection = new Connection(clusterApiUrl("devnet"));
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

// Initialize SDK
const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });
```

Then handle subscriptions:

```typescript
// 1. Subscribe to a plan
const { subscriptionPubkey, signature } = await sdk.createSubscription({
  planPubkey: new PublicKey("..."),
});

// 2. View active subscriptions
const mySubscriptions = await sdk.fetchSubscriberSubscriptions(
  wallet.publicKey,
);

// 3. Pause or cancel
await sdk.pauseSubscription(subscriptionPubkey);
await sdk.cancelSubscription(subscriptionPubkey);
```

---

## Subscription Management

### Browse Available Plans

Fetch all active plans from a merchant:

```typescript
const merchantWallet = new PublicKey("...");
const plans = await sdk.fetchMerchantPlans(merchantWallet);

plans.forEach((plan) => {
  console.log(`Plan: ${plan.name}`);
  console.log(`  Price: $${plan.amountUsdc / 1e6} USDC`);
  console.log(`  Interval: ${plan.intervalSeconds / 86400} days`);
  console.log(`  Active Subscribers: ${plan.activeSubscribers}`);
  console.log(`  Status: ${plan.status}`);
});
```

**Plan Object Structure:**

```typescript
interface PlanAccount {
  publicKey: PublicKey; // Plan account address
  merchant: PublicKey; // Plan creator
  name: string; // Display name
  description: string; // Plan details
  amountUsdc: BN; // Price in microUSDAC (1 USDC = 1,000,000)
  intervalSeconds: BN; // Billing cycle in seconds
  trialSeconds: BN; // Free trial period (0 if none)
  maxSubscribers: BN; // Capacity (0 = unlimited)
  activeSubscribers: BN; // Current active subscribers
  status: "Active" | "Paused" | "Archived";
  createdAt: BN; // Unix timestamp
}
```

---

### Subscribe to a Plan

Create a subscription after the user has approved the plan:

```typescript
try {
  const { subscriptionPubkey, signature } = await sdk.createSubscription({
    planPubkey: planAddress,
  });

  console.log(`✓ Subscription created: ${subscriptionPubkey.toBase58()}`);
  console.log(`  Transaction: ${signature}`);
} catch (error) {
  console.error("Subscription failed:", error.message);
}
```

**What happens:**

1. Subscriber wallet is checked for sufficient USDC
2. A new Subscription PDA is created, locking in the plan price and amount
3. SPL delegate is approved for up to 12 billing cycles
4. First payment scheduled for 1 billing cycle from now (or after trial)

**Subscription Object Structure:**

```typescript
interface SubscriptionAccount {
  publicKey: PublicKey; // Subscription address
  plan: PublicKey; // Associated plan
  subscriber: PublicKey; // Subscriber wallet
  amountUsdc: BN; // Amount per cycle (copied from plan)
  intervalSeconds: BN; // Billing cycle (copied from plan)
  nextPaymentAt: BN; // Unix timestamp of next payment
  lastPaidAt: BN; // Last successful payment timestamp
  totalPaid: BN; // Total paid across all cycles
  paymentCount: BN; // Number of successful payments
  status: "Active" | "Paused" | "Cancelled" | "Expired";
  startedAt: BN; // Subscription creation time
  endedAt: BN; // 0 if still active
}
```

---

### View Your Subscriptions

Fetch all subscriptions for the connected wallet:

```typescript
const subscriptions = await sdk.fetchSubscriberSubscriptions(wallet.publicKey);

subscriptions.forEach((sub) => {
  const plan = await sdk.fetchPlan(sub.plan);

  console.log(`Plan: ${plan.name}`);
  console.log(
    `  Next payment: ${new Date(sub.nextPaymentAt.toNumber() * 1000)}`,
  );
  console.log(`  Amount: $${sub.amountUsdc.toNumber() / 1e6} USDC`);
  console.log(`  Status: ${sub.status}`);
  console.log(`  Total paid: $${sub.totalPaid.toNumber() / 1e6} USDC`);
});
```

---

### Pause a Subscription

Temporarily stop payments without cancelling:

```typescript
try {
  const signature = await sdk.pauseSubscription(subscriptionPubkey);
  console.log(`✓ Subscription paused: ${signature}`);
} catch (error) {
  console.error("Pause failed:", error.message);
}
```

**Effects:**

- Delegate authority remains active
- No additional payments will execute
- Can be resumed at any time
- Trial period pauses as well

---

### Resume a Subscription

Restart a paused subscription where it left off:

```typescript
try {
  const signature = await sdk.resumeSubscription(subscriptionPubkey);
  console.log(`✓ Subscription resumed: ${signature}`);
} catch (error) {
  console.error("Resume failed:", error.message);
}
```

**Effects:**

- Subscription status returns to "Active"
- Next payment time is recalculated
- Delegate approval remains valid

---

### Cancel a Subscription

Permanently end a subscription (irreversible):

```typescript
try {
  const signature = await sdk.cancelSubscription(subscriptionPubkey);
  console.log(`✓ Subscription cancelled: ${signature}`);
  console.log(`  Delegate revoked. No future payments will execute.`);
} catch (error) {
  console.error("Cancellation failed:", error.message);
}
```

**Effects:**

- Sets subscription status to "Cancelled"
- SPL delegate is immediately revoked
- Zero future payment exposure
- Cannot be resumed

---

### Renew an Expired Subscription

If a subscription expires (after 12 billing cycles without renewal), extend it:

```typescript
try {
  const { signature } = await sdk.renewSubscription(
    subscriptionPubkey,
    planPubkey,
  );
  console.log(`✓ Subscription renewed: ${signature}`);
} catch (error) {
  console.error("Renewal failed:", error.message);
}
```

**When is renewal needed:**

- SPL delegate expires after 12 billing cycles
- Subscription status becomes "Expired"
- Keeper stops attempting payments
- User must explicitly renew to continue

---

## Security & Design

### How Payments Stay Safe

1. **Funds stay in subscriber control** — SPL delegate can only transfer to specific merchant, only up to plan amount, only when keeper validates timing
2. **Immutable plan price** — Merchant cannot change amount after subscribers join; prevents sneaky price hikes
3. **Automatic delegate revocation** — Approve only lasts 12 cycles; re-approve required for renewals
4. **Cancel = immediate revoke** — SPL delegate is immediately revoked, zero future exposure even if keeper is compromised
5. **On-chain validation** — Program validates all accounts, amounts, and timing before transfer

### Account Structure

**Plan PDA:** `seeds=[merchant, planId]`

- Locked in: name, price, billing interval, trial period
- Mutable: description, receive address, max subscribers

**Subscription PDA:** `seeds=[plan, subscriber]`

- Immutable: plan reference, subscriber, amount (copied from plan)
- Mutable: status (Active/Paused/Cancelled/Expired), next payment time

---

## Configuration

### Initialize with Custom Settings

```typescript
const sdk = new SubscriptionSdk(provider, {
  cluster: "devnet", // "devnet" | "mainnet-beta" | "localnet"
  programId: "45WGwEH24Y9J6ZHYoKiGRET4t4xpu6ESiTeRdhRf9pfr", // Optional: override program
  usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Optional: override USDC mint
});
```

**Defaults:**

- **devnet**: Program `45WGwEH...` | USDC `4zMMC9s...`
- **mainnet-beta**: Will use mainnet USDC mint (if program deployed)

---

## Type Reference

### SDK Configuration

```typescript
interface SdkConfig {
  cluster?: "devnet" | "mainnet-beta" | "localnet";
  programId?: string; // Override on-chain program ID
  usdcMint?: string; // Override USDC mint address
}
```

### Subscription Results

```typescript
// After creating subscription
interface CreateSubscriptionResult {
  signature: string; // Transaction signature on-chain
  subscriptionPubkey: PublicKey; // Subscription account address
}

// After pausing, resuming, cancelling
type TransactionSignature = string; // Transaction signature

// After renewing
interface RenewSubscriptionResult {
  signature: string;
  subscriptionPubkey: PublicKey;
}
```

---

## Error Handling

Common errors you may encounter:

```typescript
try {
  await sdk.createSubscription({ planPubkey });
} catch (error) {
  if (error.message.includes("Plan not found")) {
    console.error("Plan does not exist on-chain");
  } else if (error.message.includes("Plan is not accepting")) {
    console.error("Plan is paused or archived");
  } else if (error.message.includes("Insufficient lamports")) {
    console.error("Wallet has insufficient SOL for transaction fees");
  } else {
    console.error("Unexpected error:", error.message);
  }
}
```

---

## Integration Example: React UI

Complete example integrating Recuro into a React subscription UI:

```typescript
import { useCallback, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSdk } from "./hooks/useSdk";

export function SubscriptionManager() {
  const { publicKey } = useWallet();
  const { sdk } = useSdk();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load user subscriptions
  const loadSubscriptions = useCallback(async () => {
    if (!publicKey || !sdk) return;
    setLoading(true);
    try {
      const subs = await sdk.fetchSubscriberSubscriptions(publicKey);
      setSubscriptions(subs);
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
    } finally {
      setLoading(false);
    }
  }, [publicKey, sdk]);

  // Handle pause
  const handlePause = useCallback(
    async (subPubkey: PublicKey) => {
      try {
        await sdk.pauseSubscription(subPubkey);
        await loadSubscriptions(); // Refresh
      } catch (error) {
        console.error("Pause failed:", error);
      }
    },
    [sdk, loadSubscriptions]
  );

  // Handle resume
  const handleResume = useCallback(
    async (subPubkey: PublicKey) => {
      try {
        await sdk.resumeSubscription(subPubkey);
        await loadSubscriptions(); // Refresh
      } catch (error) {
        console.error("Resume failed:", error);
      }
    },
    [sdk, loadSubscriptions]
  );

  // Handle cancel
  const handleCancel = useCallback(
    async (subPubkey: PublicKey) => {
      if (!window.confirm("Cancel subscription? This cannot be undone.")) return;
      try {
        await sdk.cancelSubscription(subPubkey);
        await loadSubscriptions(); // Refresh
      } catch (error) {
        console.error("Cancel failed:", error);
      }
    },
    [sdk, loadSubscriptions]
  );

  // Load subscriptions on mount
  React.useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  return (
    <div>
      <h2>My Subscriptions</h2>
      {loading ? (
        <p>Loading...</p>
      ) : subscriptions.length === 0 ? (
        <p>No active subscriptions</p>
      ) : (
        <ul>
          {subscriptions.map((sub) => (
            <li key={sub.publicKey.toBase58()}>
              <div>
                <strong>{sub.status}</strong>
              </div>
              <p>Amount: ${sub.amountUsdc.toNumber() / 1e6} USDC</p>
              <p>
                Next payment:{" "}
                {new Date(sub.nextPaymentAt.toNumber() * 1000).toLocaleDateString()}
              </p>
              <div>
                {sub.status === "Active" && (
                  <>
                    <button onClick={() => handlePause(sub.publicKey)}>Pause</button>
                    <button onClick={() => handleCancel(sub.publicKey)}>Cancel</button>
                  </>
                )}
                {sub.status === "Paused" && (
                  <>
                    <button onClick={() => handleResume(sub.publicKey)}>Resume</button>
                    <button onClick={() => handleCancel(sub.publicKey)}>Cancel</button>
                  </>
                )}
                {sub.status === "Expired" && (
                  <button onClick={() => sdk.renewSubscription(sub.publicKey, sub.plan)}>
                    Renew
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## Best Practices

### 1. Always Validate Plans Before Subscribing

```typescript
const plan = await sdk.fetchPlan(planAddress);
if (!plan) {
  throw new Error("Plan not found");
}
if (plan.status !== "Active") {
  throw new Error("Plan is not accepting new subscribers");
}
```

### 2. Check Delegate Expiration

```typescript
const sub = await sdk.fetchSubscription(subAddress);
if (sub.status === "Expired") {
  // Offer user the option to renew
  console.log("Subscription expired. Renew to continue.");
}
```

### 3. Handle Preflight Validation

Catch errors early before sending to Phantom:

```typescript
try {
  // Fetch and validate plan
  const plan = await sdk.fetchPlan(planPubkey);
  if (!plan || plan.status !== "Active") {
    throw new Error("Plan is not available");
  }

  // Check wallet has enough USDC
  const userBalance = await connection.getTokenAccountBalance(userTokenAccount);
  if (userBalance.value.uiAmount < plan.amountUsdc) {
    throw new Error("Insufficient USDC balance");
  }

  // Now safe to proceed
  await sdk.createSubscription({ planPubkey });
} catch (error) {
  console.error("Preflight validation failed:", error.message);
  // Show user-friendly error message
}
```

### 4. Cache Plan Data When Possible

```typescript
// Don't refetch for every subscription display
const planCache = new Map<string, PlanAccount>();

async function getPlan(planAddress: PublicKey) {
  const key = planAddress.toBase58();
  if (!planCache.has(key)) {
    const plan = await sdk.fetchPlan(planAddress);
    if (plan) planCache.set(key, plan);
  }
  return planCache.get(key);
}
```

---

## TypeScript Types

All public types are exported from the SDK:

```typescript
import type {
  PlanAccount,
  SubscriptionAccount,
  CreateSubscriptionResult,
  SdkConfig,
  Cluster,
} from "@recuro/sdk";
```

---

## Troubleshooting

### "Plan not found"

- Verify the plan address is correct
- Check the plan exists on your cluster (devnet vs mainnet)

### "Plan is not accepting new subscribers"

- Plan status is "Paused" or "Archived"
- Ask merchant to activate the plan

### "Insufficient lamports"

- Wallet doesn't have enough SOL for rent/fees
- Top up SOL balance

### Transaction simulation fails

- Check USDC balance before subscribing
- Verify merchant's receive token account exists
- Ensure you're on the correct cluster

---

## Advanced: Plan Management (Optional)

If your use case includes creating or managing plans, see [PLAN_MANAGEMENT.md](./PLAN_MANAGEMENT.md).

---

## License

MIT
