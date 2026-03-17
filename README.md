# Solana Subscription SDK

TypeScript SDK for interacting with the on-chain Solana subscription program.

This package is published as `@solana-subscription/sdk` and provides:

- A single high-level client class: `SubscriptionSdk`
- Typed account and analytics models
- PDA helpers
- Formatting and conversion helpers
- Analytics aggregation helpers

## Package Overview

- Package name: `@solana-subscription/sdk`
- Entry point: `src/index.ts`
- Output formats: CommonJS + ESM + typings
- Build tool: `tsup`

## SDK Directory Map

```text
sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Public exports barrel
│   ├── SubscriptionSdk.ts       # Main client class
│   ├── constants.ts             # Program IDs, seeds, limits, USDC metadata
│   ├── types.ts                 # Shared SDK types and interfaces
│   ├── idl.json                 # Anchor IDL used by Program client
│   └── utils/
│       ├── pda.ts               # PDA derivation utilities
│       ├── format.ts            # Formatting and conversion helpers
│       └── analytics.ts         # Merchant analytics aggregation
└── dist/                        # Generated output (build artifact)
```

## Public Exports

`src/index.ts` exports:

- `SubscriptionSdk`
- All constants from `constants.ts`
- All types from `types.ts`
- All functions from `utils/pda.ts`
- All functions from `utils/format.ts`
- All functions from `utils/analytics.ts`

## Installation

```bash
yarn add @solana-subscription/sdk
```

Peer dependencies expected in your app:

- `@coral-xyz/anchor`
- `@solana/web3.js`
- `@solana/spl-token`
- `react` (optional)

## Quick Start

```ts
import { AnchorProvider } from "@coral-xyz/anchor";
import { SubscriptionSdk } from "@solana-subscription/sdk";

const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const sdk = new SubscriptionSdk(provider, {
  cluster: "devnet",
  // optional: programId, usdcMint
});

const { signature, planPubkey } = await sdk.createPlan({
  planId: 1,
  name: "Pro",
  amountUsdc: 9.99,
  intervalDays: 30,
});
```

## File-by-File Documentation

## src/constants.ts

Central constants shared by the SDK.

Exports:

- `PROGRAM_ID: PublicKey`
  - Default subscription program ID used by the SDK.
- `CLOCKWORK_THREAD_PROGRAM_ID: PublicKey`
  - Placeholder currently set to `SystemProgram.programId`.
- `USDC_MINT`
  - Cluster-specific USDC mint addresses for `mainnet`, `mainnet-beta`, `devnet`, `localnet`.
- `SEEDS`
  - PDA seed buffers:
    - `PLAN = "plan"`
    - `SUBSCRIPTION = "subscription"`
    - `THREAD = "payment"`
- `LIMITS`
  - Business/range limits mirrored from program-side expectations:
    - minimum/maximum amount
    - minimum/maximum interval
    - max string lengths
    - max failed payments
    - delegate cycle count
- `USDC_DECIMALS = 6`
- `USDC_FACTOR = 1_000_000`

## src/types.ts

Strongly-typed interfaces for SDK inputs, outputs, events, and analytics.

Main groups:

- Account models:
  - `PlanAccount`
  - `SubscriptionAccount`
  - `ProtocolConfigAccount`
- Input parameter models:
  - `CreatePlanParams`
  - `UpdatePlanParams`
  - `CreateSubscriptionParams`
- Result models:
  - `TxResult`
  - `CreatePlanResult`
  - `CreateSubscriptionResult`
- Analytics models:
  - `MerchantAnalytics`
  - `PlanMetrics`
  - timeline point types
- Event payload types:
  - `PaymentExecutedEvent`
  - `PaymentFailedEvent`
  - `SubscriptionCreatedEvent`
  - `SubscriptionCancelledEvent`
- Config:
  - `SdkConfig`

Status enums represented as string unions:

- Plan: `"Active" | "Paused" | "Archived"`
- Subscription: `"Active" | "Paused" | "Cancelled" | "Expired"`

## src/utils/pda.ts

Deterministic address helpers.

### getPlanPDA(merchant, planId, programId?)

- Derives plan PDA from seeds:
  - `["plan", merchant, planId_le_8_bytes]`
- Returns tuple:
  - `[PublicKey, bump]`

### getSubscriptionPDA(plan, subscriber, programId?)

- Derives subscription PDA from seeds:
  - `["subscription", plan, subscriber]`
- Returns tuple:
  - `[PublicKey, bump]`

### getThreadPDA(subscriptionPubkey, clockworkProgramId?)

- Derives thread PDA-like address using:
  - `["payment", subscriptionPubkey, "payment"]`
- Returns tuple:
  - `[PublicKey, bump]`

## src/utils/format.ts

Formatting and conversion helpers.

### microToUsdc(micro)

- Converts micro-USDC units to decimal USDC number.

### usdcToMicro(usdc)

- Converts decimal USDC to micro-USDC `BN`.

### formatUsdc(usdc, decimals?)

- Formats numeric USDC as localized currency string.

### shortenPubkey(pubkey, chars?)

- Returns shortened pubkey string format, for example `AbCd...xYz1`.

### intervalToLabel(seconds)

- Converts billing interval seconds to labels like Daily, Weekly, Monthly.

### formatDate(unixSeconds)

- Formats Unix seconds to locale date.

### formatDateTime(unixSeconds)

