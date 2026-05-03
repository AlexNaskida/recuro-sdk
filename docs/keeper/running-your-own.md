# Running Your Own Keeper

Full setup guide to run a Recuro keeper on your server.

## Prerequisites

- Node.js >= 18
- A Solana RPC endpoint (free through QuickRPC, Helius, or paid providers)
- A keypair with SOL for gas (0.1 SOL should last months)

## Step 1: Clone and install

```bash
git clone https://github.com/AlexNaskida/recuro-sdk.git
cd recuro-sdk
yarn install
```

## Step 2: Create keeper keypair

```bash
# Generate a new keypair for the keeper
solana-keygen new --no-bip39-passphrase -o keeper-keypair.json

# Fund it with SOL
solana transfer <your-wallet> keeper-keypair.json 0.1 --url devnet

# Verify
solana balance keeper-keypair.json --url devnet
```

## Step 2b: Create USDC token account (for earning keeper rewards)

Keepers earn **60% of payment fees** for each execution. You need a USDC token account to receive these rewards.

```bash
# Create a USDC ATA for your keeper (on devnet, using devUSDC)
DEV_USDC_MINT=EPjFWaLb3odccxX7VRdL5SVgejAoj3zKYDp4g4vrvkX

spl-token create-account $DEV_USDC_MINT --owner keeper-keypair.json --url devnet

# Example output:
# Creating account 9zQoQUZmC6SqYnU1wfGaCGdGm3c4xfkYKS7jShFjU5JR
# Token account: 9zQoQUZmC6SqYnU1wfGaCGdGm3c4xfkYKS7jShFjU5JR

# Save this address - you'll need it when running the keeper
```

**Earning Rewards:**

- Each time your keeper executes a payment, **60% of the subscription fee** is transferred to your USDC ATA
- Example: On a 0.25% fee for a $100 subscription, your keeper earns $0.15
- Rewards are paid instantly in the same transaction

## Step 3: Configure environment

Create a `.env.local` file in the project root:

```bash
# Required
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
KEEPER_KEYPAIR_PATH=/path/to/keeper-keypair.json
KEEPER_TOKEN_ACCOUNT=9zQoQUZmC6SqYnU1wfGaCGdGm3c4xfkYKS7jShFjU5JR  # Your USDC ATA (from Step 2b)

# Optional
POLL_INTERVAL_MS=30000        # How often to check for payments (default: 30s)
LOG_LEVEL=info                # debug, info, warn, error
WEBHOOK_URL=http://localhost:3000/webhooks  # Optional: notify your server
```

## Step 4: Run the keeper

```bash
node thread/keeper.mjs
```

Expected output:

```
[INFO] Keeper started
[INFO] RPC: https://api.devnet.solana.com
[INFO] Cluster: devnet
[INFO] Keypair: keeper-keypair.json
[INFO] Token account: 9zQoQUZmC6SqYnU1wfGaCGdGm3c4xfkYKS7jShFjU5JR
[INFO] Poll interval: 30000ms
[INFO] Poll cycle 1: Checking subscriptions...
[INFO] Active subscriptions: 42
[INFO] Subscriptions due for payment: 3
[INFO] Executed 2 payments, 1 failed (reason: InsufficientFunds)
[INFO] Earned $0.30 in keeper rewards this cycle
```

## Step 5 (Production): Deploy to Railway

Railway is a simple way to run keepers without managing infrastructure.

```bash
# 1. Connect your GitHub repo to Railway
#    https://railway.app/

# 2. Add environment variables in Railway dashboard:
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
KEEPER_KEYPAIR_PATH=/path/or/base64-encoded-keypair
KEEPER_TOKEN_ACCOUNT=<your-mainnet-usdc-ata>

# 3. Set start command:
yarn && node thread/keeper.mjs

# 4. Deploy
```

## Storing the keypair securely

**Never commit keypair JSON to git.**

Options:

### Option 1: Base64-encoded environment variable

```bash
# Encode keypair
cat keeper-keypair.json | base64 > keypair-b64.txt

# Copy content to Railway secret:
KEEPER_KEYPAIR_B64=<paste-here>

# In keeper code:
const keypairBuffer = Buffer.from(process.env.KEEPER_KEYPAIR_B64, 'base64');
const keypair = Keypair.fromSecretKey(new Uint8Array(keypairBuffer));
```

### Option 2: AWS Secrets Manager

```typescript
import { SecretsManager } from "aws-sdk";

const client = new SecretsManager();
const secret = await client
  .getSecretValue({
    SecretId: "recuro-keeper-keypair",
  })
  .promise();

const keypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(secret.SecretString)),
);
```

## Monitoring

Add log aggregation to catch failures:

```typescript
// In keeper loop
try {
  const result = await executePayments();
  console.log(`Executed ${result.success} payments`);
} catch (error) {
  // Send to monitoring service
  Sentry.captureException(error);
  console.error("Keeper error:", error.message);
}
```

## Setting up alerts

```bash
# Uptime monitoring (e.g., Healthchecks.io)
curl https://hc-ping.com/your-check-id

# In keeper:
// After successful poll
fetch("https://hc-ping.com/your-check-id");
```

## Performance tuning

| Setting            | Default | Tuning                                                                 |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| `POLL_INTERVAL_MS` | 30000   | Lower = more real-time but higher RPC calls. Recommended: 15000–60000. |
| `MAX_BATCH_SIZE`   | 10      | Transactions per batch. Higher = more throughput but higher fees.      |
| `RPC_TIMEOUT`      | 10000   | Timeout per RPC call in ms.                                            |

## Troubleshooting

### Keeper stuck / not processing

```bash
# Check logs
tail -f keeper.log | grep ERROR

# Verify keypair has SOL
solana balance keeper-keypair.json --url <rpc-url>

# Verify RPC connection
curl -X POST <rpc-url> -d '{"jsonrpc":"2.0","method":"getVersion","params":[],"id":1}'
```

### Payments failing

```
[ERROR] executePayment failed: InsufficientFunds
```

Subscriber's USDC balance is too low. Skip and try next cycle.

```
[ERROR] executePayment failed: DelegateRevoked
```

Subscriber revoked SPL approval. Mark subscription for monitoring.

### High gas costs

Batch multiple payments together:

```typescript
const subscriptionsDue = [...].slice(0, 10); // Batch of 10
await batchExecutePayments(subscriptionsDue);
```

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
