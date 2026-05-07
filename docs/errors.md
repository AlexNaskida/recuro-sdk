# Error Reference

Every error code Recuro can throw, what triggers it, and how to fix it.

When the SDK rethrows an Anchor program error, the message contains the variant name (e.g. `PlanNotActive`). Match against `error.message.includes("PlanNotActive")`.

## Plan validation

| Code                   | Meaning                                                                | Common cause                                                                 |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `PlanNotActive`        | Plan is not in `Active` status.                                        | Subscribing to a paused or archived plan.                                    |
| `PlanArchived`         | Plan is archived; no new subscribers accepted.                         | Plan was archived after you cached its pubkey.                               |
| `PlanAtCapacity`       | Plan reached `maxSubscribers`.                                         | The merchant capped seats and they're all filled.                            |
| `PlanNameTooLong`      | Plan name > 64 chars.                                                  | Truncate before calling `createPlan`.                                        |
| `PlanDescTooLong`      | Plan description > 256 chars.                                          | Truncate before calling `createPlan`.                                        |
| `InvalidInterval`      | Billing interval outside [1, 365] days.                                | Pass `intervalDays` between 1 and 365.                                       |
| `InvalidAmount`        | Amount outside [0.01, 10,000] USDC.                                    | Pass a value within bounds.                                                  |
| `TrialExceedsInterval` | Trial period longer than the billing interval.                         | Reduce `trialDays` to ≤ `intervalDays`.                                      |

## Subscription validation

| Code                       | Meaning                                                                | Common cause                                                                  |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ActiveSubscriptionExists` | Subscriber already has an active or paused subscription on this plan.  | Cancel the existing one before creating a new one for the same plan.          |
| `SubscriptionNotActive`    | Subscription is not in `Active` status.                                | Trying to pause / charge a cancelled or expired subscription.                 |
| `SubscriptionPaused`       | Action requires an active subscription, but it's paused.               | Resume first via `resumeSubscription`.                                        |
| `AlreadyCancelled`         | Subscription is already cancelled.                                     | Idempotent error — safe to ignore.                                            |
| `AlreadyExpired`           | Subscription has already auto-expired after repeated failures.         | Use `renewSubscription` to start fresh.                                       |
| `SubscriptionNotTerminal`  | Subscription must be `Cancelled` or `Expired` to close (delete).       | Cancel first, then close.                                                     |
| `InTrialPeriod`            | Tried to charge during the trial.                                      | Wait until trial expires.                                                     |
| `PaymentNotDue`            | `nextPaymentAt` hasn't arrived yet.                                    | Keeper raced — usually self-resolves on the next poll.                        |

## Authorization

| Code                    | Meaning                                                  | Common cause                                                              |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `UnauthorizedMerchant`  | Caller is not the plan's merchant.                       | Wrong wallet connected, or wrong plan pubkey.                             |
| `UnauthorizedActor`     | Action requires subscriber or merchant.                  | Trying to cancel someone else's subscription.                             |

## Token / balance

| Code                            | Meaning                                                          | Common cause                                                                       |
| ------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `InsufficientBalance`           | Subscriber's USDC ATA doesn't have enough USDC for this payment. | Top up; auto-expiry will fire after 3 consecutive failures.                        |
| `InvalidSubscriberTokenAccount` | The provided ATA doesn't belong to the subscriber.               | The frontend passed the wrong owner — recompute with `getAssociatedTokenAddress`.  |
| `InvalidMerchantTokenAccount`   | Merchant ATA doesn't match the plan's `merchantReceiveAddress`.  | The plan was created with an explicit receive address; use that, not the merchant. |
| `InvalidTreasuryTokenAccount`   | Treasury ATA doesn't belong to protocol treasury.                | SDK / config drift. Update to latest `@recuro/sdk`.                                |
| `InvalidMint`                   | Token mint isn't the configured stablecoin mint.                 | Wrong cluster (devnet vs mainnet) or wrong stablecoin in `SdkConfig`.              |

## Protocol config

| Code         | Meaning                                       | Common cause                                       |
| ------------ | --------------------------------------------- | -------------------------------------------------- |
| `FeeTooHigh` | Admin tried to set fee bps above 500 (= 5%).  | Hardcap. Set fee ≤ 500 bps.                        |

## Arithmetic

| Code                   | Meaning                                  | Common cause                                                |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `ArithmeticOverflow`   | A `u64` would overflow.                  | Pathological input (e.g. interval × failures > u64).        |
| `ArithmeticUnderflow`  | A subtraction would go negative.         | State corruption or trying to refund more than was paid in. |

## Plan deletion

| Code                          | Meaning                                                  | Common cause                                                       |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `PlanNotArchived`             | Plan must be archived before it can be deleted.          | Call `archivePlan` first, then `deletePlan`.                       |
| `PlanHasActiveSubscribers`    | Plan still has active subscribers; cannot delete.        | Wait for them to cancel/expire, or migrate them off, then delete.  |

## Pattern: handling errors in your app

```typescript
try {
  await sdk.createSubscription({ planPubkey });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("PlanNotActive") || msg.includes("PlanArchived")) {
    toast.error("This plan is no longer available.");
  } else if (msg.includes("PlanAtCapacity")) {
    toast.error("This plan is full. Try another one.");
  } else if (msg.includes("ActiveSubscriptionExists")) {
    toast.error("You already have a subscription to this plan.");
  } else if (msg.includes("InsufficientBalance")) {
    toast.error("Not enough USDC. Top up your wallet and try again.");
  } else {
    toast.error("Subscription failed. Try again or contact support.");
  }
}
```

## Tip: surface error names cleanly

Anchor errors include the program name and a numeric code. To get just the variant name:

```typescript
function extractErrorName(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/Error Code: (\w+)\.|"([\w]+)"/);
  return match?.[1] ?? match?.[2] ?? null;
}
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
