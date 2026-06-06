/**
 * M2 integration: the storage core, end to end against Walrus testnet.
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

// ✅ FIX: Replaced the blind sleep() with a robust retry loop
async function readWithRetry(walrus: WalrusClient, blobId: string, maxRetries = 5, delayMs = 2000): Promise<Uint8Array> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`  Attempt ${i + 1}: Fetching blob ${blobId}...`);
      return await walrus.read(blobId);
    } catch (err: any) {
      if (i === maxRetries - 1) {
        throw new Error(`Failed to fetch blob after ${maxRetries} attempts. Network may be down.`);
      }
      console.log(`  Blob not synced yet. Waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Unreachable");
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

  const blobId = await walrus.store(payload, 5);
  
  // ✅ FIX: Actively poll the network instead of sleeping blindly
  const fetched = await readWithRetry(walrus, blobId);
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
  
  const archiveBlobId = await walrus.store(encodeArchive(record), 5);
  
  // ✅ FIX: Actively poll for the archive record
  const fetchedArchive = await readWithRetry(walrus, archiveBlobId);
  const recordBack = decodeArchive(fetchedArchive);
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
