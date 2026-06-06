/**
 * Keeper helpers: after a sale or RFQ closes, decrypt each Seal-encrypted blob
 * and reshape the revealed values into the arrays that `settle` expects on-chain.
 *
 * The decode/shape logic here is pure and requires no network; only the upstream
 * Walrus reads and Seal decryptions need I/O, and those are done by the caller
 * before passing bytes in.
 */
import { decodeLaunchBid, decodeQuote, toHex } from '@veil/sdk';

/** A single decrypted blob paired with its bidder index. */
export interface RevealedEntry {
  index: number;
  plaintext: Uint8Array;
}

/**
 * Arrays shaped for `veil::veil_launch::settle`.
 *
 * Element `i` in each array corresponds to bid `i` on-chain (0-based).
 */
export interface LaunchSettleArrays {
  prices: bigint[];
  quantities: bigint[];
  /** Each nonce as a raw Uint8Array, matching `vector<vector<u8>>` in Move. */
  nonces: Uint8Array[];
}

/**
 * Arrays shaped for `veil::veil_otc::settle`.
 *
 * Element `i` corresponds to quote `i` on-chain (0-based).
 */
export interface OtcSettleArrays {
  prices: bigint[];
  nonces: Uint8Array[];
}

/**
 * Decode a list of decrypted launch-bid plaintexts and return the parallel arrays
 * that `veil::veil_launch::settle(sale, prices, quantities, nonces, ctx)` expects.
 *
 * Entries must be ordered by their on-chain bid index (ascending). If a bid's
 * blob is missing or corrupt, the caller should substitute a zero-price zero-qty
 * entry with an empty nonce so that the index alignment stays intact — Move will
 * then reject the mismatched commitment and refund that bidder.
 */
export function buildLaunchSettleArrays(entries: RevealedEntry[]): LaunchSettleArrays {
  // 1. Find the maximum index to ensure dense array allocation
  const maxIndex = entries.reduce((max, e) => Math.max(max, e.index), -1);
  const size = maxIndex >= 0 ? maxIndex + 1 : 0;

  // 2. Pre-fill arrays with safe fallback values
  const prices: bigint[] = new Array(size).fill(0n);
  const quantities: bigint[] = new Array(size).fill(0n);
  const nonces: Uint8Array[] = new Array(size).fill(new Uint8Array(0));

  // 3. Directly assign by index, skipping the need to sort
  for (const { index, plaintext } of entries) {
    try {
      const { price, qty, nonce } = decodeLaunchBid(plaintext);
      prices[index] = price;
      quantities[index] = qty;
      nonces[index] = nonce;
    } catch (err) {
      // If decoding fails, it leaves the 0n fallback in place at this index.
      // The Move contract will hash the 0s, see they don't match the on-chain commitment,
      // and safely refund this specific corrupt bidder without crashing the Keeper.
      console.warn(`[!] Failed to decode launch bid at index ${index}. Using zero defaults.`);
    }
  }

  return { prices, quantities, nonces };
}

/**
 * Decode a list of decrypted OTC-quote plaintexts and return the parallel arrays
 * that `veil::veil_otc::settle(rfq, prices, nonces, ctx)` expects.
 *
 * Same index-alignment contract as `buildLaunchSettleArrays`.
 */
export function buildOtcSettleArrays(entries: RevealedEntry[]): OtcSettleArrays {
  const maxIndex = entries.reduce((max, e) => Math.max(max, e.index), -1);
  const size = maxIndex >= 0 ? maxIndex + 1 : 0;

  const prices: bigint[] = new Array(size).fill(0n);
  const nonces: Uint8Array[] = new Array(size).fill(new Uint8Array(0));

  for (const { index, plaintext } of entries) {
    try {
      const { price, nonce } = decodeQuote(plaintext);
      prices[index] = price;
      nonces[index] = nonce;
    } catch (err) {
      console.warn(`[!] Failed to decode OTC quote at index ${index}. Using zero defaults.`);
    }
  }

  return { prices, nonces };
}

/** Pretty-print a launch settle array to stdout for offline inspection. */
export function printLaunchSettle(arrays: LaunchSettleArrays): void {
  console.log('Launch settle arrays:');
  for (let i = 0; i < arrays.prices.length; i++) {
    console.log(
      `  [${i}] price=${arrays.prices[i]?.toString() ?? '?'} MIST` +
        `  qty=${arrays.quantities[i]?.toString() ?? '?'}` +
        `  nonce=${toHex(arrays.nonces[i] ?? new Uint8Array())}`,
    );
  }
}

/** Pretty-print an OTC settle array to stdout for offline inspection. */
export function printOtcSettle(arrays: OtcSettleArrays): void {
  console.log('OTC settle arrays:');
  for (let i = 0; i < arrays.prices.length; i++) {
    console.log(
      `  [${i}] price=${arrays.prices[i]?.toString() ?? '?'} MIST` +
        `  nonce=${toHex(arrays.nonces[i] ?? new Uint8Array())}`,
    );
  }
}
