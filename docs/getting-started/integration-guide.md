# Integration Guide

Complete walkthrough to integrate Recuro subscription management into your app.

This guide focuses on **customer-facing subscription management** - the primary use case for the SDK. For information about plan creation, see the [Merchant Overview](../for-merchants/overview.md).

## Prerequisites

- Node.js 18+ or React/Next.js app
- Solana wallet adapter installed (`@solana/wallet-adapter-react`)
- Basic understanding of Solana transactions

## Step 1: Install and initialize SDK

```bash
npm install @recuro/sdk @coral-xyz/anchor @solana/web3.js
# or
yarn add @recuro/sdk @coral-xyz/anchor @solana/web3.js
```

```typescript
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

// In a React component or hook
const { wallet, publicKey } = useWallet();
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Create provider with connected wallet
const provider = new AnchorProvider(connection, wallet.adapter, {
  commitment: "confirmed",
});

// Initialize SDK
const sdk = new SubscriptionSdk(provider, { cluster: "devnet" });
```

## Step 2: Display available plans

Create a component to show subscription plans to users:

```typescript
import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import type { SubscriptionSdk } from "@recuro/sdk";

interface Plan {
  publicKey: PublicKey;
  name: string;
  description: string;
  amountUsdc: number;
  intervalDays: number;
  trialDays: number;
  status: string;
}

export function SubscriptionPlans({ sdk, merchantWallet }: {
  sdk: SubscriptionSdk;
  merchantWallet: PublicKey;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const fetchedPlans = await sdk.fetchMerchantPlans(merchantWallet);
        const activePlans = fetchedPlans
          .filter((p) => p.status === "Active")
          .map((p) => ({
            publicKey: p.publicKey,
            name: p.name,
            description: p.description,
            amountUsdc: p.amountUsdc.toNumber() / 1e6,
            intervalDays: p.intervalSeconds.toNumber() / 86_400,
            trialDays: p.trialPeriod?.toNumber() / 86_400 || 0,
            status: p.status,
          }));

        setPlans(activePlans);
      } catch (error) {
        console.error("Failed to load plans:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, [sdk, merchantWallet]);

  if (loading) return <div>Loading plans...</div>;

  return (
    <div className="plans-grid">
      {plans.map((plan) => (
        <PlanCard key={plan.publicKey.toBase58()} plan={plan} sdk={sdk} />
      ))}
    </div>
  );
}
```

## Step 3: Subscribe from frontend (React example)

When `createSubscription` runs, it now requires Guard accounts in addition to plan/subscription accounts. The SDK handles this internally, but if you build raw Anchor instruction calls you must pass:

- `guardAccount` PDA with seeds `["guard", subscription_pubkey]` using Guard program ID
- `guardProgram` (Recuro Guard program)
- `merchantTokenAccount` and `subscriberTokenAccount` so Guard can be initialized correctly

The subscription transaction does two important on-chain actions:

1. Approves the Guard PDA as SPL delegate.
2. CPI-calls Guard `initialize_guard(amount_per_period, period_seconds)`.

Create a subscribe button component with proper error handling:

```typescript
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { SubscriptionSdk } from "@recuro/sdk";
import { useWallet } from "@solana/wallet-adapter-react";

interface PlanCardProps {
  plan: {
    publicKey: PublicKey;
    name: string;
    description: string;
    amountUsdc: number;
    intervalDays: number;
    trialDays: number;
  };
  sdk: SubscriptionSdk;
}

export function PlanCard({ plan, sdk }: PlanCardProps) {
  const { connected, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = async () => {
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { subscriptionPubkey, signature } = await sdk.createSubscription({
        planPubkey: plan.publicKey,
      });

      console.log("Subscription created:", subscriptionPubkey.toBase58());
      console.log("Transaction:", signature);

      setSuccess(true);

      // Optionally redirect or refresh subscription list
      // window.location.href = `/subscriptions/${subscriptionPubkey.toBase58()}`;
    } catch (err: any) {
      console.error("Subscribe failed:", err);

      // User-friendly error messages
      if (err.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else if (err.message?.includes("insufficient")) {
        setError("Insufficient USDC balance");
      } else if (err.message?.includes("PlanNotFound")) {
        setError("Plan no longer available");
      } else {
        setError("Subscription failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plan-card">
      <h3>{plan.name}</h3>
      <p>{plan.description}</p>
      <div className="pricing">
        <span className="amount">${plan.amountUsdc}</span>
        <span className="interval">/ {plan.intervalDays} days</span>
      </div>
      {plan.trialDays > 0 && (
        <div className="trial-badge">{plan.trialDays} day free trial</div>
      )}

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Successfully subscribed! ✓</div>}

      <button
        onClick={handleSubscribe}
        disabled={loading || !connected || success}
        className="subscribe-btn"
      >
        {loading ? "Processing..." : success ? "Subscribed" : "Subscribe Now"}
      </button>
    </div>
  );
}
```

