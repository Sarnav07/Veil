/**
 * Encrypted trade-archive record. After an auction settles, a record of the
 * outcome is stored on Walrus, giving VEIL a durable, decentralized order history
 * (the "Data" half of the DeFi + Data track).
 */
export interface ArchiveRecord {
  auctionId: string;
  winner: string;
  /** Clearing price in MIST, as a decimal string. */
  price: string;
  bidCount: number;
  settledAtMs: number;
}

export function encodeArchive(record: ArchiveRecord): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}

export function decodeArchive(bytes: Uint8Array): ArchiveRecord {
  return JSON.parse(new TextDecoder().decode(bytes)) as ArchiveRecord;
}
