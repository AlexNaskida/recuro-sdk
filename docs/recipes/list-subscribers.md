# List all subscribers for a plan

Show a merchant the wallets currently subscribed to one of their plans.

## Basic fetch

```typescript
const subs = await sdk.fetchPlanSubscriptions(planPubkey);

console.log(`Total: ${subs.length}`);
console.log(`Active: ${subs.filter((s) => s.status === "Active").length}`);
```

## Group by status

```typescript
const grouped = subs.reduce<Record<string, SubscriptionAccount[]>>((acc, s) => {
  (acc[s.status] ??= []).push(s);
  return acc;
}, {});

// grouped.Active, grouped.Paused, grouped.Cancelled, grouped.Expired
```

## Sort by total revenue contribution

```typescript
const ranked = [...subs].sort((a, b) =>
  b.totalPaid.toNumber() - a.totalPaid.toNumber(),
);

for (const sub of ranked.slice(0, 10)) {
  console.log({
    subscriber: shortenPubkey(sub.subscriber.toBase58()),
    paid: formatUsdc(sub.totalPaid.toNumber() / 1e6),
    payments: sub.paymentCount.toNumber(),
  });
}
```

## React table example

```tsx
function SubscribersTable({ planPubkey }: { planPubkey: PublicKey }) {
  const [subs, setSubs] = useState<SubscriptionAccount[]>([]);

  useEffect(() => {
    sdk.fetchPlanSubscriptions(planPubkey).then(setSubs);
  }, [planPubkey]);

  return (
    <table>
      <thead>
        <tr>
          <th>Subscriber</th>
          <th>Status</th>
          <th>Started</th>
          <th>Total paid</th>
          <th>Failures</th>
        </tr>
      </thead>
      <tbody>
        {subs.map((s) => (
          <tr key={s.publicKey.toBase58()}>
            <td>{shortenPubkey(s.subscriber.toBase58())}</td>
            <td>{s.status}</td>
            <td>{formatDate(s.startedAt.toNumber())}</td>
            <td>${(s.totalPaid.toNumber() / 1e6).toFixed(2)}</td>
            <td>{s.consecutiveFailures}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Performance note

`fetchPlanSubscriptions` uses `getProgramAccounts`. On a public RPC this can be slow at scale (>1k subscribers). Strategies:

- Cache server-side and serve from your own DB (use `onSubscriptionCreated` / `onSubscriptionCancelled` listeners to keep it fresh).
- Switch to a paid RPC (Helius, QuickNode, Triton) — they have indexed `getProgramAccounts`.
- Paginate UI display so the user doesn't wait for 5k rows on every load.