## Step 4: Show user subscriptions

Create a subscription dashboard component:

```typescript
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { SubscriptionSdk } from "@recuro/sdk";

interface Subscription {
  publicKey: string;
  planName: string;
  status: string;
  amountUsdc: number;
  nextPaymentAt: Date;
  totalPaid: number;
  cyclesRemaining: number;
}

export function SubscriptionDashboard({ sdk }: { sdk: SubscriptionSdk }) {
  const { publicKey } = useWallet();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubscriptions() {
      if (!publicKey) return;

      try {
        const subs = await sdk.fetchSubscriberSubscriptions(publicKey);

        // Enrich with plan data
        const enrichedSubs = await Promise.all(
          subs.map(async (sub) => {
            const plan = await sdk.fetchPlan(sub.plan);

            return {
              publicKey: sub.publicKey.toBase58(),
              planName: plan?.name ?? "Unknown Plan",
              status: Object.keys(sub.status)[0], // "active" | "paused" | "cancelled" | "expired"
              amountUsdc: sub.amountUsdc.toNumber() / 1e6,
              nextPaymentAt: new Date(sub.nextPaymentAt.toNumber() * 1000),
              totalPaid: sub.totalPaid.toNumber() / 1e6,
              cyclesRemaining: sub.cyclesRemaining,
            };
          })
        );

        setSubscriptions(enrichedSubs);
      } catch (error) {
        console.error("Failed to load subscriptions:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSubscriptions();
  }, [sdk, publicKey]);

  if (loading) return <div>Loading subscriptions...</div>;
  if (subscriptions.length === 0) {
    return <div>No active subscriptions. Browse plans to get started!</div>;
  }

  return (
    <div className="subscription-dashboard">
      <h2>My Subscriptions ({subscriptions.length})</h2>
      <div className="subscription-list">
        {subscriptions.map((sub) => (
          <SubscriptionCard
            key={sub.publicKey}
            subscription={sub}
            sdk={sdk}
            onUpdate={() => loadSubscriptions()} // Refresh after actions
          />
        ))}
      </div>
    </div>
  );
}
```

## Step 5: Manage subscription lifecycle

Create a subscription card component with pause/resume/cancel actions:

```typescript
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { SubscriptionSdk } from "@recuro/sdk";

interface SubscriptionCardProps {
  subscription: {
    publicKey: string;
    planName: string;
    status: string;
    amountUsdc: number;
    nextPaymentAt: Date;
    totalPaid: number;
    cyclesRemaining: number;
  };
  sdk: SubscriptionSdk;
  onUpdate: () => void;
}

export function SubscriptionCard({ subscription, sdk, onUpdate }: SubscriptionCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subPubkey = new PublicKey(subscription.publicKey);
  const isActive = subscription.status === "active";
  const isPaused = subscription.status === "paused";
  const isCancelled = subscription.status === "cancelled";
  const isExpired = subscription.status === "expired";

  const handlePause = async () => {
    setLoading("pause");
    setError(null);

    try {
      const signature = await sdk.pauseSubscription(subPubkey);
      console.log("Paused:", signature);
      onUpdate(); // Refresh subscription list
    } catch (err: any) {
      console.error("Pause failed:", err);
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleResume = async () => {
    setLoading("resume");
    setError(null);

    try {
      const signature = await sdk.resumeSubscription(subPubkey);
      console.log("Resumed:", signature);
      onUpdate();
    } catch (err: any) {
      console.error("Resume failed:", err);
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure? This will permanently cancel your subscription and revoke payment authorization.")) {
      return;
    }

    setLoading("cancel");
    setError(null);

    try {
      const signature = await sdk.cancelSubscription(subPubkey);
      console.log("Cancelled:", signature);
      onUpdate();
    } catch (err: any) {
      console.error("Cancel failed:", err);
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`subscription-card ${subscription.status}`}>
      <div className="subscription-header">
        <h3>{subscription.planName}</h3>
        <span className={`status-badge ${subscription.status}`}>
          {subscription.status.toUpperCase()}
        </span>
      </div>

      <div className="subscription-details">
        <div className="detail-row">
          <span className="label">Amount:</span>
          <span className="value">${subscription.amountUsdc} USDC</span>
        </div>
        <div className="detail-row">
          <span className="label">Next payment:</span>
          <span className="value">
            {isActive || isPaused
              ? subscription.nextPaymentAt.toLocaleDateString()
              : "N/A"}
          </span>
        </div>
        <div className="detail-row">
          <span className="label">Total paid:</span>
          <span className="value">${subscription.totalPaid} USDC</span>
        </div>
        <div className="detail-row">
          <span className="label">Cycles left:</span>
          <span className="value">{subscription.cyclesRemaining}</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="subscription-actions">
        {isActive && (
          <>
            <button
              onClick={handlePause}
              disabled={!!loading}
              className="btn-secondary"
            >
              {loading === "pause" ? "Pausing..." : "Pause"}
            </button>
            <button
              onClick={handleCancel}
              disabled={!!loading}
              className="btn-danger"
            >
              {loading === "cancel" ? "Cancelling..." : "Cancel"}
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={handleResume}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === "resume" ? "Resuming..." : "Resume"}
            </button>
            <button
              onClick={handleCancel}
              disabled={!!loading}
              className="btn-danger"
            >
              {loading === "cancel" ? "Cancelling..." : "Cancel"}
            </button>
          </>
        )}

        {(isCancelled || isExpired) && (
          <div className="subscription-ended">
            This subscription has ended.
          </div>
        )}
      </div>
    </div>
  );
}
```

