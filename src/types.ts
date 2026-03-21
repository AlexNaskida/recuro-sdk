import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

export type Cluster = "devnet" | "mainnet-beta" | "localnet";

// ── On-chain account shapes ─────────────────────────────────────────────────
export interface PlanAccount {
  publicKey: PublicKey;
  merchant: PublicKey;
  merchantTokenAccount: PublicKey;
  merchantReceiveAddress: PublicKey; // Where merchant receives funds (defaults to merchant if not specified at creation)
  planId: BN;
  name: string;
  description: string;
  imageUrl: string;
  amountUsdc: BN;
  intervalSeconds: BN;
  trialSeconds: BN;
  gracePeriodSeconds: BN;
  maxSubscribers: BN;
  activeSubscribers: BN;
  totalSubscribersEver: BN;
  grossRevenue: BN;
  feesPaid: BN;
  successfulPayments: BN;
  failedPayments: BN;
  totalRevenue: BN;
  createdAt: BN;
  updatedAt: BN;
  status: "Active" | "Paused" | "Archived";
  bump: number;
}

export interface SubscriptionAccount {
  publicKey: PublicKey;
  plan: PublicKey;
  subscriber: PublicKey;
  subscriberTokenAccount: PublicKey;
  amountUsdc: BN;
  intervalSeconds: BN;
  nextPaymentAt: BN;
  startedAt: BN;
  endedAt: BN; // 0 if still active
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

export interface ProtocolConfigAccount {
  publicKey: PublicKey;
  admin: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  creationPaused: boolean;
  bump: number;
}

// ── SDK input params ──────────────────────────────────────────────────────────
export interface CreatePlanParams {
  planId: number;
  name: string;
  description?: string;
  imageUrl?: string;
  amountUsdc: number;
  intervalDays: number;
  trialDays?: number;
  gracePeriodDays?: number;
  maxSubscribers?: number;
  merchantReceiveAddress?: PublicKey | string; // Optional: where merchant receives funds. Defaults to merchant signer if not provided.
}

export interface UpdatePlanParams {
  planPubkey: PublicKey;
  name?: string;
  description?: string;
  imageUrl?: string;
  maxSubscribers?: number;
  merchantReceiveAddress?: PublicKey | string; // Optional: change where merchant receives funds
}

export interface CreateSubscriptionParams {
  planPubkey: PublicKey;
}

// ── SDK result types ──────────────────────────────────────────────────────────
export interface TxResult {
  signature: string;
}
export interface CreatePlanResult extends TxResult {
  planPubkey: PublicKey;
}
export interface CreateSubscriptionResult extends TxResult {
  subscriptionPubkey: PublicKey;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export interface RevenueDataPoint {
  date: string;
  revenue: number;
  daily: number;
  cumulative: number;
}

export interface SubscriptionTrendPoint {
  date: string;
  new: number;
  active: number;
  cancelled: number;
  expired: number;
  net: number;
}

export interface ChurnDataPoint {
  date: string;
  churned: number;
  churnRate: number;
}

export interface MRRDataPoint {
  date: string;
  mrr: number;
  growth: number;
}

export interface PlanMetrics {
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

export interface MerchantAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  pausedSubscriptions: number;
  newSubscriptionsThisMonth: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  totalFailedPayments: number;
  successfulPayments: number;
  successRate: number;
  revenueOverTime: RevenueDataPoint[];
  subscriptionsTrend: SubscriptionTrendPoint[];
  churnOverTime: ChurnDataPoint[];
  mrr: MRRDataPoint[];
  planMetrics: PlanMetrics[];
  recentExecutions: ExecutionLogEntry[];
  // legacy aliases used by dashboard
  plans?: PlanMetrics[];
  failedPayments?: number;
}

export type AnalyticsData = MerchantAnalytics;

// ── Execution log ─────────────────────────────────────────────────────────────
export interface ExecutionLogEntry {
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

export interface SdkConfig {
  cluster?: Cluster;
  programId?: string;
  usdcMint?: string;
}

// ── Events ────────────────────────────────────────────────────────────────────
export type PaymentExecutedEvent = {
  subscription: PublicKey;
  plan: PublicKey;
  subscriber: PublicKey;
  merchant: PublicKey;
  amountUsdc: BN;
  feeUsdc: BN;
  totalCharged: BN;
  paymentCount: BN;
  timestamp: BN;
};

export type PaymentFailedEvent = {
  subscription: PublicKey;
  subscriber: PublicKey;
  plan: PublicKey;
  reason: string;
  failedCount: number;
  willExpire: boolean;
  timestamp: BN;
};

export type SubscriptionCreatedEvent = {
  subscription: PublicKey;
  plan: PublicKey;
  subscriber: PublicKey;
  amountUsdc: BN;
  trialEndsAt: BN;
  nextPaymentAt: BN;
  timestamp: BN;
};

export type SubscriptionCancelledEvent = {
  subscription: PublicKey;
  plan: PublicKey;
  subscriber: PublicKey;
  cancelledBy: PublicKey;
  totalPaid: BN;
  paymentCount: BN;
  timestamp: BN;
};
