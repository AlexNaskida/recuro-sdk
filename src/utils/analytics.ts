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
import { microToUsdc } from "./format";

function momGrowth(current: number, prev: number): number {
  return prev === 0 ? 0 : ((current - prev) / prev) * 100;
}

function isoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().split("T")[0];
}

export function buildAnalytics(
  plans: PlanAccount[],
  allSubs: SubscriptionAccount[],
  recentLogs: ExecutionLogEntry[] = [],
): MerchantAnalytics {
  const now = Math.floor(Date.now() / 1000);
  const monthAgo = now - 30 * 86_400;

  const active = allSubs.filter((s) => s.status === "Active");
  const paused = allSubs.filter((s) => s.status === "Paused");
  const cancelled = allSubs.filter((s) => s.status === "Cancelled");
  const expired = allSubs.filter((s) => s.status === "Expired");

  const newThisMonth = allSubs.filter(
    (s) => s.startedAt.toNumber() >= monthAgo,
  );
  const churned = cancelled.length + expired.length;
  const churnRate = allSubs.length > 0 ? (churned / allSubs.length) * 100 : 0;

  const totalRevenue = allSubs.reduce(
    (sum, s) => sum + microToUsdc(s.totalPaid),
    0,
  );

  const mrr = [...active, ...paused].reduce((sum, sub) => {
    const plan = plans.find((p) => p.publicKey.equals(sub.plan));
    if (!plan) return sum;
    const days = plan.intervalSeconds.toNumber() / 86_400;
    return sum + (microToUsdc(sub.amountUsdc) * 30) / days;
  }, 0);

  const arr = mrr * 12;
  const arpu = active.length > 0 ? mrr / active.length : 0;
  const monthlyChurnRate = churnRate / 100;
  const ltv = monthlyChurnRate > 0 ? arpu / monthlyChurnRate : arpu * 24;

  const totalFailedPayments = allSubs.reduce(
    (sum, s) => sum + (s.consecutiveFailures ?? s.failedPaymentCount ?? 0),
    0,
  );
  const successfulPayments = allSubs.reduce(
    (sum, s) => sum + s.paymentCount.toNumber(),
    0,
  );
  const totalAttempts = totalFailedPayments + successfulPayments;
  const successRate =
    totalAttempts > 0 ? (successfulPayments / totalAttempts) * 100 : 100;

  const planMetrics: PlanMetrics[] = plans.map((p) => {
    const planSubs = allSubs.filter((s) => s.plan.equals(p.publicKey));
    const planActive = planSubs.filter((s) => s.status === "Active");
    const planRevenue = microToUsdc(p.totalRevenue);
    const days = p.intervalSeconds.toNumber() / 86_400;
    const planMrr = planActive.reduce(
      (sum, s) => sum + (microToUsdc(s.amountUsdc) * 30) / days,
      0,
    );
    const planChurned = planSubs.filter(
      (s) => s.status === "Cancelled" || s.status === "Expired",
    ).length;
    const planChurnRate =
      planSubs.length > 0 ? (planChurned / planSubs.length) * 100 : 0;
    const planFailed = planSubs.reduce(
      (sum, s) => sum + (s.consecutiveFailures ?? 0),
      0,
    );
    const planSuccessful = planSubs.reduce(
      (sum, s) => sum + s.paymentCount.toNumber(),
      0,
    );
    const planTotal = planFailed + planSuccessful;
    const planSuccessRate =
      planTotal > 0 ? (planSuccessful / planTotal) * 100 : 100;

    return {
      planPubkey: p.publicKey.toBase58(),
      planId: p.planId.toNumber(),
      name: p.name,
      amountUsdc: microToUsdc(p.amountUsdc),
      intervalDays: days,
      activeSubscribers: planActive.length,
      totalRevenue: planRevenue,
      mrr: planMrr,
      status: p.status,
      conversionRate:
        p.totalSubscribersEver.toNumber() > 0
          ? (planActive.length / p.totalSubscribersEver.toNumber()) * 100
          : 0,
      churnRate: planChurnRate,
      successRate: planSuccessRate,
    };
  });

  const analytics: MerchantAnalytics = {
    totalRevenue,
    monthlyRecurringRevenue: mrr,
    annualRecurringRevenue: arr,
    activeSubscriptions: active.length,
    totalSubscriptions: allSubs.length,
    cancelledSubscriptions: cancelled.length,
    expiredSubscriptions: expired.length,
    pausedSubscriptions: paused.length,
    newSubscriptionsThisMonth: newThisMonth.length,
    churnRate,
    averageRevenuePerUser: arpu,
    lifetimeValue: ltv,
    totalFailedPayments,
    successfulPayments,
    successRate,
    revenueOverTime: buildRevenueTimeline(allSubs),
    subscriptionsTrend: buildSubscriptionsTrend(allSubs),
    churnOverTime: buildChurnTimeline(allSubs),
    mrr: buildMRRTimeline(plans, allSubs),
    planMetrics,
    recentExecutions: recentLogs,
    // legacy aliases
    plans: planMetrics,
    failedPayments: totalFailedPayments,
  };

  return analytics;
}

