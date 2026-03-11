/**
 * SubscriptionSdk — primary interface for interacting with the
 * solana-subscription program from TypeScript / JavaScript.
 *
 * Usage:
 *   const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
 *   const sdk      = new SubscriptionSdk(provider, { cluster: "devnet" });
 *
 *   const { planPubkey } = await sdk.createPlan({ ... });
 *   const { subscriptionPubkey } = await sdk.createSubscription({ planPubkey });
 */

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  type TransactionSignature,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import IDL from "@/idl.json";
import {
  CLOCKWORK_THREAD_PROGRAM_ID,
  LIMITS,
  PROGRAM_ID,
  USDC_MINT,
} from "./constants";
import { getPlanPDA, getSubscriptionPDA, getThreadPDA } from "./utils/pda";
import { buildAnalytics } from "./utils/analytics";
import { usdcToMicro } from "./utils/format";
import type {
  Cluster,
  CreatePlanParams,
  CreatePlanResult,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  ExecutionLogEntry,
  MerchantAnalytics,
  PlanAccount,
  SdkConfig,
  SubscriptionAccount,
  UpdatePlanParams,
} from "./types";

export class SubscriptionSdk {
  readonly provider: AnchorProvider;
  readonly program: Program;
  readonly usdcMint: PublicKey;
  readonly programId: PublicKey;
  readonly cluster: Cluster;

  constructor(provider: AnchorProvider, config: SdkConfig = {}) {
    this.provider = provider;
    this.cluster = config.cluster ?? "devnet";
    this.programId = config.programId
      ? new PublicKey(config.programId)
      : PROGRAM_ID;
    this.usdcMint = config.usdcMint
      ? new PublicKey(config.usdcMint)
      : USDC_MINT[this.cluster];
    this.program = new Program(IDL as unknown as Idl, this.programId, provider);
  }

  // ──────────────────────────────────────────────────────────
  // PLAN INSTRUCTIONS (merchant)
  // ──────────────────────────────────────────────────────────

  /**
   * Deploy a new Plan PDA on-chain.
   * The plan defines price, billing interval, trial period, and capacity.
   * Price is immutable after deployment to protect subscribers.
   */
  async createPlan(params: CreatePlanParams): Promise<CreatePlanResult> {
    this.validateCreatePlanParams(params);

    const merchant = this.provider.wallet.publicKey;
    const planId = BN.isBN(params.planId)
      ? params.planId
      : new BN(params.planId);

    const [planPubkey] = getPlanPDA(merchant, planId, this.programId);
    const merchantTokenAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      merchant,
    );

    const signature = await this.program.methods
      .createPlan({
        planId,
        name: params.name,
        description: params.description ?? "",
        amountUsdc: usdcToMicro(params.amountUsdc),
        intervalSeconds: new BN(params.intervalDays * 86_400),
        trialSeconds: new BN((params.trialDays ?? 0) * 86_400),
        maxSubscribers: new BN(params.maxSubscribers ?? 0),
      })
      .accounts({
        merchant,
        usdcMint: this.usdcMint,
        merchantTokenAccount,
        plan: planPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: this.provider.opts.commitment });