### Action descriptions

- **Pause**: Temporarily stops payments without revoking delegate. Next payment is skipped.
- **Resume**: Reactivates a paused subscription. Next payment continues as scheduled.
- **Cancel**: Permanently ends subscription and revokes SPL delegate. Cannot be undone.

## Step 6: Real-time subscription updates (Optional)

Listen to payment events to update your UI in real-time:

```typescript
import { useEffect } from "react";
import type { SubscriptionSdk } from "@recuro/sdk";

export function useSubscriptionEvents(
  sdk: SubscriptionSdk,
  onPaymentSuccess?: (subscriptionPubkey: string) => void,
  onPaymentFailed?: (subscriptionPubkey: string, reason: string) => void
) {
  useEffect(() => {
    // Listen for successful payments
    const successListenerId = sdk.onPaymentExecuted((event, slot, signature) => {
      console.log("Payment executed:", {
        subscription: event.subscription.toBase58(),
        amount: event.amount,
        signature,
        slot,
      });

      if (onPaymentSuccess) {
        onPaymentSuccess(event.subscription.toBase58());
      }
    });

    // Listen for failed payments
    const failedListenerId = sdk.onPaymentFailed((event, slot, signature) => {
      console.log("Payment failed:", {
        subscription: event.subscription.toBase58(),
        reason: event.reason,
        signature,
        slot,
      });

      if (onPaymentFailed) {
        onPaymentFailed(event.subscription.toBase58(), event.reason);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      sdk.removeEventListener(successListenerId);
      sdk.removeEventListener(failedListenerId);
    };
  }, [sdk, onPaymentSuccess, onPaymentFailed]);
}

// Usage in a component:
export function SubscriptionManager({ sdk }: { sdk: SubscriptionSdk }) {
  const [subscriptions, setSubscriptions] = useState([]);

  const refreshSubscriptions = async () => {
    // Reload subscriptions from blockchain
    const subs = await sdk.fetchSubscriberSubscriptions(publicKey);
    setSubscriptions(subs);
  };

  useSubscriptionEvents(
    sdk,
    (subPubkey) => {
      console.log(`Payment succeeded for ${subPubkey}`);
      refreshSubscriptions(); // Refresh UI to show updated payment count
    },
    (subPubkey, reason) => {
      console.error(`Payment failed for ${subPubkey}: ${reason}`);
      // Show notification to user
      showNotification(`Payment failed: ${reason}. Please check your USDC balance.`);
    }
  );

  return <div>...</div>;
}
```

## Complete integration example

Here's a full example bringing it all together:

