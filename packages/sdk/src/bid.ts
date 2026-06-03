/**
 * Bid payload encoding + commitment.
 *
 * The payload is the cleartext a bidder commits to. In M2 it is stored on Walrus
 * as-is; in M3 it is Seal-encrypted before storage. The on-chain `commitment`
 * binds the sealed bid to its later reveal: at settlement the keeper checks that
 * `sha256(decoded payload) == commitment`.
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
