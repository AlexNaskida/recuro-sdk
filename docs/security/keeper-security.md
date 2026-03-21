# Keeper Security

Why the open keeper model is secure and how to audit keeper operators.

## Open keeper design rationale

Recuro does **not** hardcode a single keeper address. Instead, any keeper can execute payments. This design choice has security and operational advantages.

### Centralized keeper risks

If a single keeper were hardcoded:

- **Single point of failure** - Hacker takes it down → all payments stop
- **Censorship** - Malicious keeper can selectively skip payments
- **Bottleneck** - One keeper limits throughput; network effects don't scale

### Open keeper benefits

- **Redundancy** - 3 independent keepers mean hacker must compromise all 3
- **Permissionless** - Anyone can deploy a keeper; governance by participation
- **Throughput** - Multiple keepers compete to execute → higher throughput
- **Trust minimization** - No need to trust a single operator

## Keeper address non-hardcoding

The Subscription Program does not check _who_ calls `executePayment()`. It only checks:

1. Subscription exists
2. `nextPaymentAt` has passed
3. SPL delegate is active
4. Plan account is valid and unchanged

```rust
pub fn execute_payment(ctx: Context<ExecutePayment>) -> Result<()> {
    // No check on ctx.signer (keeper).
    // Anyone can call this.

    let subscription = account_loader::<Subscription>(...)?;
    require!(subscription.nextPaymentAt <= clock.unix_timestamp,
        error!("NotDueYet"));

    // proceed with transfer...
}
```

**Security implications**:

- ✅ Prevents keeper monopoly
- ✅ Enables keeper diversity
- ⚠️ Any entity _could_ execute, so you must verify on-chain constraints are sufficient

## Auditing keeper operators

If you run your own keeper, you're responsible for it. If you contract a third-party keeper, audit them:

### Code review checklist

- [ ] Keeper only calls `executePayment()`
- [ ] Keeper does not modify Plan or Subscription PDAs
- [ ] Keeper does not call `updatePlan()` or other admin instructions
- [ ] Reducer logic is deterministic and matches spec
- [ ] Logs are immutable (sent to secure backend, not local disk)
- [ ] Private keys are never logged or transmitted

### Deployment checklist

- [ ] Keeper runs in isolated network (no internet except to RPC)
- [ ] Keeper keypair is stored in hardware wallet or KMS
- [ ] Keeper process runs with minimal privileges (not root)
- [ ] RPC endpoint is from trusted provider (not a honeypot)
- [ ] Monitoring is in place (alerts on unexpected behavior)
- [ ] Backup keeper exists in separate region

### Test before mainnet

1. **Devnet trial** - Run keeper on devnet for 1 week
2. **Testnet with real RPC** - Move to testnet, use mainnet RPC
3. **Monitor anomalies** - Watch for:
   - High error rates
   - Unusual transaction amounts
   - RPC latency spikes
   - Keeper restart loops

## Keeper transparency

A trustworthy keeper operator should publish:

- **Code repository** - Open source on GitHub
- **Keypair rotation policy** - Keyp is cycled every 90 days
- **Payment history** - Indexer dashboard showing all executed tx
- **Uptime SLA** - Commit to 99.9% availability
- **Audit reports** - Third-party security audit
- **Incident postmortem** - If something goes wrong

## Multi-keeper setup (recommended)

Run or contract with 2–3 independent keepers:

| Keeper    | Operator    | Region  | RPC Provider |
| --------- | ----------- | ------- | ------------ |
| Primary   | Merchant    | US-East | Helius       |
| Backup    | Third-party | EU      | Triton       |
| Insurance | Third-party | APAC    | Magic Eden   |

Each keeper is independent. If one is compromised:

- Other two continue executing
- Revenue loss is temporary (until malicious keeper is identified and revoked)
- Switching to new keeper takes minutes

## Keeper incentives

Keepers are paid by the protocol:

```
Per-payment reward = (protocol_fee_percentage × amount) / keeper_count
```

If 3 keepers execute (and 2 fail), all 3 share payment events in logs. The protocol's indexer rewards all 3 equally.

**Effect**: Keepers are incentivized to:

- Execute quickly (first wins)
- Execute reliably (uptime)
- Execute transparently (audit-friendly)

**Not incentivized** to:

- Censor payments (another keeper executes)
- Steal funds (amount is immutable on-chain)
- Spam transactions (each payment costs keeper gas; reward must exceed gas)

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
