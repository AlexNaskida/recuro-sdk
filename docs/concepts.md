# Core Concepts

A single page that explains the moving parts of Recuro and how they fit together. Read this once and the rest of the SDK will feel obvious.

## The four on-chain accounts

```
┌──────────────────────────────────────────────────────────────┐
│                      Solana Blockchain                       │
│                                                              │
│   ProtocolConfig PDA  ── admin, fee bps, treasury, paused    │
│                                                              │
│   ┌─────────────┐       ┌──────────────────────────────┐     │
│   │  Plan PDA   │◄──────│   Subscription Program       │     │
│   │  (per plan) │       │     (Recuro / Anchor)        │     │
│   └─────────────┘       └──────────────┬───────────────┘     │
│                                         │                    │
│   ┌──────────────────────┐              │ CPI                │
│   │  Subscription PDA    │◄─────────────┤                    │
│   │  (per subscriber)    │              │                    │
│   └──────────────────────┘              │ CPI                │
│                                         ▼                    │
│   ┌──────────────────────┐   ┌─────────────────────────┐     │
│   │      Guard PDA       │──►│   SPL Token transfer    │     │
│   │  (per subscription)  │   │  subscriber → merchant  │     │
│   └──────────────────────┘   └─────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

| PDA                | Owned by             | Purpose                                                                                             |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------- |
| **ProtocolConfig** | Subscription program | Singleton. Stores admin, treasury ATA, fee basis points, pause flag.                                |
| **Plan**           | Subscription program | One per plan. Stores merchant, price, interval, trial, capacity, status.                            |
| **Subscription**   | Subscription program | One per (plan, subscriber). Stores billing state: `nextPaymentAt`, `consecutiveFailures`, `status`. |
| **Guard**          | Recuro Guard program | One per subscription. Holds the immutable transfer parameters and authorizes payments via CPI.      |

## The actors

| Actor          | Role                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Merchant**   | Creates plans, archives them, withdraws revenue. Signs only at plan-management time, never at payment time.                |
| **Subscriber** | Approves a Guard PDA as scoped SPL delegate, then walks away. Funds remain in their wallet between payments.               |
| **Keeper**     | Stateless permissionless bot. Polls subscriptions, calls `executePayment` when due. Anyone can run one. Earns 60% of fees. |
| **Guard**      | An on-chain program that gatekeeps every transfer. Enforces caller, amount, destination, and interval.                     |

## The lifecycle of one payment

```
T = 0  Subscriber calls createSubscription
       ├─ Subscription PDA created
       ├─ Guard PDA initialized with (amount, interval, merchant_receive)
       └─ SPL delegate approval → Guard PDA (scoped, not unlimited)

T = trialDays  Keeper notices nextPaymentAt has arrived
               └─ Keeper calls executePayment

executePayment flow:
   1. Subscription program verifies subscriber + plan state
   2. CPI → Guard.authorize_payment
        ✓ caller == recuro_program ?
        ✓ now >= last_executed_at + period_seconds ?
        ✓ destination ATA == merchant_receive ?
        ✓ transfer amount := guard.amount_per_period
   3. SPL token transfer (subscriber → merchant)
   4. Subscription program transfers fee to treasury
   5. nextPaymentAt += intervalSeconds
```

## Glossary

| Term                  | Meaning                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **PDA**               | Program-Derived Address. A deterministic address controlled by a program rather than a private key.                                      |
| **CPI**               | Cross-Program Invocation. Calling another Solana program from within a program (used by Subscription → Guard).                           |
| **Scoped delegate**   | An SPL token approval bounded to a specific delegate, fixed amount, and revokable any time. Recuro never grants unlimited approval.      |
| **Guard PDA**         | A per-subscription escrow-like authority. Holds the immutable transfer parameters and is the _actual_ delegate of the subscriber's USDC. |
| **Keeper**            | An external bot that triggers `executePayment`. Stateless, permissionless, replaceable.                                                  |
| **Interval / period** | Billing cadence in seconds (or days at the SDK layer). Locked at plan creation; cannot change.                                           |
| **Trial period**      | Optional initial offset before the first payment fires.                                                                                  |
| **Grace period**      | Buffer after a failed payment before the failure counter increments.                                                                     |
| **Auto-expiry**       | Subscription automatically transitions to `Expired` after 3 consecutive payment failures.                                                |
| **Micro-USDC**        | The on-chain unit. 1 USDC = 1,000,000 micro-USDC. The SDK converts for you via `usdcToMicro` / `microToUsdc`.                            |
| **`amountUsdc`**      | At the SDK layer, the _human_ number (e.g. `9.99`). On-chain it's stored as micro-USDC.                                                  |
| **bump**              | The PDA bump seed. Stored on-chain so the program can re-derive addresses without re-searching.                                          |

## Statuses you'll encounter

**Plan** → `Active` | `Paused` | `Archived`
**Subscription** → `Active` | `Paused` | `Cancelled` | `Expired`

## Why this design

- **Price spoofing is impossible** - transfer amount is read from Guard state, not from anything the caller passes.
- **Custody stays with the user** - no smart-contract escrow, no protocol-held funds.
- **Reversal is instant** - SPL revoke in any wallet stops every future payment in one click.
- **No central scheduler** - replace one keeper, run two, run zero (and pay manually) - the protocol doesn't care.

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
