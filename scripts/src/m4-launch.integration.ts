/**
 * Launch auction integration: encode sealed bids, commit them, optionally store
 * on Walrus+Seal (skipped unless the veil package is deployed), then print the
 * reveal arrays that settle would consume.
 *
 * Run: pnpm spike:m4
 */
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import {
  encodeLaunchBid,
  commit,
  randomNonce,
  toHex,
  SealVault,
  WalrusClient,
} from '@veil/sdk';
import { buildLaunchSettleArrays, printLaunchSettle, type RevealedEntry } from './keeper.js';
import { optionalEnv } from './env.js';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SessionKey } from '@mysten/seal';

const KEY_SERVERS = optionalEnv(
  'SEAL_KEY_SERVER_OBJECT_IDS',
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
)
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

// Three sample bids: high-price big-qty, mid-price, low-price small-qty.
const SAMPLE_BIDS = [
  { price: 5_000_000n, qty: 100n },
  { price: 3_000_000n, qty: 200n },
  { price: 1_000_000n, qty: 50n },
] as const;

async function main(): Promise<void> {
  // Seal binds the ciphertext to a real on-chain package, so the live round-trip
  // only runs once the veil package is published and its id is exported.
  const packageId = process.env.VEIL_PACKAGE_ID?.trim();

  const closeMs = 0n; // 0 for immediate unlock during the live spike

  // Encode bids and compute commitments offline — no network needed.
  const encoded = await Promise.all(
    SAMPLE_BIDS.map(async ({ price, qty }) => {
      const nonce = randomNonce();
      const payload = encodeLaunchBid({ price, qty, nonce });
      const commitment = await commit(payload);
      return { price, qty, nonce, payload, commitment };
    }),
  );

  console.log('Encoded launch bids:');
  for (const [i, b] of encoded.entries()) {
    console.log(
      `  [${i}] price=${b.price} qty=${b.qty}` +
        `  commitment=0x${toHex(b.commitment).slice(0, 16)}…`,
    );
  }

  if (!packageId) {
    console.log(
      '\nSkipping live seal+Walrus check: set VEIL_PACKAGE_ID (after `sui client publish`) to run it.',
    );
    console.log('Reveal arrays from encoded plaintexts (offline):');
    const entries: RevealedEntry[] = encoded.map(({ payload }, index) => ({ index, plaintext: payload }));
    printLaunchSettle(buildLaunchSettleArrays(entries));
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

  // Seal + Walrus round-trip for each bid.
  const stored: Array<{ index: number; blobId: string }> = [];
  for (const [i, { payload }] of encoded.entries()) {
    const ciphertext = await vault.sealBid(payload, closeMs);
    const blobId = await walrus.store(ciphertext);
    stored.push({ index: i, blobId });
    console.log(`  [${i}] blobId=${blobId}`);
  }

  console.log('\nTesting decryption (keeper flow):');
  const privKeyStr = process.env.SUI_PRIVATE_KEY;
  if (!privKeyStr) throw new Error('SUI_PRIVATE_KEY missing for decryption');
  
  const { secretKey } = decodeSuiPrivateKey(privKeyStr);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  
  const sessionKey = await SessionKey.create({
    address: keypair.toSuiAddress(),
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });

  const entries: RevealedEntry[] = [];
  for (const { index, blobId } of stored) {
    console.log(`  Fetching + decrypting blob ${blobId}...`);
    const ciphertext = await walrus.read(blobId);
    const plaintext = await vault.unsealBid(ciphertext, closeMs, sessionKey);
    entries.push({ index, plaintext });
  }

  console.log('\n✅ Bids fetched and decrypted! Reveal arrays settle would take:');
  printLaunchSettle(buildLaunchSettleArrays(entries));

  console.log('\nOn-chain the chain sees only:');
  for (const [i, b] of encoded.entries()) {
    console.log(
      `  [${i}] commitment=0x${toHex(b.commitment)}  blobId=${stored[i]?.blobId ?? '(missing)'}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error('m4 integration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
