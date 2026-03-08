import BN from "bn.js";
import { USDC_FACTOR } from "../constants";

/** Convert micro-USDC BN to a human-readable number */
export function microToUsdc(micro: BN | number | bigint): number {
  const n = typeof micro === "number" ? micro
    : typeof micro === "bigint"       ? Number(micro)
    : micro.toNumber();
  return n / USDC_FACTOR;
}

/** Convert a human-readable USDC amount to micro-units BN */
export function usdcToMicro(usdc: number): BN {
  return new BN(Math.round(usdc * USDC_FACTOR));
}

/** Format USDC amount as a currency string */
export function formatUsdc(usdc: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(usdc);
}

/** Shorten a public key for display: "AbCd...xYz1" */
export function shortenPubkey(pubkey: string, chars = 4): string {
  return `${pubkey.slice(0, chars)}...${pubkey.slice(-chars)}`;
}

/** Convert seconds to a human-readable interval */
export function intervalToLabel(seconds: number): string {
  const days = seconds / 86_400;
  if (days === 1)   return "Daily";
  if (days === 7)   return "Weekly";
  if (days === 14)  return "Bi-weekly";
  if (days === 30)  return "Monthly";
  if (days === 90)  return "Quarterly";
  if (days === 365) return "Annual";
  return `Every ${days} days`;
}

/** Format a unix timestamp as a locale date string */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

/** Format a unix timestamp as a locale date+time string */
export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Relative time: "2 hours ago", "in 3 days" */
export function formatRelative(unixSeconds: number): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diff = unixSeconds - Math.floor(Date.now() / 1000);
  const absDiff = Math.abs(diff);

  if (absDiff < 60)        return rtf.format(Math.round(diff), "second");
  if (absDiff < 3600)      return rtf.format(Math.round(diff / 60), "minute");
  if (absDiff < 86400)     return rtf.format(Math.round(diff / 3600), "hour");
  if (absDiff < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (absDiff < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

/** Convert an ISO date string to "Jan 24" display format */
export function formatChartDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

/** Compute month-over-month growth percentage */
export function momGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** Cluster-specific Solscan URL */
export function solscanTxUrl(signature: string, cluster: string): string {
  const net = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${net}`;
}
