import { bcs } from '@mysten/sui/bcs';
import { encodeBid, type BidPayload } from './bid.js';

/**
 * A sealed quote payload for an RFQ is `bcs(price) || nonce` — the same shape as
 * a base auction bid. `encodeBid` already produces that encoding, so `encodeQuote`
 * is a thin alias that gives the call-site a domain-appropriate name.
 */
export interface QuotePayload {
  /** Quoted price per unit in MIST. */
  price: bigint;
  /** Random nonce so equal quotes still produce distinct blobs/commitments. */
  nonce: Uint8Array;
}

/**
 * Encode a quote into bytes matching the Move commitment preimage:
 * `bcs(price) || nonce`.
 *
 * The encoding is identical to `encodeBid`; this function adapts the field name
 * so callers in the OTC context read clearly without duplicating any logic.
 */
export function encodeQuote({ price, nonce }: QuotePayload): Uint8Array {
  const payload: BidPayload = { amount: price, nonce };
  return encodeBid(payload);
}

/** Decode bytes (from Walrus) back into a typed quote payload. */
export function decodeQuote(bytes: Uint8Array): QuotePayload {
  const price = BigInt(bcs.u64().parse(bytes.subarray(0, 8)));
  return { price, nonce: bytes.subarray(8) };
}
