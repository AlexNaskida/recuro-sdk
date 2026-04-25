import { PublicKey, SystemProgram } from "@solana/web3.js";

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readPublicKeyEnv(key: string): PublicKey | undefined {
  const value = readEnv(key);
  if (!value) return undefined;
  return new PublicKey(value);
}

export const PROGRAM_ID = new PublicKey(
  "45WGwEH24Y9J6ZHYoKiGRET4t4xpu6ESiTeRdhRf9pfr",
);

export const CLOCKWORK_THREAD_PROGRAM_ID = SystemProgram.programId; // unused placeholder

export const SUPPORTED_STABLECOINS = ["USDC", "USDT", "PYUSD"] as const;

/** Default stablecoin mint addresses by cluster */
const usdtDevnetMint = readPublicKeyEnv("RECURO_USDT_MINT_DEVNET");
const pyusdDevnetMint = readPublicKeyEnv("RECURO_PYUSD_MINT_DEVNET");

export const STABLECOIN_MINTS = {
  USDC: {
    mainnet:
      readPublicKeyEnv("RECURO_USDC_MINT_MAINNET") ??
      new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    "mainnet-beta":
      readPublicKeyEnv("RECURO_USDC_MINT_MAINNET_BETA") ??
      new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    devnet:
      readPublicKeyEnv("RECURO_USDC_MINT_DEVNET") ??
      new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    localnet:
      readPublicKeyEnv("RECURO_USDC_MINT_LOCALNET") ??
      new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  },
  USDT: {
    mainnet:
      readPublicKeyEnv("RECURO_USDT_MINT_MAINNET") ??
      new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    "mainnet-beta":
      readPublicKeyEnv("RECURO_USDT_MINT_MAINNET_BETA") ??
      new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    ...(usdtDevnetMint
      ? { devnet: usdtDevnetMint, localnet: usdtDevnetMint }
      : {}),
  },
  PYUSD: {
    mainnet:
      readPublicKeyEnv("RECURO_PYUSD_MINT_MAINNET") ??
      new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"),
    "mainnet-beta":
      readPublicKeyEnv("RECURO_PYUSD_MINT_MAINNET_BETA") ??
      new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"),
    ...(pyusdDevnetMint
      ? { devnet: pyusdDevnetMint, localnet: pyusdDevnetMint }
      : {}),
  },
} as const;

/** Backward-compatible alias kept for existing imports */
export const USDC_MINT = STABLECOIN_MINTS.USDC;

/** PDA seed buffers - must match the Rust program */
export const SEEDS = {
  PLAN: Buffer.from("plan"),
  SUBSCRIPTION: Buffer.from("subscription"),
  THREAD: Buffer.from("payment"),
} as const;

/** Billing limits (mirrors Rust constants) */
export const LIMITS = {
  MIN_AMOUNT_USDC: 0.01,
  MAX_AMOUNT_USDC: 10_000,
  MIN_INTERVAL_DAYS: 1,
  MAX_INTERVAL_DAYS: 365,
  MAX_PLAN_NAME_LEN: 64,
  MAX_PLAN_DESC_LEN: 256,
  MAX_FAILED_PAYMENTS: 3,
  /** SPL delegate allowance multiplier (N billing cycles) */
  DELEGATE_CYCLES: 12,
} as const;

export const USDC_DECIMALS = 6;
export const USDC_FACTOR = 1_000_000; // 10^6
