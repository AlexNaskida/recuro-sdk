import type {
  PlanAccount,
  SubscriptionAccount,
  MerchantAnalytics,
  PlanMetrics,
  RevenueDataPoint,
  SubscriptionTrendPoint,
  ChurnDataPoint,
  MRRDataPoint,
  ExecutionLogEntry,
} from "../types";
import { microToUsdc, momGrowth } from "./format";

/**
 * Aggregate on-chain plan and subscription data into analytics.
 * This runs client-side; no off-chain indexer required.
 */
export function buildAnalytics(
  plans: PlanAccount[],
  allSubs: SubscriptionAccount[],
  recentLogs: ExecutionLogEntry[] = []
): MerchantAnalytics {
  const now     = Math.floor(Date.now() / 1000);
  const monthAgo = now - 30 * 86_400;

  // ── Subscription counts ──────────────────────────────────
  const active    = allSubs.filter((s) => s.status === "Active");
  const paused    = allSubs.filter((s) => s.status === "Paused");
  const cancelled = allSubs.filter((s) => s.status === "Cancelled");
  const expired   = allSubs.filter((s) => s.status === "Expired");

  const newThisMonth = allSubs.filter(
    (s) => s.startedAt.toNumber() >= monthAgo
  );

  const churned = cancelled.length + expired.length;
  const churnRate =
    allSubs.length > 0 ? (churned / allSubs.length) * 100 : 0;

  // ── Revenue metrics ──────────────────────────────────────
  const totalRevenue = allSubs.reduce(
    (sum, s) => sum + microToUsdc(s.totalPaid),
    0
  );

  // MRR = sum of (amount * 30 / interval_days) for each active/paused sub
  const mrr = [...active, ...paused].reduce((sum, sub) => {
    // We don't have interval from sub directly — derive from plan
    const plan = plans.find((p) => p.publicKey.equals(sub.plan));
    if (!plan) return sum;
    const days = plan.intervalSeconds.toNumber() / 86_400;
    return sum + (microToUsdc(sub.amountUsdc) * 30) / days;
  }, 0);

  const arr = mrr * 12;

  const arpu = active.length > 0 ? mrr / active.length : 0;

  // LTV estimate = ARPU / churn_rate (if churn_rate > 0)
  const monthlyChurnRate = churnRate / 100;
  const ltv = monthlyChurnRate > 0 ? arpu / monthlyChurnRate : arpu * 24;

  const totalFailedPayments = allSubs.reduce(
    (sum, s) => sum + s.failedPaymentCount,
    0
  );

  // ── Time series ──────────────────────────────────────────
  const revenueOverTime      = buildRevenueTimeline(allSubs);
  const subscriptionsTrend   = buildSubscriptionsTrend(allSubs);
  const churnOverTime        = buildChurnTimeline(allSubs);
  const mrrTimeSeries        = buildMRRTimeline(plans, allSubs);

  // ── Per-plan breakdown ───────────────────────────────────
  const planMetrics: PlanMetrics[] = plans.map((p) => {
    const planSubs = allSubs.filter((s) => s.plan.equals(p.publicKey));
    const planActive = planSubs.filter((s) => s.status === "Active");
    const planRevenue = microToUsdc(p.totalRevenue);
    const days = p.intervalSeconds.toNumber() / 86_400;
    const planMrr = planActive.reduce(
      (sum, s) => sum + (microToUsdc(s.amountUsdc) * 30) / days,
      0
    );

    return {
      planPubkey:        p.publicKey.toBase58(),
      planId:            p.planId.toNumber(),
      name:              p.name,
      amountUsdc:        microToUsdc(p.amountUsdc),
      intervalDays:      days,
      activeSubscribers: planActive.length,
      totalRevenue:      planRevenue,
      mrr:               planMrr,
      status:            p.status,
      conversionRate:
        p.totalSubscribersEver.toNumber() > 0
          ? (planActive.length / p.totalSubscribersEver.toNumber()) * 100
          : 0,
    };
  });

  return {
    totalRevenue,
    monthlyRecurringRevenue:   mrr,
    annualRecurringRevenue:    arr,
    activeSubscriptions:       active.length,
    totalSubscriptions:        allSubs.length,
    cancelledSubscriptions:    cancelled.length,
    expiredSubscriptions:      expired.length,
    pausedSubscriptions:       paused.length,
    newSubscriptionsThisMonth: newThisMonth.length,
    churnRate,
    averageRevenuePerUser:     arpu,
    lifetimeValue:             ltv,
    totalFailedPayments,
    revenueOverTime,
    subscriptionsTrend,
    churnOverTime,
    mrr: mrrTimeSeries,
    planMetrics,
    recentExecutions: recentLogs,
  };
}

