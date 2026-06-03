/**
 * Bid payload encoding and commitment. The payload is the cleartext a bidder
 * commits to; it is Seal-encrypted before being stored on Walrus. The on-chain
 * commitment binds the sealed bid to its reveal: at settlement the keeper checks
 * sha256(payload) == commitment.
 */
export interface BidPayload {
  /** Bid amount in MIST (1 SUI = 1_000_000_000 MIST). */
  amount: bigint;
  /** Random hex nonce so two equal bids still produce distinct blobs/commitments. */
  nonce: string;
}

export function encodeBid(payload: BidPayload): Uint8Array {
  const json = JSON.stringify({ amount: payload.amount.toString(), nonce: payload.nonce });
  return new TextEncoder().encode(json);
}

export function decodeBid(bytes: Uint8Array): BidPayload {
  const obj = JSON.parse(new TextDecoder().decode(bytes)) as { amount: string; nonce: string };
  return { amount: BigInt(obj.amount), nonce: obj.nonce };
}

/** SHA-256 commitment over the encoded bid bytes. */
export async function commit(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

/** A random hex nonce (default 16 bytes). */
export function randomNonce(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
