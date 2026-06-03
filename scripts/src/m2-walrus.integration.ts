/**
 * M2 integration: the storage core, end to end against Walrus testnet.
 *
 * Encodes a bid, commits to it, stores it on Walrus, reads it back, and checks
 * the round-trip + commitment stability. Then does the same for a settled-auction
 * archive record. This is the exact path `submit_bid(blob_id, commitment)` and the
 * trade archive rely on (wiring the blobId onto Sui needs a published package + gas,
 * which is parked).
 *
 * Run: pnpm spike:m2
 */
import {
  WalrusClient,
  commit,
  decodeArchive,
  decodeBid,
  encodeArchive,
  encodeBid,
  randomNonce,
  toHex,
  type ArchiveRecord,
} from '@veil/sdk';
import { optionalEnv } from './env.js';

function assertEqualBytes(a: Uint8Array, b: Uint8Array, label: string): void {
  if (a.length !== b.length || !a.every((x, i) => x === b[i])) {
    throw new Error(`${label}: byte mismatch`);
  }
}

async function main(): Promise<void> {
  const walrus = new WalrusClient({
    publisherUrl: optionalEnv('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
    aggregatorUrl: optionalEnv('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
  });

  // --- bid round-trip ---
  const amount = 100_000_000n; // 0.1 SUI
  const payload = encodeBid({ amount, nonce: randomNonce() });
  const commitment = await commit(payload);

  const blobId = await walrus.store(payload);
  const fetched = await walrus.read(blobId);
  assertEqualBytes(payload, fetched, 'bid payload round-trip');

  const decoded = decodeBid(fetched);
  if (decoded.amount !== amount) throw new Error(`decoded amount ${decoded.amount} != ${amount}`);
  assertEqualBytes(commitment, await commit(fetched), 'commitment stability');

  // --- archive round-trip ---
  const record: ArchiveRecord = {
    auctionId: '0xveil_demo_auction',
    winner: '0xb0b',
    price: amount.toString(),
    bidCount: 2,
    settledAtMs: 1_717_000_000_000,
  };
  const archiveBlobId = await walrus.store(encodeArchive(record));
  const recordBack = decodeArchive(await walrus.read(archiveBlobId));
  if (recordBack.auctionId !== record.auctionId) throw new Error('archive round-trip mismatch');

  console.log('M2 Walrus storage integration OK.');
  console.log(`  bid blobId:      ${blobId}`);
  console.log(`  commitment:      0x${toHex(commitment)}`);
  console.log(`  archive blobId:  ${archiveBlobId}`);
}

main().catch((error: unknown) => {
  console.error('m2 integration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
