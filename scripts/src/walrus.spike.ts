/**
 * M0 spike: store a blob on Walrus testnet and read it back, proving the
 * round-trip we rely on for encrypted bids. Uses the shared @veil/sdk client.
 *
 * Run: pnpm spike:walrus
 */
import { WalrusClient } from '@veil/sdk';
import { optionalEnv } from './env.js';

async function main(): Promise<void> {
  const walrus = new WalrusClient({
    publisherUrl: optionalEnv('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
    aggregatorUrl: optionalEnv('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
  });

  const message = `veil-walrus-spike:${new Date().toISOString()}`;
  const payload = new TextEncoder().encode(message);

  const blobId = await walrus.store(payload);
  const roundTrip = new TextDecoder().decode(await walrus.read(blobId));

  if (roundTrip !== message) {
    throw new Error(`round-trip mismatch: sent "${message}", got "${roundTrip}"`);
  }

  console.log('Walrus store + read round-trip OK.');
  console.log(`  blobId: ${blobId}`);
  console.log(`  bytes:  ${payload.length}`);
}

main().catch((error: unknown) => {
  console.error('walrus spike failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
