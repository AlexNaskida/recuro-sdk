# QVAC AI Assistant (Merchant Dashboard)

The merchant dashboard ships with a **local-first AI assistant** that helps you analyze, plan, and operate your subscription business through natural conversation.

## Why local-first

The assistant runs against a **QVAC runtime on `http://localhost:11434/v1`**. No merchant data ever leaves your machine. Your plans, subscribers, revenue figures, and the conversation history itself stay on your computer.

That means:

- 🛡️ **No PII leakage** - subscriber wallets, revenue figures, churn metrics never hit a third-party API.
- ⚡ **No rate limits** - query as often as you want, answers are bounded only by your local hardware.
- 💸 **No per-token billing** - the model runs on your machine.

## What you can do

### 1. Multiple chats, each with its own memory

Open the chat (the floating "AI Chat" button), click `+` for a new chat, or open the history panel (clock icon) to switch between past conversations. Each chat persists its full message history (including reasoning) in `localStorage` keyed by chat ID.

When you reopen a chat, you resume exactly where you left off - including the model's chain-of-thought.

### 2. Business advisory

The assistant has live read access to your on-chain context - plans, subscribers, revenue trends, churn signals, at-risk subscribers, success rates. It can answer:

- _"What's my MRR trend this month?"_
- _"Which plans have the highest churn? What should I change?"_
- _"How can I attract more customers?"_
- _"Which subscribers are at risk of churning?"_
- _"What's my best-performing plan and why?"_

Suggestions are grounded in your real numbers, not generic advice.

### 3. On-chain action execution (with merchant approval)

The assistant can propose and execute four merchant actions:

| Tool                | What it does                    |
| ------------------- | ------------------------------- |
| `create_plan`       | Spin up a new subscription plan |
| `update_plan_price` | Adjust an existing plan's price |
| `delete_plan`       | Archive an existing plan        |
| `launch_promo_code` | Create a discount code          |

**Every proposed action surfaces a confirmation dialog** that summarizes the call and arguments. Nothing executes on-chain until you click **Confirm**. Rejecting (or closing the dialog) is treated as a cancellation; the assistant offers an alternative or asks what to change.

```
You: "Create a Pro plan at $14.99/month"
AI:  Proposes create_plan with name="Pro", amountUsdc=14.99, intervalDays=30
  ↓
[ Confirmation Dialog ]
  Create plan: "Pro"
  Price: $14.99 / 30 days
  [ Cancel ]   [ Confirm ]
  ↓
[ Confirm clicked ]
  ↓
Wallet pops up to sign → on-chain transaction → success
```

### 4. Streaming + reasoning view

Responses stream at a steady typewriter pace so they're readable, with the model's chain-of-thought collapsed behind a "Thought" toggle. Click to expand and see how the model reached its conclusion.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│              Merchant dashboard (browser)                  │
│                                                            │
│  ┌─────────────────────┐     ┌──────────────────────────┐  │
│  │  MerchantAssistant  │────►│  QVAC runtime (local)    │  │
│  │  (chat UI)          │ SSE │  http://localhost:11434  │  │
│  └──────────┬──────────┘     └──────────────────────────┘  │
│             │                                              │
│             │ tool_call: create_plan / update_plan_price   │
│             ▼                                              │
│  ┌─────────────────────┐                                   │
│  │  Confirm dialog     │  merchant must approve            │
│  └──────────┬──────────┘                                   │
│             │ confirmed                                    │
│             ▼                                              │
│  ┌─────────────────────┐     ┌──────────────────────────┐  │
│  │  usePlanActions     │────►│  Solana program          │  │
│  │  (signs via Privy)  │ tx  │  (on-chain execution)    │  │
│  └─────────────────────┘     └──────────────────────────┘  │
│                                                            │
│  Chat state, message history, and per-chat memories are    │
│  stored only in localStorage. No remote sync.              │
└────────────────────────────────────────────────────────────┘
```

The merchant context (plans, subscribers, recent on-chain events, revenue totals, churn signals, at-risk subscribers) is built fresh from your wallet on each conversation turn and inserted into the system prompt - so the model always reasons over current data, not stale snapshots.

## Tips for better answers

- **Be specific about defaults**: "Create a $9.99/mo plan called Starter, no trial, unlimited seats." The clearer the input, the fewer clarifying questions.
- **Use plan names from context**: when referring to existing plans, say their name - the assistant will look up the pubkey from your on-chain state.
- **Trust the confirmation dialog**: it's the source of truth. If the dialog summarizes the wrong thing, click Cancel and rephrase.

## Privacy

- ✅ All inference happens locally - QVAC never makes outbound calls.
- ✅ Chat history is `localStorage` only - clearing browser data wipes it.
- ✅ The system prompt embeds your live merchant context, but that context is also derived locally from your connected wallet's on-chain state.
- ❌ No telemetry. No analytics. No "anonymous usage stats."

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
