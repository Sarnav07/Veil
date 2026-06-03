/**
 * M0 spike: store a blob on Walrus testnet (publisher) and read it back
 * (aggregator), proving the round-trip we rely on for encrypted bids.
 *
 * Run: pnpm spike:walrus
 */
import { optionalEnv } from './env.js';

const PUBLISHER = optionalEnv(
  'WALRUS_PUBLISHER_URL',
  'https://publisher.walrus-testnet.walrus.space',
);
const AGGREGATOR = optionalEnv(
  'WALRUS_AGGREGATOR_URL',
  'https://aggregator.walrus-testnet.walrus.space',
);

/** Pull the blobId out of either publisher response shape. */
function extractBlobId(body: unknown): string {
  if (body && typeof body === 'object') {
    const created = (body as { newlyCreated?: { blobObject?: { blobId?: string } } }).newlyCreated;
    if (created?.blobObject?.blobId) return created.blobObject.blobId;
    const certified = (body as { alreadyCertified?: { blobId?: string } }).alreadyCertified;
    if (certified?.blobId) return certified.blobId;
  }
  throw new Error(`unexpected publisher response: ${JSON.stringify(body)}`);
}

async function store(payload: Uint8Array): Promise<string> {
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=1`, { method: 'PUT', body: payload });
  if (!res.ok) throw new Error(`publisher returned ${res.status} ${res.statusText}`);
  return extractBlobId(await res.json());
}

async function read(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`aggregator returned ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main(): Promise<void> {
  const message = `veil-walrus-spike:${new Date().toISOString()}`;
  const payload = new TextEncoder().encode(message);

  const blobId = await store(payload);
  const roundTrip = new TextDecoder().decode(await read(blobId));

  if (roundTrip !== message) {
    throw new Error(`round-trip mismatch: sent "${message}", got "${roundTrip}"`);
  }

  console.log('Walrus store + read round-trip OK.');
  console.log(`  blobId:  ${blobId}`);
  console.log(`  bytes:   ${payload.length}`);
}

main().catch((error: unknown) => {
  console.error('walrus spike failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
