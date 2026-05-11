import BN from "bn.js";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function randomPlanId(): BN {
  const bytes = new Uint8Array(8);
  const cryptoImpl = globalThis.crypto;

  if (cryptoImpl?.getRandomValues) {
    cryptoImpl.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return new BN(bytesToHex(bytes), 16);
}
