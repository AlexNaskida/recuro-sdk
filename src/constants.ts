import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("SUBxxxx1111111111111111111111111111111111111");

export const CLOCKWORK_THREAD_PROGRAM_ID = new PublicKey(
  "CLoCKi11111111111111111111111111111111111111"
);

/** USDC mint addresses */
export const USDC_MINT = {
  mainnet: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  devnet:  new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  localnet: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
} as const;

/** PDA seed buffers — must match the Rust program */
export const SEEDS = {
  PLAN:         Buffer.from("plan"),
  SUBSCRIPTION: Buffer.from("subscription"),
  THREAD:       Buffer.from("payment"),
} as const;

/** Billing limits (mirrors Rust constants) */
export const LIMITS = {
  MIN_AMOUNT_USDC:       0.01,
  MAX_AMOUNT_USDC:       10_000,
  MIN_INTERVAL_DAYS:     1,
  MAX_INTERVAL_DAYS:     365,
  MAX_PLAN_NAME_LEN:     64,
  MAX_PLAN_DESC_LEN:     256,
  MAX_FAILED_PAYMENTS:   3,
  /** SPL delegate allowance multiplier (N billing cycles) */
  DELEGATE_CYCLES:       12,
} as const;

export const USDC_DECIMALS = 6;
export const USDC_FACTOR   = 1_000_000; // 10^6
