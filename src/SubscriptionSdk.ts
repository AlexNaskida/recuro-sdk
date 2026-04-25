/**
 * SubscriptionSdk - primary interface for interacting with the
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
  // createApproveInstruction,
} from "@solana/spl-token";
import IDL from "./idl.json";
import { LIMITS, PROGRAM_ID, STABLECOIN_MINTS } from "./constants";
import { getPlanPDA, getSubscriptionPDA } from "./utils/pda";
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
  StablecoinSymbol,
  SubscriptionAccount,
  UpdatePlanParams,
} from "./types";

function deriveAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export class SubscriptionSdk {
  readonly provider: AnchorProvider;
  readonly program: Program & { account: any; methods: any };
  readonly usdcMint: PublicKey;
  readonly stablecoin: StablecoinSymbol;
  readonly programId: PublicKey;
  readonly cluster: Cluster;

  constructor(provider: AnchorProvider, config: SdkConfig = {}) {
    this.provider = provider;
    this.cluster = config.cluster ?? "devnet";
    this.stablecoin = config.stablecoin ?? "USDC";
    this.programId = config.programId
      ? new PublicKey(config.programId)
      : PROGRAM_ID;

    const explicitMint = config.stablecoinMint ?? config.usdcMint;
    const stablecoinMints = STABLECOIN_MINTS[this.stablecoin] as Partial<
      Record<Cluster, PublicKey>
    >;
    const defaultMint = stablecoinMints[this.cluster];

    if (!explicitMint && !defaultMint) {
      throw new Error(
        `No default ${this.stablecoin} mint configured for cluster ${this.cluster}. Pass stablecoinMint explicitly in SdkConfig.`,
      );
    }

    this.usdcMint = new PublicKey(explicitMint ?? defaultMint!.toBase58());

    const idlWithAddress = {
      ...(IDL as Record<string, unknown>),
      address: this.programId.toBase58(),
    };
    this.program = new Program(
      idlWithAddress as unknown as Idl,
      provider,
    ) as any;
  }

  // ──────────────────────────────────────────────────────────
  // PLAN INSTRUCTIONS (merchant)
  // ──────────────────────────────────────────────────────────

  /**
   * Create a new subscription plan. (Merchant only)
   *
   * Deploys a plan PDA that subscribers can join. The plan defines the
   * price, billing interval, trial period, and capacity.
   *
   * **Critical constraint:** Price is IMMUTABLE after creation to protect
   * subscribers from surprise increases. Choose carefully.
   *
   * **Constraints:**
   * - amountUsdc: $0.01 to $100,000 per cycle
   * - intervalDays: 1 to 365 days
   * - planId: Unique per merchant (used in PDA seeds)
   * - name: Max 64 characters
   *
   * **After creation:**
   * - Plan status is "Active" and ready for subscriptions
   * - Merchant can update name, description, capacity, receive address
   * - Merchant cannot change price or interval
   * - Merchant can archive to stop new signups
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param params - Plan parameters
   * @returns Plan address and transaction signature
   * @throws "Plan name is required" if name is empty
   * @throws "Plan name must be ≤ 64 characters" if name too long
   * @throws "Amount must be between $0.01 and $100,000" if invalid
   * @throws "Interval must be between 1 and 365 days" if invalid
   *
   * @deprecated For subscription-only integrations, ignore this method
   *
   * @example
   * ```typescript
   * const { planPubkey } = await sdk.createPlan({
   *   planId: 1,
   *   name: "Professional",
   *   amountUsdc: 99.99,
   *   intervalDays: 30,
   *   trialDays: 7,
   * });
   * ```
   */
  async createPlan(params: CreatePlanParams): Promise<CreatePlanResult> {
    this.validateCreatePlanParams(params);

    const merchant = this.provider.wallet.publicKey;
    const planId = BN.isBN(params.planId)
      ? params.planId
      : new BN(params.planId);

    const [planPubkey] = getPlanPDA(merchant, planId, this.programId);
    const merchantTokenAccount = deriveAssociatedTokenAddress(
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
        merchantReceiveAddress: params.merchantReceiveAddress
          ? new PublicKey(params.merchantReceiveAddress)
          : null,
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
   * Update mutable plan fields. (Merchant only)
   *
   * Change plan name, description, capacity, or merchant receive address.
   *
   * **Cannot change:**
   * - Price (amountUsdc)
   * - Billing interval (intervalSeconds)
   * - Trial period (trialSeconds)
   *
   * These are locked to protect existing subscribers.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param params - Update parameters
   * @returns Transaction signature
   * @throws "Plan not found" if planPubkey is invalid
   * @throws Error if caller is not the merchant
   *
   * @deprecated For subscription-only integrations, ignore this method
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
        merchantReceiveAddress: params.merchantReceiveAddress
          ? new PublicKey(params.merchantReceiveAddress)
          : null,
      })
      .accounts({
        merchant,
        plan: params.planPubkey,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  /**
   * Archive a plan. (Merchant only)
   *
   * Stops accepting new subscriptions while preserving existing ones.
   * Existing subscribers continue to be charged automatically.
   * Useful for retiring old plans.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param planPubkey - Plan to archive
   * @returns Transaction signature
   * @throws "Plan not found" if planPubkey is invalid
   * @throws Error if caller is not the merchant
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
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

  /**
   * Unarchive a plan. (Merchant only)
   *
   * Reactivates an archived plan to accept new subscriptions again.
   * Existing subscriptions are unaffected.
   *
   * @param planPubkey - Plan to unarchive
   * @returns Transaction signature
   * @throws "Plan not found" if planPubkey is invalid
   * @throws Error if caller is not the merchant
   * @throws Error if plan is not archived
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  async unarchivePlan(planPubkey: PublicKey): Promise<TransactionSignature> {
    const merchant = this.provider.wallet.publicKey;
    return this.program.methods
      .unarchivePlan()
      .accounts({
        merchant,
        plan: planPubkey,
      })
      .rpc({ commitment: this.provider.opts.commitment });
  }

  /**
   * Delete a plan permanently. (Merchant only)
   *
   * Permanently removes a plan from the blockchain. This is irreversible.
   * Requirements:
   * - Plan must be archived first
   * - Plan must have no active subscribers
   *
   * Rent from the closed account is returned to the merchant.
   *
   * @param planPubkey - Plan to delete
   * @returns Transaction signature
   * @throws "Plan not found" if planPubkey is invalid
   * @throws Error if caller is not the merchant
   * @throws Error if plan is not archived
   * @throws Error if plan has active subscribers
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  async deletePlan(planPubkey: PublicKey): Promise<TransactionSignature> {
    const merchant = this.provider.wallet.publicKey;
    return this.program.methods
      .deletePlan()
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
   * Subscribe to a plan as a subscriber.
   *
   * This creates a subscription account and approves a limited SPL delegate
   * that allows automated payments. The subscriber signs once; all future
   * payments happen automatically on-chain without additional approvals.
   *
   * **What happens:**
   * 1. Verifies the plan is Active with available capacity
   * 2. Creates a Subscription PDA (amount locked to plan price-no spoofing)
   * 3. Approves the Subscription PDA as SPL delegate for up to 12 billing cycles
   * 4. First payment scheduled 1 cycle from now (or after trial if applicable)
   *
   * **Subscriber must have:**
   * - Sufficient USDC to cover first payment (or trial period must be active)
   * - SOL for transaction fees (~0.005 SOL)
   *
   * **Security:**
   * - Funds stay in subscriber's wallet until payment executes
   * - Delegate can only transfer plan's locked amount, only to merchant
   * - Cancel anytime to immediately revoke delegate
   *
   * @param params - Subscription parameters
   * @param params.planPubkey - PublicKey of the plan to subscribe to
   * @returns Promise with subscription address and transaction signature
   *
   * @throws "Plan not found" if plan doesn't exist
   * @throws "Plan is not accepting new subscribers" if paused/archived
   * @throws Error if wallet lacks sufficient USDC or SOL
   *
   * @example
   * ```typescript
   * const { subscriptionPubkey, signature } = await sdk.createSubscription({
   *   planPubkey: new PublicKey("..."),
   * });
   * console.log(`Subscribed! TX: ${signature}`);
   * ```
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

    const [subscriptionPubkey] = getSubscriptionPDA(
      params.planPubkey,
      subscriber,
      this.programId,
    );

    // const subscriberTokenAccount = await getAssociatedTokenAddress(
    //   this.usdcMint,
    //   subscriber,
    // );
    const subscriberTokenAccount = deriveAssociatedTokenAddress(
      this.usdcMint,
      subscriber,
    );

    const signature = await this.program.methods
      .createSubscription()
      .accountsPartial({
        subscriber,
        usdcMint: this.usdcMint,
        plan: params.planPubkey,
        subscription: subscriptionPubkey,
        subscriberTokenAccount,
      })
      .rpc({ commitment: this.provider.opts.commitment });

    return { signature, subscriptionPubkey };
  }

  /**
   * Pause an active subscription temporarily.
   *
   * Stops scheduled payments without cancelling. The delegate approval
   * remains active and can be resumed at any time. Useful for users
   * who want to take a break but plan to re-enable later.
   *
   * **Effects:**
   * - Subscription status becomes "Paused"
   * - Keeper stops attempting payments
   * - Delegate remains approved (no signature needed to resume)
   * - Trial period pauses as well
   *
   * **Who can pause:**
   * - The subscriber (original signer)
   * - The merchant (plan creator)
   *
   * **To resume:** Call `resumeSubscription()` with same address
   *
   * @param subscriptionPubkey - Address of subscription to pause
   * @returns Transaction signature
   *
   * @throws "Subscription not found" if address is invalid
   * @throws Error if caller is unauthorized
   *
   * @example
   * ```typescript
   * const signature = await sdk.pauseSubscription(subscriptionPubkey);
   * console.log(`Paused: ${signature}`);
   * ```
   */
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

  /**
   * Resume a paused subscription.
   *
   * Re-activates a paused subscription where it left off. The delegate
   * remains active, so no new approval is needed. Next payment time is
   * recalculated.
   *
   * **Effects:**
   * - Subscription status becomes "Active"
   * - Keeper resumes attempting payments on schedule
   * - Next payment time recalculated
   * - Delegate approval remains valid
   *
   * **Who can resume:**
   * - The subscriber (original signer)
   * - The merchant (plan creator)
   *
   * @param subscriptionPubkey - Address of subscription to resume
   * @returns Transaction signature
   *
   * @throws "Subscription not found" if address is invalid
   * @throws "Subscription is not paused" if already active
   *
   * @example
   * ```typescript
   * const signature = await sdk.resumeSubscription(subscriptionPubkey);
   * console.log(`Resumed: ${signature}`);
   * ```
   */
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

  /**
   * Renew an expired subscription.
   *
   * After 12 billing cycles, the SPL delegate expires and the subscription
   * enters "Expired" status. Call this to re-approve the delegate for
   * another 12 cycles and resume payments.
   *
   * **When renewal is needed:**
   * - Subscription status is "Expired"
   * - Keeper has stopped attempting payments
   * - Delegate no longer has authority to transfer
   *
   * **Effects:**
   * - Re-approves SPL delegate for 12 new cycles
   * - Subscription status returns to "Active"
   * - Next payment time recalculated
   *
   * **Who can renew:**
   * - Only the subscriber (original signer)
   *
   * @param subscriptionPubkey - Address of expired subscription
   * @param planPubkey - Address of the plan
   * @returns Transaction signature and subscription address
   *
   * @throws "Subscription not found" if address is invalid
   * @throws Error if subscriber lacks sufficient USDC
   *
   * @example
   * ```typescript
   * const { signature } = await sdk.renewSubscription(
   *   subscriptionPubkey,
   *   planPubkey
   * );
   * console.log(`Renewed: ${signature}`);
   * ```
   */
  async renewSubscription(
    subscriptionPubkey: PublicKey,
    planPubkey: PublicKey,
  ): Promise<{ signature: string; subscriptionPubkey: PublicKey }> {
    const subscriber = this.provider.wallet.publicKey;

    const subscriberTokenAccount = deriveAssociatedTokenAddress(
      this.usdcMint,
      subscriber,
    );

    const signature = await this.program.methods
      .renewSubscription()
      .accountsPartial({
        subscriber,
        plan: planPubkey,
        subscription: subscriptionPubkey,
        subscriberTokenAccount,
        usdcMint: this.usdcMint,
      })
      .rpc({ commitment: this.provider.opts.commitment });

    return { signature, subscriptionPubkey };
  }

  /**
   * Cancel a subscription permanently.
   *
   * **This is irreversible.** Immediately revokes the SPL delegate and
   * stops all future payments. No way to undo-user will need to subscribe
   * to the plan again to restart.
   *
   * **Effects:**
   * - Subscription status becomes "Cancelled"
   * - SPL delegate is immediately revoked
   * - Zero future payment exposure
   * - Keeper stops attempting payments
   * - Cannot be resumed; must subscribe again
   *
   * **Who can cancel:**
   * - The subscriber (original signer)
   * - The merchant (plan creator) - useful if customer disputes charge
   *
   * **Security guarantee:**
   * - Even if keeper is compromised, no payments can execute after cancel
   * - Even if merchant is compromised, subscriber can cancel immediately
   *
   * @param subscriptionPubkey - Address of subscription to cancel
   * @returns Transaction signature
   *
   * @throws "Subscription not found" if address is invalid
   * @throws Error if caller is unauthorized
   *
   * @example
   * ```typescript
   * const signature = await sdk.cancelSubscription(subscriptionPubkey);
   * console.log(`Cancelled: ${signature}`);
   * console.log(`Delegate revoked. No future payments.`);
   * ```
   */
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

  /**
   * Fetch a plan by its public key.
   *
   * Retrieves plan details including price, interval, trial period, and
   * subscription stats. Returns null if plan doesn't exist.
   *
   * @param planPubkey - Address of the plan
   * @returns Plan account data, or null if not found
   *
   * @example
   * ```typescript
   * const plan = await sdk.fetchPlan(planAddress);
   * if (!plan) {
   *   console.error("Plan not found");
   * } else {
   *   console.log(`${plan.name}: $${plan.amountUsdc / 1e6} USDC`);
   * }
   * ```
   */
  async fetchPlan(planPubkey: PublicKey): Promise<PlanAccount | null> {
    try {
      const raw = await this.program.account.plan.fetch(planPubkey);
      return this._normalizePlan(planPubkey, raw);
    } catch {
      return null;
    }
  }

  /**
   * Fetch a subscription by its public key.
   *
   * Retrieves subscription details including plan reference, status,
   * next payment time, and payment history. Returns null if subscription
   * doesn't exist.
   *
   * @param subscriptionPubkey - Address of the subscription
   * @returns Subscription account data, or null if not found
   *
   * @example
   * ```typescript
   * const sub = await sdk.fetchSubscription(subscriptionAddress);
   * if (!sub) {
   *   console.error("Subscription not found");
   * } else {
   *   console.log(`Status: ${sub.status}`);
   *   console.log(`Next payment: ${new Date(sub.nextPaymentAt.toNumber() * 1000)}`);
   * }
   * ```
   */
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

  /**
   * Fetch all plans created by a merchant.
   *
   * Retrieves all active and archived plans for a merchant wallet.
   * Useful for displaying available subscription options in a UI.
   *
   * @param merchant - Merchant wallet address
   * @returns Array of plan accounts
   *
   * @example
   * ```typescript
   * const merchantPlans = await sdk.fetchMerchantPlans(
   *   new PublicKey("merchant_address")
   * );
   * console.log(`Merchant has ${merchantPlans.length} plans`);
   * ```
   */
  async fetchMerchantPlans(merchant: PublicKey): Promise<PlanAccount[]> {
    try {
      const accounts = await this.program.account.plan.all([
        { memcmp: { offset: 8, bytes: merchant.toBase58() } },
      ]);
      return accounts.map((a: { publicKey: PublicKey; account: any }) =>
        this._normalizePlan(a.publicKey, a.account),
      );
    } catch {
      // Fallback path: tolerate mixed historical layouts by decoding per account.
      const connection = this.provider.connection;
      const rawAccounts = await connection.getProgramAccounts(this.programId, {
        filters: [{ memcmp: { offset: 8, bytes: merchant.toBase58() } }],
      });

      const results: PlanAccount[] = [];
      for (const { pubkey, account } of rawAccounts) {
        try {
          const decoded = (this.program.coder.accounts as any).decode(
            "plan",
            account.data,
          );
          results.push(this._normalizePlan(pubkey, decoded));
        } catch {
          // Skip stale or incompatible account layouts.
        }
      }

      return results;
    }
  }

  /**
   * Fetch all subscriptions for a specific plan. (Analytics)
   *
   * Retrieves all active and inactive subscriptions belonging to a plan.
   * Useful for merchant dashboards and analytics.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param planPubkey - Plan to get subscriptions for
   * @returns Array of subscription accounts
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  async fetchPlanSubscriptions(
    planPubkey: PublicKey,
  ): Promise<SubscriptionAccount[]> {
    const accounts = await this.program.account.subscription.all([
      { memcmp: { offset: 8, bytes: planPubkey.toBase58() } },
    ]);
    return accounts.map((a: { publicKey: PublicKey; account: any }) =>
      this._normalizeSubscription(a.publicKey, a.account),
    );
  }

  /**
   * Fetch all subscriptions for a subscriber wallet.
   *
   * Retrieves all active, paused, cancelled, and expired subscriptions
   * belonging to a wallet. Use this to populate a "My Subscriptions"
   * view in your app.
   *
   * @param subscriber - Subscriber wallet address
   * @returns Array of subscription accounts
   *
   * @example
   * ```typescript
   * const mySubscriptions = await sdk.fetchSubscriberSubscriptions(
   *   wallet.publicKey
   * );
   * console.log(`You have ${mySubscriptions.length} subscriptions`);
   * mySubscriptions.forEach((sub) => {
   *   console.log(`  - Status: ${sub.status}, Next payment: ${sub.nextPaymentAt}`);
   * });
   * ```
   */
  async fetchSubscriberSubscriptions(
    subscriber: PublicKey,
  ): Promise<SubscriptionAccount[]> {
    const connection = this.provider.connection;
    const rawAccounts = await connection.getProgramAccounts(this.programId, {
      filters: [
        { dataSize: 173 },
        { memcmp: { offset: 8 + 32, bytes: subscriber.toBase58() } },
      ],
    });

    const results: SubscriptionAccount[] = [];
    for (const { pubkey, account } of rawAccounts) {
      try {
        const decoded = (this.program.coder.accounts as any).decode(
          "subscription",
          account.data,
        );
        results.push(this._normalizeSubscription(pubkey, decoded));
      } catch {
        // skip stale layout
      }
    }
    return results;
  }

  // ──────────────────────────────────────────────────────────
  // ANALYTICS
  // ──────────────────────────────────────────────────────────

  /**
   * Get aggregated merchant analytics. (Dashboard)
   *
   * Fetches all plans and subscriptions for a merchant and computes
   * aggregated metrics: total revenue, active subscribers, success rates.
   * Perfect for merchant dashboards.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param merchant - Merchant wallet address
   * @param recentLogs - Optional payment execution logs
   * @returns Aggregated merchant analytics
   *
   * @deprecated For subscription-only integrations, ignore this method
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

  /**
   * Listen for successful payment executions.
   *
   * Called each time a payment is successfully transferred to the merchant.
   * Useful for:
   * - Real-time webhook notifications
   * - Payment analytics and logging
   * - UI updates showing recent transactions
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   *
   * @example
   * ```typescript
   * const listenerId = sdk.onPaymentExecuted((event, slot, signature) => {
   *   console.log(`Payment: ${event.subscriber} paid ${event.amountUsdc / 1e6} USDC`);
   * });
   * // Later: sdk.removeEventListener(listenerId);
   * ```
   */
  onPaymentExecuted(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("PaymentExecuted", cb);
  }

  /**
   * Listen for failed payment executions.
   *
   * Called when a payment fails to execute (e.g., insufficient balance,
   * insufficient delegate authority). Useful for:
   * - Alerting merchants to payment failures
   * - Customer support and follow-up
   * - Retry logic and analytics
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  onPaymentFailed(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("PaymentFailed", cb);
  }

  /**
   * Listen for new subscription creations.
   *
   * Called when a subscriber signs up for a plan. Useful for:
   * - Real-time notifications
   * - Customer welcome flows
   * - Analytics tracking
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  onSubscriptionCreated(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionCreated", cb);
  }

  /**
   * Listen for subscription cancellations.
   *
   * Called when a subscriber or merchant cancels a subscription.
   * Useful for churn analytics and retention campaigns.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  onSubscriptionCancelled(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionCancelled", cb);
  }

  /**
   * Listen for subscription pauses.
   *
   * Called when a subscription is paused. Useful for tracking
   * temporary cancellations and churn analysis.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  onSubscriptionPaused(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionPaused", cb);
  }

  /**
   * Listen for subscription resumptions.
   *
   * Called when a paused subscription is resumed.
   * Useful for win-back tracking.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
  onSubscriptionResumed(
    cb: (event: any, slot: number, signature: string) => void,
  ): number {
    return this.program.addEventListener("SubscriptionResumed", cb);
  }

  /**
   * Listen for subscription expirations.
   *
   * Called when a subscription's delegate expires after 12 cycles.
   * Useful for renewal reminders.
   *
   * See PLAN_MANAGEMENT.md for complete merchant API.
   *
   * @param cb - Callback function receiving (event, slot, signature)
   * @returns Listener ID (use with removeEventListener)
   *
   * @deprecated For subscription-only integrations, ignore this method
   */
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
      merchantReceiveAddress: raw.merchantReceiveAddress,
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
    if (status.paused !== undefined) return "Paused";
    if (status.pastDue !== undefined) return "Expired";
    if (status.cancelled !== undefined) return "Cancelled";
    if (status.expired !== undefined) return "Expired";
    return "Active";
  }
}