    return { signature, planPubkey };
  }

  /**
   * Update mutable plan fields: name, description, maxSubscribers.
   * Price and interval cannot be changed after creation.
   */
  async updatePlan(params: UpdatePlanParams): Promise<TransactionSignature> {
    const merchant = this.provider.wallet.publicKey;
    const plan = await this.fetchPlan(params.planPubkey);
    if (!plan) throw new Error("Plan not found");

    return this.program.methods
      .updatePlan({
        name: params.name ?? null,
        description: params.description ?? null,
        maxSubscribers:
          params.maxSubscribers != null ? new BN(params.maxSubscribers) : null,
      })
      .accounts({
        merchant,
        plan: params.planPubkey,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  /** Archive a plan — stops new subscriptions; existing continue. */
  async archivePlan(planPubkey: PublicKey): Promise<TransactionSignature> {
    const merchant = this.provider.wallet.publicKey;
    return this.program.methods
      .archivePlan()
      .accounts({
        merchant,
        plan: planPubkey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  // ──────────────────────────────────────────────────────────
  // SUBSCRIPTION INSTRUCTIONS (subscriber)
  // ──────────────────────────────────────────────────────────

  /**
   * Subscribe to a plan.
   *
   * This instruction:
   *  1. Verifies the plan is Active with available capacity
   *  2. Creates a Subscription PDA (amount copied from Plan — no spoofing)
   *  3. Approves the Subscription PDA as SPL delegate for 12 billing cycles
   *  4. Creates a Clockwork thread for automatic monthly payments
   *
   * The subscriber signs once. All future payments are automatic.
   */
  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<CreateSubscriptionResult> {
    const subscriber = this.provider.wallet.publicKey;
    const plan = await this.fetchPlan(params.planPubkey);
    if (!plan)
      throw new Error(`Plan not found: ${params.planPubkey.toBase58()}`);
    if (plan.status !== "Active")
      throw new Error("Plan is not accepting new subscribers");

    const [subscriptionPubkey, bump] = getSubscriptionPDA(
      params.planPubkey,
      subscriber,
      this.programId,
    );
    const [threadPubkey] = getThreadPDA(subscriptionPubkey);
    const subscriberTokenAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      subscriber,
    );

    // Approve the subscription PDA as SPL delegate (12 cycles)
    const approveAmount = plan.amountUsdc.muln(LIMITS.DELEGATE_CYCLES);
    const approveIx = createApproveInstruction(
      subscriberTokenAccount,
      subscriptionPubkey, // delegate = subscription PDA (program-controlled)
      subscriber,
      BigInt(approveAmount.toString()),
    );

    const signature = await this.program.methods
      .createSubscription(bump)
      .accounts({
        subscriber,
        plan: params.planPubkey,
        subscription: subscriptionPubkey,
        subscriberTokenAccount,
        usdcMint: this.usdcMint,
        thread: threadPubkey,
        clockworkProgram: CLOCKWORK_THREAD_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([approveIx])
      .rpc({ commitment: this.provider.opts.commitment });

    return { signature, subscriptionPubkey };
  }

  /** Pause an active subscription (subscriber or merchant). */
  async pauseSubscription(
    subscriptionPubkey: PublicKey,
  ): Promise<TransactionSignature> {
    const sub = await this._requireSubscription(subscriptionPubkey);
    return this.program.methods
      .pauseSubscription()
      .accounts({
        authority: this.provider.wallet.publicKey,
        subscription: subscriptionPubkey,
        plan: sub.plan,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  /** Resume a paused subscription (subscriber or merchant). */
  async resumeSubscription(
    subscriptionPubkey: PublicKey,
  ): Promise<TransactionSignature> {
    const sub = await this._requireSubscription(subscriptionPubkey);
    return this.program.methods
      .resumeSubscription()
      .accounts({
        authority: this.provider.wallet.publicKey,
        subscription: subscriptionPubkey,
        plan: sub.plan,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  /** Cancel a subscription (subscriber or merchant). Irreversible. */
  async cancelSubscription(
    subscriptionPubkey: PublicKey,
  ): Promise<TransactionSignature> {
    const sub = await this._requireSubscription(subscriptionPubkey);
    return this.program.methods
      .cancelSubscription()
      .accounts({
        authority: this.provider.wallet.publicKey,
        subscription: subscriptionPubkey,
        plan: sub.plan,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  // ──────────────────────────────────────────────────────────
  // FETCH / READ helpers
  // ──────────────────────────────────────────────────────────

  async fetchPlan(planPubkey: PublicKey): Promise<PlanAccount | null> {
    try {
      const raw = await this.program.account.plan.fetch(planPubkey);
      return this._normalizePlan(planPubkey, raw);
    } catch {
      return null;
    }
  }

  async fetchSubscription(
    subscriptionPubkey: PublicKey,
  ): Promise<SubscriptionAccount | null> {
    try {
      const raw =
        await this.program.account.subscription.fetch(subscriptionPubkey);
      return this._normalizeSubscription(subscriptionPubkey, raw);
    } catch {
      return null;
    }
  }

  /** Fetch all plans owned by a merchant wallet. */
  async fetchMerchantPlans(merchant: PublicKey): Promise<PlanAccount[]> {
    const accounts = await this.program.account.plan.all([
      { memcmp: { offset: 8, bytes: merchant.toBase58() } },
    ]);
    return accounts.map((a) => this._normalizePlan(a.publicKey, a.account));
  }

  /** Fetch all subscriptions for a specific plan. */
  async fetchPlanSubscriptions(
    planPubkey: PublicKey,
  ): Promise<SubscriptionAccount[]> {
    const accounts = await this.program.account.subscription.all([
      { memcmp: { offset: 8, bytes: planPubkey.toBase58() } },
    ]);
    return accounts.map((a) =>
      this._normalizeSubscription(a.publicKey, a.account),
    );
  }

  /** Fetch all subscriptions belonging to a subscriber wallet. */
  async fetchSubscriberSubscriptions(
    subscriber: PublicKey,
  ): Promise<SubscriptionAccount[]> {
    const accounts = await this.program.account.subscription.all([
      { memcmp: { offset: 8 + 32, bytes: subscriber.toBase58() } },
    ]);
    return accounts.map((a) =>
      this._normalizeSubscription(a.publicKey, a.account),
    );
  }

  // ──────────────────────────────────────────────────────────
  // ANALYTICS
  // ──────────────────────────────────────────────────────────

  /**
   * Aggregate all on-chain data for a merchant into analytics.
   * Suitable for populating the Merchant Dashboard.
   */
  async getAnalytics(
    merchant: PublicKey,
    recentLogs?: ExecutionLogEntry[],
  ): Promise<MerchantAnalytics> {
    const plans = await this.fetchMerchantPlans(merchant);
    const allSubs: SubscriptionAccount[] = [];

    await Promise.all(
      plans.map(async (plan) => {
        const subs = await this.fetchPlanSubscriptions(plan.publicKey);
        allSubs.push(...subs);
      }),
    );

    return buildAnalytics(plans, allSubs, recentLogs ?? []);
  }

  // ──────────────────────────────────────────────────────────
  // EVENT LISTENERS (real-time)
  // ──────────────────────────────────────────────────────────

  onPaymentExecuted(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("PaymentExecuted", cb);
  }

  onPaymentFailed(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("PaymentFailed", cb);
  }

  onSubscriptionCreated(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionCreated", cb);
  }

  onSubscriptionCancelled(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionCancelled", cb);
  }

  onSubscriptionPaused(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionPaused", cb);
  }

  onSubscriptionResumed(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionResumed", cb);
  }

  onSubscriptionExpired(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionExpired", cb);
  }

  async removeEventListener(id: number): Promise<void> {
    await this.program.removeEventListener(id);
  }

  // ──────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────

  private validateCreatePlanParams(p: CreatePlanParams): void {
    if (!p.name || p.name.trim().length === 0) {
      throw new Error("Plan name is required");
    }
    if (p.name.length > LIMITS.MAX_PLAN_NAME_LEN) {
      throw new Error(
        `Plan name must be ≤ ${LIMITS.MAX_PLAN_NAME_LEN} characters`,
      );
    }
    if (
      p.amountUsdc < LIMITS.MIN_AMOUNT_USDC ||
      p.amountUsdc > LIMITS.MAX_AMOUNT_USDC
    ) {
      throw new Error(
        `Amount must be between $${LIMITS.MIN_AMOUNT_USDC} and $${LIMITS.MAX_AMOUNT_USDC}`,
      );
    }
    if (
      p.intervalDays < LIMITS.MIN_INTERVAL_DAYS ||
      p.intervalDays > LIMITS.MAX_INTERVAL_DAYS
    ) {
      throw new Error(
        `Interval must be between ${LIMITS.MIN_INTERVAL_DAYS} and ${LIMITS.MAX_INTERVAL_DAYS} days`,
      );
    }
  }

  private async _requireSubscription(
    pubkey: PublicKey,
  ): Promise<SubscriptionAccount> {
    const sub = await this.fetchSubscription(pubkey);
    if (!sub) throw new Error(`Subscription not found: ${pubkey.toBase58()}`);
    return sub;
  }

  private _normalizePlan(pubkey: PublicKey, raw: any): PlanAccount {
    return {
      publicKey: pubkey,
      merchant: raw.merchant,
      merchantTokenAccount: raw.merchantTokenAccount,
      planId: raw.planId,
      name: raw.name,
      description: raw.description ?? "",
      imageUrl: raw.imageUrl ?? "",
      amountUsdc: raw.amountUsdc,
      intervalSeconds: raw.intervalSeconds,
      trialSeconds: raw.trialSeconds,
      gracePeriodSeconds: raw.gracePeriodSeconds,
      maxSubscribers: raw.maxSubscribers,
      activeSubscribers: raw.activeSubscribers,
      totalSubscribersEver: raw.totalSubscribersEver,
      grossRevenue: raw.grossRevenue,
      feesPaid: raw.feesPaid,
      successfulPayments: raw.successfulPayments,
      failedPayments: raw.failedPayments,
      totalRevenue: raw.grossRevenue, // alias
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      status: this._decodePlanStatus(raw.status),
      bump: raw.bump,
    };
  }

  private _normalizeSubscription(
    pubkey: PublicKey,
    raw: any,
  ): SubscriptionAccount {
    return {
      publicKey: pubkey,
      plan: raw.plan,
      subscriber: raw.subscriber,
      subscriberTokenAccount: raw.subscriberTokenAccount,
      endedAt: raw.endedAt,
      failedPaymentCount: raw.failedPaymentCount ?? 0,
      amountUsdc: raw.amountUsdc,
      intervalSeconds: raw.intervalSeconds,
      nextPaymentAt: raw.nextPaymentAt,
      startedAt: raw.startedAt,
      lastPaidAt: raw.lastPaidAt,
      lastFailedAt: raw.lastFailedAt,
      totalPaid: raw.totalPaid,
      paymentCount: raw.paymentCount,
      consecutiveFailures: raw.consecutiveFailures ?? 0,
      totalFailures: raw.totalFailures ?? 0,
      status: this._decodeSubStatus(raw.status),
      bump: raw.bump,
    };
  }

  private _decodePlanStatus(status: any): PlanAccount["status"] {
    if (status.active !== undefined) return "Active";
    if (status.paused !== undefined) return "Paused";
    if (status.archived !== undefined) return "Archived";
    return "Active";
  }

  private _decodeSubStatus(status: any): SubscriptionAccount["status"] {
    if (status.active !== undefined) return "Active";
    if (status.pastDue !== undefined) return "Expired";
    if (status.cancelled !== undefined) return "Cancelled";
    if (status.expired !== undefined) return "Expired";
    return "Active";
  }
}
