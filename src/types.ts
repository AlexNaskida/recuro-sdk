import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

// ── Cluster ───────────────────────────────────────────────────────────────────
export type Cluster = "devnet" | "mainnet-beta" | "localnet";

// ── On-chain account shapes ───────────────────────────────────────────────────
export interface PlanAccount {
  publicKey:            PublicKey;
  merchant:             PublicKey;
  merchantTokenAccount: PublicKey;
  planId:               BN;
  name:                 string;
  description:          string;
  imageUrl:             string;
  amountUsdc:           BN;         // micro-USDC
  intervalSeconds:      BN;
  trialSeconds:         BN;
  gracePeriodSeconds:   BN;
  maxSubscribers:       BN;
  activeSubscribers:    BN;
  totalSubscribersEver: BN;
  grossRevenue:         BN;
  feesPaid:             BN;
  successfulPayments:   BN;
  failedPayments:       BN;
  totalRevenue:         BN;         // alias for grossRevenue (net)
  createdAt:            BN;
  updatedAt:            BN;
  status:               "Active" | "Paused" | "Archived";
  bump:                 number;
}

export interface SubscriptionAccount {
  publicKey:               PublicKey;
  plan:                    PublicKey;
  subscriber:              PublicKey;
  subscriberTokenAccount:  PublicKey;
  thread:                  PublicKey;
  amountUsdc:              BN;
  intervalSeconds:         BN;
  nextPaymentAt:           BN;
  startedAt:               BN;
  lastPaidAt:              BN;
  lastFailedAt:            BN;
  totalPaid:               BN;
  paymentCount:            BN;
  consecutiveFailures:     number;
  totalFailures:           number;
  status:                  "Active" | "Cancelled" | "Expired" | "PastDue";
  bump:                    number;
}

export interface ProtocolConfigAccount {
  publicKey:      PublicKey;
  admin:          PublicKey;
  treasury:       PublicKey;
  feeBps:         number;
  creationPaused: boolean;
  bump:           number;
}

// ── SDK input params ──────────────────────────────────────────────────────────
export interface CreatePlanParams {
  planId:            number;
  name:              string;
  description?:      string;
  imageUrl?:         string;
  amountUsdc:        number;  // human USDC (e.g. 9.99)
  intervalDays:      number;
  trialDays?:        number;
  gracePeriodDays?:  number;
  maxSubscribers?:   number;  // 0 = unlimited
}

export interface UpdatePlanParams {
  planPubkey:      PublicKey;
  name?:           string;
  description?:    string;
  imageUrl?:       string;
  maxSubscribers?: number;
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
  date:    string;
  revenue: number;
}

export interface SubscriptionTrendPoint {
  date:      string;
  new:       number;
  active:    number;
  cancelled: number;
}

export interface PlanMetrics {
  planPubkey:        string;
  name:              string;
  activeSubscribers: number;
  totalRevenue:      number;
  mrr:               number;
  churnRate:         number;
  successRate:       number;
}

export interface MerchantAnalytics {
  totalRevenue:           number;
  activeSubscriptions:    number;
  cancelledSubscriptions: number;
  expiredSubscriptions:   number;
  totalSubscriptions:     number;
  failedPayments:         number;
  successfulPayments:     number;
  churnRate:              number;
  successRate:            number;
  revenueOverTime:        RevenueDataPoint[];
  subscriptionsTrend:     SubscriptionTrendPoint[];
  plans:                  PlanMetrics[];
}

// Alias used by dashboard app
export type AnalyticsData = MerchantAnalytics;

// ── Execution log ─────────────────────────────────────────────────────────────
export interface ExecutionLogEntry {
  signature:    string;
  slot:         number;
  timestamp:    number;
  type:         "payment_executed" | "payment_failed" | "subscription_created" | "subscription_cancelled";
  subscription: string;
  subscriber:   string;
  plan:         string;
  amount?:      number;
  success:      boolean;
}

// ── SDK config ────────────────────────────────────────────────────────────────
export interface SdkConfig {
  cluster?:    Cluster;
  programId?:  string;
  usdcMint?:   string;
}

// ── Event types ───────────────────────────────────────────────────────────────
export type PaymentExecutedEvent = {
  subscription:  PublicKey;
  plan:          PublicKey;
  subscriber:    PublicKey;
  merchant:      PublicKey;
  grossAmount:   BN;
  protocolFee:   BN;
  netAmount:     BN;
  paymentNumber: BN;
  nextPaymentAt: BN;
  timestamp:     BN;
};

export type PaymentFailedEvent = {
  subscription:        PublicKey;
  subscriber:          PublicKey;
  plan:                PublicKey;
  reason:              Record<string, Record<string, never>>;
  consecutiveFailures: number;
  retryAt:             BN;
  timestamp:           BN;
};

export type SubscriptionCreatedEvent = {
  subscription:   PublicKey;
  plan:           PublicKey;
  subscriber:     PublicKey;
  amountUsdc:     BN;
  trialEndsAt:    BN;
  firstPaymentAt: BN;
  timestamp:      BN;
};

export type SubscriptionCancelledEvent = {
  subscription: PublicKey;
  plan:         PublicKey;
  subscriber:   PublicKey;
  cancelledBy:  PublicKey;
  totalPaid:    BN;
  paymentCount: BN;
  timestamp:    BN;
};
