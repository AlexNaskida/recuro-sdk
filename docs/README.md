# Welcome to Recuro

**Non-custodial recurring stablecoin subscriptions on Solana.**

Subscribe once. Pay automatically.

Recuro enables users to manage recurring stablecoin payments that are controlled entirely by them, with support for common Solana dollar assets such as USDC, USDT, and PYUSD. Funds stay in subscriber wallets until payment executes on-chain. Subscriptions are trustless-no backend required.

## What you can build

- **SaaS platforms** with monthly or annual billing
- **Membership programs** with cancellation anytime
- **Content platforms** with subscription gates
- **Service marketplaces** with recurring billing

## Key guarantees

- **Non-custodial** - Subscriber funds never leave their wallet
- **Cancel instantly** - Revoke approval in Phantom, zero future exposure
- **Price locked** - Plan price cannot change mid-subscription
- **Guard-enforced execution** - Amount, interval, caller, and destination are enforced on-chain by Guard
- **Open keeper network** - Multiple keepers ensure reliable payment execution

## Get started

- [**Quick Start**](./getting-started/quick-start.md) - Subscribe to your first plan in 5 minutes
- [**Core Concepts**](./concepts.md) - Architecture, PDAs, and the lifecycle of one payment
- [**Why Recuro**](./why-recuro.md) - See how we're different from competitors
- [**Integration Guide**](./getting-started/integration-guide.md) - Full walkthrough with React examples

## Reference

- [**Types**](./types.md) - every exported type, interface, and enum
- [**Errors**](./errors.md) - every error code, what triggers it, how to fix
- [**Recipes**](./recipes/README.md) - copy-pasteable how-tos for common tasks
- [**Troubleshooting**](./troubleshooting.md) - FAQ for the issues people hit first

## Install now

```bash
yarn add @recuro/sdk
npm install @recuro/sdk
pnpm add @recuro/sdk
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
