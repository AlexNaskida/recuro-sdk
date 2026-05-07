# Types Reference

Every public type, interface, and enum exported by `@recuro/sdk`. Pulled directly from the SDK source.

```typescript
import type {
  Cluster,
  StablecoinSymbol,
  PlanAccount,
  SubscriptionAccount,
  ProtocolConfigAccount,
  CreatePlanParams,
  UpdatePlanParams,
  CreateSubscriptionParams,
  CreatePlanResult,
  CreateSubscriptionResult,
  TxResult,
  MerchantAnalytics,
  PlanMetrics,
  ExecutionLogEntry,
  SdkConfig,
} from "@recuro/sdk";
```

## Configuration

### `Cluster`

```typescript
type Cluster = "devnet" | "mainnet-beta" | "localnet";
```

### `StablecoinSymbol`

```typescript
type StablecoinSymbol = "USDC" | "USDT" | "PYUSD";
```

### `SdkConfig`

```typescript
interface SdkConfig {
  cluster?: Cluster; // default: "devnet"
  programId?: string; // override the program address
  stablecoin?: StablecoinSymbol; // pick a stablecoin by symbol
  stablecoinMint?: string; // explicit mint override
  /** @deprecated Use stablecoinMint instead. */
  usdcMint?: string;
}
```

## On-chain account shapes

These match the Anchor account layouts. `BN` values are big numbers - convert with `.toNumber()` and divide by `1e6` for USDC, or `1e0` for seconds → days as needed.

### `PlanAccount`

```typescript
interface PlanAccount {
  publicKey: PublicKey;
  merchant: PublicKey;
  merchantTokenAccount: PublicKey;
  merchantReceiveAddress: PublicKey; // where merchant receives USDC
  planId: BN;
  name: string; // ≤ 64 chars
  description: string; // ≤ 256 chars
  imageUrl: string;
  amountUsdc: BN; // micro-USDC
  intervalSeconds: BN;
  trialSeconds: BN;
  gracePeriodSeconds: BN;
  maxSubscribers: BN; // 0 = unlimited
  activeSubscribers: BN;
  totalSubscribersEver: BN;
  grossRevenue: BN;
  feesPaid: BN;
  successfulPayments: BN;
  failedPayments: BN;
  totalRevenue: BN;
  createdAt: BN; // unix seconds
  updatedAt: BN;
  status: "Active" | "Paused" | "Archived";
  bump: number;
}
```

### `SubscriptionAccount`

```typescript
interface SubscriptionAccount {
  publicKey: PublicKey;
  plan: PublicKey;
  subscriber: PublicKey;
  subscriberTokenAccount: PublicKey;
  amountUsdc: BN; // micro-USDC, copied from plan at creation
  intervalSeconds: BN;
  nextPaymentAt: BN; // unix seconds
  startedAt: BN;
  endedAt: BN; // 0 if active
  lastPaidAt: BN;
  lastFailedAt: BN;
  totalPaid: BN;
  paymentCount: BN;
  consecutiveFailures: number;
  failedPaymentCount: number; // alias for consecutiveFailures
  totalFailures: number;
  status: "Active" | "Paused" | "Cancelled" | "Expired";
  bump: number;
}
```

### `ProtocolConfigAccount`

```typescript
interface ProtocolConfigAccount {
  publicKey: PublicKey;
  admin: PublicKey;
  treasury: PublicKey;
  feeBps: number; // 0-500 (max 5%)
  creationPaused: boolean;
  bump: number;
}
```

## Input parameter types

### `CreatePlanParams`

```typescript
interface CreatePlanParams {
  planId: number; // unique per merchant
  name: string; // ≤ 64 chars
  description?: string; // ≤ 256 chars
  imageUrl?: string;
  amountUsdc: number; // human USDC, e.g. 9.99
  intervalDays: number; // 1-365
  trialDays?: number; // default 0
  gracePeriodDays?: number; // default 3
  maxSubscribers?: number; // 0 = unlimited
  merchantReceiveAddress?: PublicKey | string;
}
```

### `UpdatePlanParams`

Note: only the _non-financial_ fields are mutable. Price and interval are locked.

