# renewSubscription()

Renew an expired subscription by re-approving Guard delegate authority.

## Overview

When a subscription expires, the subscriber can renew it to resume automatic payments. Renewal updates the existing subscription by re-approving Guard delegate authority for future cycles.

## Parameters

| Parameter            | Type      | Required | Description                           |
| -------------------- | --------- | -------- | ------------------------------------- |
| `subscriptionPubkey` | PublicKey | ✓        | Address of the expired subscription.  |
| `planPubkey`         | PublicKey | ✓        | Address of the plan for subscription. |

## Returns

```typescript
interface RenewSubscriptionResult {
  subscriptionPubkey: PublicKey; // Same subscription address
  signature: string; // Transaction signature
}
```

## Example

```typescript
const { subscriptionPubkey, signature } = await sdk.renewSubscription(
  new PublicKey("subscription_pubkey"),
  new PublicKey("plan_pubkey"),
);

console.log("Renewed subscription:", subscriptionPubkey.toBase58());
console.log("Tx:", signature);
```

## When to use

- **After auto-expiry** - 3 payment failures triggered auto-expiry; user wants to resume.

## What happens

1. Existing subscription is reactivated from expired state.
2. Guard delegate approval is requested again in Phantom.
3. Billing schedule resumes using subscription settings.
4. Keeper resumes scheduled payment execution.

## Example: renewal flow

```typescript
// Check if subscription expired
const subscription = await sdk.fetchSubscription(subscriptionPubkey);

if (subscription && subscription.status === "Expired") {
  const { signature } = await sdk.renewSubscription(
    subscription.publicKey,
    subscription.plan,
  );
  console.log("Renewed:", signature);
}
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
