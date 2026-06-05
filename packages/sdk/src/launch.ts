import { bcs } from '@mysten/sui/bcs';
import { commit, randomNonce, toHex } from './bid.js';

/**
 * A launch bid payload is `bcs(price) || bcs(qty) || nonce`. It is Seal-encrypted
 * and stored on Walrus; its SHA-256 is the on-chain commitment. At settlement the
 * keeper opens each commitment with the decoded (price, qty, nonce), which
 * `veil::veil_launch::settle` re-hashes to verify — so it can't lie about a bid.
 */
export interface LaunchBidPayload {
  /** Price per unit in MIST. */
  price: bigint;
  /** Quantity of tokens requested. */
  qty: bigint;
  /** Random nonce so equal bids still produce distinct blobs/commitments. */
  nonce: Uint8Array;
}

/**
 * Encode a launch bid into bytes matching the Move commitment preimage:
 * `bcs(price) || bcs(qty) || nonce`.
 */
export function encodeLaunchBid({ price, qty, nonce }: LaunchBidPayload): Uint8Array {
  const priceBytes = bcs.u64().serialize(price).toBytes();
  const qtyBytes = bcs.u64().serialize(qty).toBytes();
  const out = new Uint8Array(priceBytes.length + qtyBytes.length + nonce.length);
  out.set(priceBytes);
  out.set(qtyBytes, priceBytes.length);
  out.set(nonce, priceBytes.length + qtyBytes.length);
  return out;
}

/** Decode bytes (from Walrus) back into a typed launch bid payload. */
export function decodeLaunchBid(bytes: Uint8Array): LaunchBidPayload {
  const price = BigInt(bcs.u64().parse(bytes.subarray(0, 8)));
  const qty = BigInt(bcs.u64().parse(bytes.subarray(8, 16)));
  return { price, qty, nonce: bytes.subarray(16) };
}