- Formats Unix seconds to locale date-time.

### formatRelative(unixSeconds)

- Relative time text, for example "2 hours ago" or "in 3 days".

### formatChartDate(iso)

- Converts `YYYY-MM-DD` into short chart label such as `Jan 24`.

### momGrowth(current, previous)

- Computes month-over-month percentage growth.

### solscanTxUrl(signature, cluster)

- Builds cluster-aware Solscan transaction URL.

## src/utils/analytics.ts

Analytics aggregation from plan/subscription account snapshots.

### buildAnalytics(plans, allSubs, recentLogs?)

- Produces full `MerchantAnalytics` summary including:
  - Revenue, MRR, ARR
  - Churn and subscription status counts
  - Success/failure metrics
  - Per-plan metrics
  - Trend timelines
  - Optional recent execution logs

Internal timeline builders are also defined in this file:

- Revenue timeline
- Subscription trend timeline
- Churn timeline
- MRR timeline

## src/SubscriptionSdk.ts

Primary class used by integrators.

## Constructor

### new SubscriptionSdk(provider, config?)

Inputs:

- `provider: AnchorProvider`
- `config?: SdkConfig`
  - `cluster` default: `"devnet"`
  - optional `programId`
  - optional `usdcMint`

Sets:

- `provider`
- `program`
- `programId`
- `usdcMint`
- `cluster`

## Plan Methods

### createPlan(params)

Creates a plan account PDA on-chain.

Behavior:

- Validates plan params
- Derives plan PDA
- Resolves merchant USDC ATA
- Sends `createPlan` instruction

Returns:

- `{ signature, planPubkey }`

### updatePlan(params)

Updates mutable plan fields.

Mutable fields:

- `name`
- `description`
- `maxSubscribers`

Returns:

- transaction signature

### archivePlan(planPubkey)

Archives a plan to block new subscriptions.

Returns:

- transaction signature

## Subscription Methods

### createSubscription(params)

Creates subscriber plan linkage and delegate approval flow on-chain.

Behavior:

- Validates plan exists and is active
- Derives subscription PDA
- Resolves subscriber USDC ATA
- Sends `createSubscription`

Returns:

- `{ signature, subscriptionPubkey }`

### pauseSubscription(subscriptionPubkey)

Pauses an active subscription.

Returns:

- transaction signature

### resumeSubscription(subscriptionPubkey)

Resumes a paused subscription.

Returns:

- transaction signature

### renewSubscription(subscriptionPubkey, planPubkey)

Renews an expired subscription.

Returns:

- `{ signature, subscriptionPubkey }`

### cancelSubscription(subscriptionPubkey)

Cancels a subscription.

Returns:

- transaction signature

## Read Methods

### fetchPlan(planPubkey)

Fetches and normalizes plan account.

Returns:

- `PlanAccount | null`

### fetchSubscription(subscriptionPubkey)

Fetches and normalizes subscription account.

Returns:

- `SubscriptionAccount | null`

### fetchMerchantPlans(merchant)

Fetches all plans where `merchant` matches account memcmp filter.

Returns:

- `PlanAccount[]`

### fetchPlanSubscriptions(planPubkey)

Fetches all subscriptions associated with a plan.

Returns:

- `SubscriptionAccount[]`

### fetchSubscriberSubscriptions(subscriber)

Fetches subscriptions by subscriber key using `getProgramAccounts`.

Notes:

- Uses explicit `dataSize` filter to avoid stale account layout decode failures.

Returns:

- `SubscriptionAccount[]`

## Analytics Method

### getAnalytics(merchant, recentLogs?)

Builds merchant analytics by:

- loading all merchant plans
- loading all plan subscriptions
- calling `buildAnalytics`

Returns:

- `MerchantAnalytics`

## Event Listener Methods

All listener registration methods return listener id `number`.

- `onPaymentExecuted(cb)`
- `onPaymentFailed(cb)`
- `onSubscriptionCreated(cb)`
- `onSubscriptionCancelled(cb)`
- `onSubscriptionPaused(cb)`
- `onSubscriptionResumed(cb)`
- `onSubscriptionExpired(cb)`
- `removeEventListener(id)`

## Validation and Normalization Internals

Class includes private helpers for:

- Create plan parameter validation against `LIMITS`
- Account normalization from raw Anchor account data to SDK interfaces
- Status decoding from enum object shape to string union values

## Build and Development Scripts

From `sdk/package.json`:

```bash
# Build ESM + CJS + d.ts
yarn build

# Watch mode
yarn dev

# Type check
yarn type-check

# Lint
yarn lint

# Test
yarn test
```

## Notes and Conventions

- Amounts in account structs are generally `BN` micro-USDC values.
- Use `microToUsdc` and `usdcToMicro` for conversions.
- Public methods typically return either:
  - transaction signature string
  - structured result including signature and derived PDA
- Methods that fetch missing accounts usually return `null` rather than throwing.
- Instruction methods generally throw on validation or RPC failures.

## Compatibility

- Solana Web3 v1 API style
- Anchor client-based interaction
- Works in Node and frontend contexts where wallet/provider are available

## Troubleshooting

- If account decode fails, ensure your IDL and deployed program layout match.
- If token account errors occur, verify the expected USDC mint for your selected cluster.
- If subscriptions are not found for a wallet, ensure subscriber pubkey filter offset assumptions match current account layout.
