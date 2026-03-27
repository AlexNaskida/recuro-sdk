# getAnalytics()

Get aggregated merchant analytics and metrics.

## Overview

Computes comprehensive analytics for a merchant by aggregating data from all their plans and subscriptions. Perfect for building merchant dashboards.

## Method Signature

```typescript
async getAnalytics(
  merchant: PublicKey,
  recentLogs?: ExecutionLogEntry[]
): Promise<MerchantAnalytics>
```

## Parameters

| Parameter    | Type                  | Required | Description                                 |
| ------------ | --------------------- | -------- | ------------------------------------------- |
| `merchant`   | `PublicKey`           | Yes      | Merchant wallet address                     |
| `recentLogs` | `ExecutionLogEntry[]` | No       | Recent execution logs for detailed tracking |

## Return Value

```typescript
interface MerchantAnalytics {
  // Revenue
  totalRevenue: number; // Lifetime revenue (micro-USDC)
  monthlyRecurringRevenue: number; // Current MRR
  annualRecurringRevenue: number; // ARR (MRR * 12)
  averageRevenuePerUser: number; // ARPU
  lifetimeValue: number; // LTV estimate

  // Subscriptions
  activeSubscriptions: number;
  totalSubscriptions: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  pausedSubscriptions: number;
  newSubscriptionsThisMonth: number;

  // Health Metrics
  churnRate: number; // Monthly churn %
  successRate: number; // Payment success %
  successfulPayments: number;
  totalFailedPayments: number;

  // Time Series Data
  revenueOverTime: RevenueDataPoint[];
  subscriptionsTrend: SubscriptionTrendPoint[];
  churnOverTime: ChurnDataPoint[];
  mrr: MRRDataPoint[];

  // Per-Plan Breakdown
  planMetrics: PlanMetrics[];

  // Recent Activity
  recentExecutions: ExecutionLogEntry[];
}
```

## Example

### Basic Usage

```typescript
import { SubscriptionSdk } from "@recuro/sdk";

const sdk = new SubscriptionSdk(provider);

const analytics = await sdk.getAnalytics(merchantWallet);

console.log({
  mrr: analytics.monthlyRecurringRevenue / 1e6,
  activeSubscribers: analytics.activeSubscriptions,
  churnRate: `${analytics.churnRate.toFixed(2)}%`,
  successRate: `${analytics.successRate.toFixed(2)}%`,
});
```

### Dashboard Integration

```typescript
function MerchantDashboard() {
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);

  useEffect(() => {
    sdk.getAnalytics(merchantWallet).then(setAnalytics);
  }, []);

  if (!analytics) return <Loading />;

  return (
    <div>
      <MetricCard
        title="MRR"
        value={`$${(analytics.monthlyRecurringRevenue / 1e6).toFixed(2)}`}
      />
      <MetricCard
        title="Active Subscribers"
        value={analytics.activeSubscriptions}
      />
      <MetricCard
        title="Churn Rate"
        value={`${analytics.churnRate.toFixed(1)}%`}
      />

      <RevenueChart data={analytics.revenueOverTime} />
      <SubscriberTrendChart data={analytics.subscriptionsTrend} />

      <PlanBreakdown plans={analytics.planMetrics} />
    </div>
  );
}
```

### Per-Plan Metrics

```typescript
const analytics = await sdk.getAnalytics(merchantWallet);

analytics.planMetrics.forEach((plan) => {
  console.log({
    name: plan.name,
    price: plan.amountUsdc / 1e6,
    subscribers: plan.activeSubscribers,
    revenue: plan.totalRevenue / 1e6,
    mrr: plan.mrr / 1e6,
    churnRate: `${plan.churnRate.toFixed(1)}%`,
    conversionRate: `${plan.conversionRate.toFixed(1)}%`,
  });
});
```

## Data Types

### RevenueDataPoint

```typescript
interface RevenueDataPoint {
  date: string; // ISO date string
  revenue: number; // Total revenue on this date
  daily: number; // Daily revenue
  cumulative: number; // Running total
}
```

### SubscriptionTrendPoint

```typescript
interface SubscriptionTrendPoint {
  date: string;
  new: number; // New subscriptions
  active: number; // Active count
  cancelled: number; // Cancelled count
  expired: number; // Expired count
  net: number; // Net change
}
```

### ChurnDataPoint

```typescript
interface ChurnDataPoint {
  date: string;
  churned: number; // Subscriptions lost
  churnRate: number; // Churn percentage
}
```

### PlanMetrics

```typescript
interface PlanMetrics {
  planPubkey: string;
  planId: number;
  name: string;
  amountUsdc: number;
  intervalDays: number;
  activeSubscribers: number;
  totalRevenue: number;
  mrr: number;
  status: "Active" | "Paused" | "Archived";
  conversionRate: number;
  churnRate: number;
  successRate: number;
}
```

## Performance Notes

This method fetches **all** plans and subscriptions for a merchant. For merchants with many subscriptions:

- Consider caching results
- Call during off-peak times
- Use pagination for UI display

```typescript
// Example: Cache analytics for 5 minutes
let cachedAnalytics: MerchantAnalytics | null = null;
let cacheTime = 0;

async function getAnalyticsCached() {
  const now = Date.now();
  if (cachedAnalytics && now - cacheTime < 5 * 60 * 1000) {
    return cachedAnalytics;
  }

  cachedAnalytics = await sdk.getAnalytics(merchantWallet);
  cacheTime = now;
  return cachedAnalytics;
}
```

## Related

- [Fetch Methods](./fetch-methods.md) — Individual data fetching
- [Event Listeners](./event-listeners.md) — Real-time updates
- [Merchant Overview](../for-merchants/overview.md) — Integration guide

---

> Questions? [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