```typescript
// SubscriptionManager.tsx
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@recuro/sdk";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";

const MERCHANT_WALLET = new PublicKey("YOUR_MERCHANT_WALLET_ADDRESS");

export function SubscriptionManager() {
  const { connection } = useConnection();
  const { publicKey, wallet } = useWallet();

  // Initialize SDK
  const sdk = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(
      connection,
      wallet.adapter,
      { commitment: "confirmed" }
    );

    return new SubscriptionSdk(provider, { cluster: "devnet" });
  }, [connection, wallet]);

  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load plans and subscriptions
  useEffect(() => {
    if (!sdk || !publicKey) return;

    async function loadData() {
      setLoading(true);
      try {
        const [fetchedPlans, fetchedSubs] = await Promise.all([
          sdk.fetchMerchantPlans(MERCHANT_WALLET),
          sdk.fetchSubscriberSubscriptions(publicKey),
        ]);

        setPlans(fetchedPlans.filter(p => p.status === "Active"));
        setSubscriptions(fetchedSubs);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [sdk, publicKey]);

  if (!publicKey) {
    return <div>Please connect your wallet to continue.</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="subscription-manager">
      <section className="available-plans">
        <h2>Available Plans</h2>
        <SubscriptionPlans sdk={sdk} merchantWallet={MERCHANT_WALLET} />
      </section>

      <section className="my-subscriptions">
        <h2>My Subscriptions</h2>
        <SubscriptionDashboard sdk={sdk} />
      </section>
    </div>
  );
}
```

## Production checklist

Before launching your subscription integration, ensure these items are complete:

### Wallet Integration

- ✅ Validate wallet is connected before every SDK action
- ✅ Show clear "Connect Wallet" prompt when disconnected
- ✅ Handle wallet disconnection gracefully (clear state, show reconnect)
- ✅ Display user-friendly errors for rejected signatures
- ✅ Test with multiple wallet types (Phantom, Solflare, Backpack)

### Error Handling

- ✅ Wrap all SDK calls in try-catch blocks
- ✅ Map technical errors to user-friendly messages
- ✅ Show retry buttons for transient failures (network issues)
- ✅ Log errors to monitoring service (Sentry, LogRocket)
- ✅ Handle "insufficient balance" gracefully with clear instructions

### UI/UX

- ✅ Show loading states during transactions (disable buttons, spinners)
- ✅ Display transaction signatures with Solana Explorer links
- ✅ Refresh subscription list after actions (pause/resume/cancel/subscribe)
- ✅ Show confirmation dialogs for destructive actions (cancel subscription)
- ✅ Display trial period prominently when applicable
- ✅ Show next payment date and amount clearly

### Performance

- ✅ Cache plan metadata to avoid repeated RPC calls
- ✅ Use pagination or virtualization for long subscription lists
- ✅ Debounce rapid subscription fetches
- ✅ Use dedicated RPC endpoint (not public devnet for production)
- ✅ Consider using webhooks or event listeners for real-time updates

### Security

- ✅ Never request users' private keys or seed phrases
- ✅ Validate all PublicKey inputs before passing to SDK
- ✅ Use HTTPS for all API endpoints
- ✅ Implement rate limiting on backend endpoints (if applicable)
- ✅ Educate users about SPL delegate approval (what it means, how to revoke)

### Keeper Operations

- ✅ Run your own keeper for guaranteed payment execution (see [Keeper Guide](../keeper/running-your-own.md))
- ✅ Monitor keeper uptime and alert on failures
- ✅ Fund keeper wallet with sufficient SOL for gas fees
- ✅ Set up backup keeper in different region for redundancy

### Testing

- ✅ Test full subscription lifecycle on devnet (subscribe → pause → resume → cancel)
- ✅ Test failed payment scenarios (insufficient balance, revoked delegate)
- ✅ Test with small amounts on mainnet before full launch
- ✅ Verify trial periods work correctly
- ✅ Test concurrent subscriptions (same user, multiple plans)

### Monitoring

- ✅ Track subscription creation rate and conversion
- ✅ Monitor failed payment rates and reasons
- ✅ Alert on unusual cancellation spikes
- ✅ Log all SDK errors with context (user, plan, subscription)
- ✅ Set up dashboards for key metrics (active subs, MRR, churn)

### For Merchants

- ✅ Create plans on devnet first for testing
- ✅ Verify plan pricing and intervals before deploying to mainnet
- ✅ Store plan public keys in your database for easy reference
- ✅ Consider using admin dashboard for plan creation (see [Merchant Overview](../for-merchants/overview.md))
- ✅ Document plan IDs and their mapping to your internal SKUs

## Recommended RPC providers

For production, use a dedicated RPC endpoint with higher rate limits:

- [Helius](https://helius.dev/) - Free tier available, 100 req/s
- [QuickNode](https://quicknode.com/) - Reliable, pay-as-you-go
- [Alchemy](https://www.alchemy.com/) - Free tier, good for testing
- [Triton](https://triton.one/) - High-performance, enterprise option

## Next steps

- Review [SDK Reference](../sdk-reference/create-subscription.md) for detailed API docs
- Set up a [Keeper](../keeper/running-your-own.md) for reliable payment execution
- Explore [Real-time Events](../sdk-reference/event-listeners.md) for live updates
- Read [Security Best Practices](../security/overview.md) to protect your users

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
