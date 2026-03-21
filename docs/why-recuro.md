# Why Recuro

## The problem with current solutions

**Traditional payment processors** (Stripe, Circle) require you to trust a third party with subscriber funds and renewal logic. They don't work well across borders and take 2–3% per transaction.

**Blockchain subscriptions** try to avoid custodians, but most have fatal flaws:

- Subscribers grant unlimited SPL approval, creating systemic risk
- Merchants can change price unilaterally mid-subscription
- Billing is triggered by centralized servers-if they go down, so does your revenue
- Renewal failures pile up silently with no recovery mechanism
- Gas fees are paid by the keeper, creating perverse incentives

## How Recuro fixes it

Recuro is built on four core principles:

### 1. Price immutability

When you create a plan, the price is locked forever in the Plan account. Subscribers know exactly what they're paying, and it cannot change without a new plan.

### 2. Non-custodial with scoped approval

Subscribers approve a delegate limited to the exact plan amount per cycle. One approval, one amount, one merchant. If the delegate is compromised, the blast radius is one cycle.

### 3. Open keeper architecture

Any keeper can execute payments-there's no single point of failure. Merchants can run their own, use a paid service, or redundantly use multiple keepers for insurance.

### 4. Graceful failure with auto-expiry

Three consecutive payment failures (low balance, revoked approval, etc.) automatically expire the subscription and return rent to the subscriber. No stuck subscriptions. No zombie accounts.

## Key differentiators

| Feature               | Recuro                  | Competitors                   |
| --------------------- | ----------------------- | ----------------------------- |
| **Price locked**      | ✅ Immutable            | ❌ Merchant can raise anytime |
| **Custody**           | ✅ Non-custodial        | ❌ Third-party holds funds    |
| **Delegate scope**    | ✅ One amount per cycle | ❌ Often unlimited            |
| **Cancel protection** | ✅ Instant SPL revoke   | ❌ Must contact support       |
| **Keeper model**      | ✅ Open / redundant     | ❌ Single centralized service |
| **Fee**               | ✅ 0.25%                | ❌ 1–2% per transaction       |
| **Keeper rewards**    | ✅ Protocol-funded      | ❌ Keeper absorbs gas cost    |

## For merchants

You avoid platform lock-in. Subscribers are your own NFTs. You can export a list of paying users and build on top, or migrate to a different keeper network at any time.

## For subscribers

You keep your money. You know the price. You can cancel with zero approval from anyone. And if the merchant's keeper gets hacked, your exposure is limited to one payment cycle, not your entire balance.

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
