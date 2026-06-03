/**
 * OTC RFQ integration: encode sealed quotes, commit them, optionally store on
 * Walrus+Seal (skipped unless the veil package is deployed), then print the
 * reveal arrays that settle would consume.
 *
 * Run: pnpm spike:m5
 */
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import {
  encodeQuote,
  commit,
  randomNonce,
  toHex,
  SealVault,
  WalrusClient,
} from '@veil/sdk';
import { buildOtcSettleArrays, printOtcSettle, type RevealedEntry } from './keeper.js';
import { optionalEnv } from './env.js';

const KEY_SERVERS = optionalEnv(
  'SEAL_KEY_SERVER_OBJECT_IDS',
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
)
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

// Three sample quotes competing against a hidden reserve.
const SAMPLE_QUOTES = [
  { price: 8_000_000n },
  { price: 5_500_000n },
  { price: 3_000_000n },
] as const;

async function main(): Promise<void> {
  // Seal binds the ciphertext to a real on-chain package, so the live round-trip
  // only runs once the veil package is published and its id is exported.
  const packageId = process.env.VEIL_PACKAGE_ID?.trim();

  const closeMs = 1_750_000_000_000n;

  // Encode quotes and compute commitments offline — no network needed.
  const encoded = await Promise.all(
    SAMPLE_QUOTES.map(async ({ price }) => {
      const nonce = randomNonce();
      const payload = encodeQuote({ price, nonce });
      const commitment = await commit(payload);
      return { price, nonce, payload, commitment };
    }),
  );

  console.log('Encoded OTC quotes:');
  for (const [i, q] of encoded.entries()) {
    console.log(
      `  [${i}] price=${q.price} MIST` +
        `  commitment=0x${toHex(q.commitment).slice(0, 16)}…`,
    );
  }

  if (!packageId) {
    console.log(
      '\nSkipping live seal+Walrus check: set VEIL_PACKAGE_ID (after `sui client publish`) to run it.',
    );
    console.log('Reveal arrays from encoded plaintexts (offline):');
    const entries: RevealedEntry[] = encoded.map(({ payload }, index) => ({ index, plaintext: payload }));
    printOtcSettle(buildOtcSettleArrays(entries));
    return;
  }

  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const vault = new SealVault({
    suiClient,
    keyServerObjectIds: KEY_SERVERS,
    packageId,
    threshold: 1,
  });
  const walrus = new WalrusClient({
    publisherUrl: optionalEnv('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
    aggregatorUrl: optionalEnv('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
  });

  // Seal + Walrus round-trip for each quote.
  const stored: Array<{ index: number; blobId: string }> = [];
  for (const [i, { payload }] of encoded.entries()) {
    const ciphertext = await vault.sealBid(payload, closeMs);
    const blobId = await walrus.store(ciphertext);
    stored.push({ index: i, blobId });
    console.log(`  [${i}] blobId=${blobId}`);
  }

  console.log('\nQuotes stored. Reveal arrays settle would take:');
  const entries: RevealedEntry[] = encoded.map(({ payload }, index) => ({ index, plaintext: payload }));
  printOtcSettle(buildOtcSettleArrays(entries));

  console.log('\nOn-chain the chain sees only:');
  for (const [i, q] of encoded.entries()) {
    console.log(
      `  [${i}] commitment=0x${toHex(q.commitment)}  blobId=${stored[i]?.blobId ?? '(missing)'}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error('m5 integration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
