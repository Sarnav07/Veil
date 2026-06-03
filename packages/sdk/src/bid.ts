import { bcs } from '@mysten/sui/bcs';

/**
 * A bid payload is `bcs(amount) || nonce`. It is Seal-encrypted and stored on
 * Walrus; its SHA-256 is the on-chain commitment. At settlement the keeper opens
 * each commitment with the decoded (amount, nonce), which `veil::auction::settle`
 * re-hashes to verify — so it can't lie about a bid.
 */
export interface BidPayload {
  /** Bid amount in MIST (1 SUI = 1_000_000_000 MIST). */
  amount: bigint;
  /** Random nonce so equal bids still produce distinct blobs/commitments. */
  nonce: Uint8Array;
}

export function encodeBid({ amount, nonce }: BidPayload): Uint8Array {
  const amountBytes = bcs.u64().serialize(amount).toBytes();
  const out = new Uint8Array(amountBytes.length + nonce.length);
  out.set(amountBytes);
  out.set(nonce, amountBytes.length);
  return out;
}

export function decodeBid(bytes: Uint8Array): BidPayload {
  const amount = BigInt(bcs.u64().parse(bytes.subarray(0, 8)));
  return { amount, nonce: bytes.subarray(8) };
}

/** SHA-256 commitment over an encoded bid (matches Move `sha2_256`). */
export async function commit(payload: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', payload));
}

export function randomNonce(byteLength = 16): Uint8Array {
  const nonce = new Uint8Array(byteLength);
  crypto.getRandomValues(nonce);
  return nonce;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
