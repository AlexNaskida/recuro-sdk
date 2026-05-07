# Troubleshooting & FAQ

Things people hit when integrating Recuro for the first time.

## Setup & environment

### "I just installed the SDK and `useWallet` is `undefined`"

You haven't wrapped your app in a `WalletProvider`. See [Integration Guide § React wallet setup](./getting-started/integration-guide.md). Without it, `@solana/wallet-adapter-react` returns nothing.

### "Devnet vs mainnet - which mint should I use?"

The SDK picks the right mint automatically when you set `cluster`. You only need `stablecoinMint` if you're running localnet or a fork.

```typescript
new SubscriptionSdk(provider, { cluster: "devnet" }); // devnet USDC
new SubscriptionSdk(provider, { cluster: "mainnet-beta" }); // mainnet USDC
```

### "How do I test locally without real USDC?"

Spin up a local validator with the program deployed and mint a fake USDC:

```bash
solana-test-validator --reset
spl-token create-token --decimals 6   # use this mint as stablecoinMint
spl-token create-account <MINT>
spl-token mint <MINT> 1000
```

Then init your SDK with `cluster: "localnet"` and `stablecoinMint: <MINT>`.

### "Anchor build fails after editing the program"

Run `yarn anchor:idl` after every `anchor build` so the SDK picks up the new IDL.

## Subscriptions

### "Why is my keeper not picking up payments?"

Check, in order:

1. **Subscription is `Active`.** A `Paused`, `Cancelled`, or `Expired` subscription is invisible to the keeper.
2. **`nextPaymentAt` has actually arrived.** Use `formatRelative(sub.nextPaymentAt.toNumber())`.
3. **Trial period hasn't expired yet.** During trial, no payment is owed.
4. **SPL delegate approval is intact.** If the user revoked it, the keeper will fail with `DelegateRevoked`. Check `subscription.consecutiveFailures`.
5. **Subscriber USDC balance is sufficient.** Otherwise → `InsufficientBalance`.
6. **Keeper process is alive and pointing at the right cluster.** It's stateless - restart it, it catches up.

### "First payment fired immediately. Why?"

Trial period was `0` (or unset). Set `trialDays` when creating the plan.

### "Charged again before the interval elapsed"

This shouldn't happen - Guard explicitly enforces `now >= last_executed_at + period_seconds`. If you observe it, capture the transaction signature and open an issue immediately.

### "Subscription says `Active` but no payments are happening"

Most likely no keeper is running for that cluster. Start one (see [Keeper / Running Your Own](./keeper/running-your-own.md)) or use a hosted keeper service.

### "I cancelled but my wallet still shows the delegate"

`cancelSubscription` revokes the delegate via SPL `revoke`. If your wallet UI is stale, refresh it. Verify on chain with:

```typescript
const account = await getAccount(connection, subscriberTokenAccount);
console.log(account.delegate); // should be null
```

### "ActiveSubscriptionExists" when subscribing

The user already has an `Active` or `Paused` subscription on this plan. Cancel it first, or check `fetchSubscriberSubscriptions` before offering to subscribe again.

## Plans

### "I want to change the price of my plan - how?"

You can't. Price is immutable by design - that's the entire point. Workflow:

1. `createPlan` with the new price.
2. Communicate the change to subscribers.
3. Old subscribers continue at the old price until they cancel.
4. Optionally `archivePlan` on the old plan to stop new sign-ups.

### "Plan creation succeeds but the plan doesn't show up"

You're probably querying with the wrong merchant pubkey. `fetchMerchantPlans` only returns plans where `merchant === passed pubkey`. The `merchantReceiveAddress` is a _different_ field (the payout destination).

### "deletePlan fails with PlanNotArchived"

You must archive a plan before deleting. Two-step: `archivePlan(pubkey)` → `deletePlan(pubkey)`.

### "deletePlan fails with PlanHasActiveSubscribers"

Wait for active subscribers to cancel/expire, or migrate them off, before deleting.

## Payments & balances

### "Subscriber's balance is fine but `InsufficientBalance` fires"

Check the _USDC ATA_, not SOL. `InsufficientBalance` only refers to the stablecoin token account associated with the configured stablecoin mint.

### "Where are protocol fees deducted from?"

The fee is added on top of the plan price. Subscriber pays `plan_amount + fee`. Plan amount goes to merchant (untouched), fee splits 60/40 keeper/treasury.

### "How is the protocol fee calculated?"

`fee = ceil(plan_amount * fee_bps / 10000)`. With default 25 bps, a $100 plan adds $0.25.

## Errors

### "I'm getting an error message I don't recognize"

See the [Error Reference](./errors.md) for every code, what triggers it, and the fix.

### "The error message is just 'Custom program error: 0x1772'"

Anchor encodes errors numerically. The number maps to a variant in the [Error Reference](./errors.md). The full message usually appears in the transaction logs:

```typescript
const tx = await connection.getTransaction(signature, {
  maxSupportedTransactionVersion: 0,
});
console.log(tx?.meta?.logMessages);
```

## Frontend integration

### "My UI doesn't update after a transaction"

The transaction confirmed, but your local cache is stale. Either:

- Re-fetch the affected accounts (`fetchSubscription`, `fetchPlan`).
- Subscribe to events with `sdk.onPaymentExecuted` / `onSubscriptionCreated` and update state when they fire.

### "Phantom popup appears, user signs, but `createSubscription` rejects"

Common causes:

- The user has the wrong network selected in Phantom (mainnet vs devnet).
- USDC ATA doesn't exist yet - Recuro auto-creates it during `createSubscription`, but only if the user has SOL for rent.
- Connection is to the wrong RPC. Verify with `connection.rpcEndpoint`.

### "Privy / embedded wallet - how do I sign with it?"

Use `@privy-io/react-auth/solana`'s `useSignTransaction` and pass the resulting wallet adapter to your `AnchorProvider`. The merchant dashboard does this - see `client/apps/merchant-dashboard/src/hooks/useMerchantWallet.ts` for a working example.

## Performance

### "Fetching all subscriptions is slow"

`fetchPlanSubscriptions` and `fetchSubscriberSubscriptions` use `getProgramAccounts` with filters. On busy RPCs this can take seconds. Mitigations:

- Use a paid RPC (Helius, QuickNode, Triton).
- Cache results client-side and refresh on event-listener triggers, not on every render.
- For dashboards, hydrate once and update incrementally from event listeners.

### "Event listeners drop messages occasionally"

Anchor event subscriptions go over WebSockets. WebSocket reconnects can drop a frame. For audit-grade history, also poll `getSignaturesForAddress` on the program ID and reconcile.

## Versioning & upgrades

### "I bumped the SDK and got TypeScript errors"

See [CHANGELOG.md](../CHANGELOG.md) for breaking changes between versions. The changelog notes type-shape changes explicitly.

### "How do I pin to a specific SDK version?"

```bash
yarn add @recuro/sdk@<version>
# or
npm install @recuro/sdk@<version>
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