// ── Private helpers ───────────────────────────────────────────

function isoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().split("T")[0];
}

function buildRevenueTimeline(subs: SubscriptionAccount[]): RevenueDataPoint[] {
  const byDate = new Map<string, number>();

  for (const sub of subs) {
    if (sub.paymentCount.toNumber() === 0) continue;
    const date   = isoDate(sub.lastPaidAt.toNumber());
    const amount = microToUsdc(sub.amountUsdc);
    byDate.set(date, (byDate.get(date) ?? 0) + amount);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;
  return sorted.map(([date, daily]) => {
    cumulative += daily;
    return { date, daily, cumulative };
  });
}

function buildSubscriptionsTrend(
  subs: SubscriptionAccount[]
): SubscriptionTrendPoint[] {
  const byDate = new Map<
    string,
    { new: number; cancelled: number; expired: number }
  >();

  for (const sub of subs) {
    const startDate = isoDate(sub.startedAt.toNumber());
    if (!byDate.has(startDate)) {
      byDate.set(startDate, { new: 0, cancelled: 0, expired: 0 });
    }
    byDate.get(startDate)!.new++;

    if (sub.endedAt.toNumber() > 0) {
      const endDate = isoDate(sub.endedAt.toNumber());
      if (!byDate.has(endDate)) {
        byDate.set(endDate, { new: 0, cancelled: 0, expired: 0 });
      }
      if (sub.status === "Cancelled") byDate.get(endDate)!.cancelled++;
      if (sub.status === "Expired")   byDate.get(endDate)!.expired++;
    }
  }

  // Build cumulative active count
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumActive = 0;
  return sorted.map(([date, v]) => {
    cumActive = cumActive + v.new - v.cancelled - v.expired;
    return {
      date,
      active:    Math.max(0, cumActive),
      new:       v.new,
      cancelled: v.cancelled,
      expired:   v.expired,
      net:       v.new - v.cancelled - v.expired,
    };
  });
}

function buildChurnTimeline(subs: SubscriptionAccount[]): ChurnDataPoint[] {
  const byDate = new Map<string, { churned: number; total: number }>();

  for (const sub of subs) {
    const startDate = isoDate(sub.startedAt.toNumber());
    if (!byDate.has(startDate)) byDate.set(startDate, { churned: 0, total: 0 });
    byDate.get(startDate)!.total++;

    if (
      sub.endedAt.toNumber() > 0 &&
      (sub.status === "Cancelled" || sub.status === "Expired")
    ) {
      const endDate = isoDate(sub.endedAt.toNumber());
      if (!byDate.has(endDate)) byDate.set(endDate, { churned: 0, total: 0 });
      byDate.get(endDate)!.churned++;
    }
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let runningTotal = 0;
  return sorted.map(([date, v]) => {
    runningTotal += v.total;
    const churnRate = runningTotal > 0 ? (v.churned / runningTotal) * 100 : 0;
    return { date, churned: v.churned, churnRate };
  });
}

function buildMRRTimeline(
  plans: PlanAccount[],
  subs: SubscriptionAccount[]
): MRRDataPoint[] {
  const byDate = new Map<string, number>();

  for (const sub of subs) {
    if (sub.paymentCount.toNumber() === 0) continue;
    const date   = isoDate(sub.lastPaidAt.toNumber());
    const plan   = plans.find((p) => p.publicKey.equals(sub.plan));
    if (!plan) continue;
    const days   = plan.intervalSeconds.toNumber() / 86_400;
    const mrrContrib = (microToUsdc(sub.amountUsdc) * 30) / days;
    byDate.set(date, (byDate.get(date) ?? 0) + mrrContrib);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([date, mrr], i) => {
    const prev    = i > 0 ? sorted[i - 1][1] : 0;
    const growth  = momGrowth(mrr, prev);
    return { date, mrr, growth };
  });
}