function buildRevenueTimeline(subs: SubscriptionAccount[]): RevenueDataPoint[] {
  const byDate = new Map<string, number>();
  for (const sub of subs) {
    if (sub.paymentCount.toNumber() === 0) continue;
    const date = isoDate(sub.lastPaidAt.toNumber());
    byDate.set(date, (byDate.get(date) ?? 0) + microToUsdc(sub.amountUsdc));
  }
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;
  return sorted.map(([date, daily]) => {
    cumulative += daily;
    return { date, revenue: daily, daily, cumulative };
  });
}

function buildSubscriptionsTrend(
  subs: SubscriptionAccount[],
): SubscriptionTrendPoint[] {
  const byDate = new Map<
    string,
    { new: number; cancelled: number; expired: number }
  >();
  for (const sub of subs) {
    const d = isoDate(sub.startedAt.toNumber());
    if (!byDate.has(d)) byDate.set(d, { new: 0, cancelled: 0, expired: 0 });
    byDate.get(d)!.new++;
    const endedAt = sub.endedAt?.toNumber?.() ?? 0;
    if (endedAt > 0) {
      const e = isoDate(endedAt);
      if (!byDate.has(e)) byDate.set(e, { new: 0, cancelled: 0, expired: 0 });
      if (sub.status === "Cancelled") byDate.get(e)!.cancelled++;
      if (sub.status === "Expired") byDate.get(e)!.expired++;
    }
  }
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumActive = 0;
  return sorted.map(([date, v]) => {
    cumActive = Math.max(0, cumActive + v.new - v.cancelled - v.expired);
    return {
      date,
      active: cumActive,
      new: v.new,
      cancelled: v.cancelled,
      expired: v.expired,
      net: v.new - v.cancelled - v.expired,
    };
  });
}

function buildChurnTimeline(subs: SubscriptionAccount[]): ChurnDataPoint[] {
  const byDate = new Map<string, { churned: number; total: number }>();
  for (const sub of subs) {
    const d = isoDate(sub.startedAt.toNumber());
    if (!byDate.has(d)) byDate.set(d, { churned: 0, total: 0 });
    byDate.get(d)!.total++;
    const endedAt = sub.endedAt?.toNumber?.() ?? 0;
    if (
      endedAt > 0 &&
      (sub.status === "Cancelled" || sub.status === "Expired")
    ) {
      const e = isoDate(endedAt);
      if (!byDate.has(e)) byDate.set(e, { churned: 0, total: 0 });
      byDate.get(e)!.churned++;
    }
  }
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let runningTotal = 0;
  return sorted.map(([date, v]) => {
    runningTotal += v.total;
    return {
      date,
      churned: v.churned,
      churnRate: runningTotal > 0 ? (v.churned / runningTotal) * 100 : 0,
    };
  });
}

function buildMRRTimeline(
  plans: PlanAccount[],
  subs: SubscriptionAccount[],
): MRRDataPoint[] {
  const byDate = new Map<string, number>();
  for (const sub of subs) {
    if (sub.paymentCount.toNumber() === 0) continue;
    const plan = plans.find((p) => p.publicKey.equals(sub.plan));
    if (!plan) continue;
    const days = plan.intervalSeconds.toNumber() / 86_400;
    const date = isoDate(sub.lastPaidAt.toNumber());
    byDate.set(
      date,
      (byDate.get(date) ?? 0) + (microToUsdc(sub.amountUsdc) * 30) / days,
    );
  }
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([date, mrr], i) => ({
    date,
    mrr,
    growth: momGrowth(mrr, i > 0 ? sorted[i - 1][1] : 0),
  }));
}