```typescript
interface UpdatePlanParams {
  planPubkey: PublicKey;
  name?: string;
  description?: string;
  imageUrl?: string;
  maxSubscribers?: number;
  merchantReceiveAddress?: PublicKey | string;
}
```

### `CreateSubscriptionParams`

```typescript
interface CreateSubscriptionParams {
  planPubkey: PublicKey;
}
```

## Return types

### `TxResult`

```typescript
interface TxResult {
  signature: string; // base58 transaction signature
}
```

### `CreatePlanResult`

```typescript
interface CreatePlanResult extends TxResult {
  planPubkey: PublicKey;
}
```

### `CreateSubscriptionResult`

```typescript
interface CreateSubscriptionResult extends TxResult {
  subscriptionPubkey: PublicKey;
}
```

## Analytics types

### `MerchantAnalytics`

```typescript
interface MerchantAnalytics {
  totalRevenue: number; // human USDC
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  pausedSubscriptions: number;
  newSubscriptionsThisMonth: number;
  churnRate: number; // %
  averageRevenuePerUser: number;
  lifetimeValue: number;
  totalFailedPayments: number;
  successfulPayments: number;
  successRate: number; // %
  revenueOverTime: RevenueDataPoint[];
  subscriptionsTrend: SubscriptionTrendPoint[];
  churnOverTime: ChurnDataPoint[];
  mrr: MRRDataPoint[];
  planMetrics: PlanMetrics[];
  recentExecutions: ExecutionLogEntry[];
}
```

### `PlanMetrics`

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

### Time-series points

```typescript
interface RevenueDataPoint {
  date: string;
  revenue: number;
  daily: number;
  cumulative: number;
}
interface SubscriptionTrendPoint {
  date: string;
  new: number;
  active: number;
  cancelled: number;
  expired: number;
  net: number;
}
interface ChurnDataPoint {
  date: string;
  churned: number;
  churnRate: number;
}
interface MRRDataPoint {
  date: string;
  mrr: number;
  growth: number;
}
```

### `ExecutionLogEntry`

```typescript
interface ExecutionLogEntry {
  signature: string;
  slot: number;
  timestamp: number;
  type:
    | "payment_executed"
    | "payment_failed"
    | "subscription_created"
    | "subscription_cancelled";
  subscription: string;
  subscriber: string;
  plan: string;
  amount?: number;
  success: boolean;
}
```

## Constants exports

```typescript
import {
  PROGRAM_ID,
  SUPPORTED_STABLECOINS,
  STABLECOIN_MINTS,
  USDC_MINT,
  USDC_DECIMALS, // 6
  USDC_FACTOR, // 1_000_000
  SEEDS,
  LIMITS,
} from "@recuro/sdk";
```

| Constant                | What it is                                                   |
| ----------------------- | ------------------------------------------------------------ |
| `PROGRAM_ID`            | The Recuro Subscription program address.                     |
| `SUPPORTED_STABLECOINS` | `readonly ["USDC", "USDT", "PYUSD"]`.                        |
| `STABLECOIN_MINTS`      | Map of symbol → mint address.                                |
| `USDC_MINT`             | Shortcut for `STABLECOIN_MINTS.USDC`.                        |
| `USDC_DECIMALS`         | `6` - USDC's on-chain decimal places.                        |
| `USDC_FACTOR`           | `1_000_000` - multiply human USDC by this to get micro-USDC. |
| `SEEDS`                 | PDA seed strings (`PLAN`, `SUBSCRIPTION`, `CONFIG`, etc.).   |
| `LIMITS`                | Program limits (max name length, max amount, etc.).          |

## Utility exports

```typescript
import {
  // PDA derivation
  getPlanPDA,
  getSubscriptionPDA,
  getThreadPDA,

  // USDC unit conversion
  microToUsdc,
  usdcToMicro,

  // Formatting
  formatUsdc,
  formatDate,
  formatDateTime,
  formatRelative,
  formatChartDate,
  intervalToLabel,
  shortenPubkey,
  momGrowth,
  solscanTxUrl,

  // Analytics
  buildAnalytics,
} from "@recuro/sdk";
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
