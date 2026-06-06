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
  encodeReserve,
  generateReserve,
  decodeReserve,
  commit,
  randomNonce,
  toHex,
  SealVault,
  WalrusClient,
} from '@veil/sdk';
import { buildOtcSettleArrays, printOtcSettle, type RevealedEntry } from './keeper.js';
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

  const closeMs = 0n; // 0 for immediate unlock during the live spike

  // Encode quotes and compute commitments offline — no network needed.
  const encoded = await Promise.all(
    SAMPLE_QUOTES.map(async ({ price }) => {
      const nonce = randomNonce();
      const payload = encodeQuote({ price, nonce });
      const commitment = await commit(payload);
      return { price, nonce, payload, commitment };
    }),
  );

  const makerReserve = 4_000_000n;
  const reservePayload = generateReserve(makerReserve);
  const encodedReserveBytes = encodeReserve(reservePayload);
  const reserveCommitment = await commit(encodedReserveBytes);

  console.log('Encoded OTC quotes:');
  for (const [i, q] of encoded.entries()) {
    console.log(
      `  [${i}] price=${q.price} MIST` +
        `  commitment=0x${toHex(q.commitment).slice(0, 16)}…`,
    );
  }
  console.log('\nEncoded OTC Reserve (maker):');
  console.log(`  reserve=${makerReserve} MIST`);
  console.log(`  commitment=0x${toHex(reserveCommitment).slice(0, 16)}…`);

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
    const blobId = await walrus.store(ciphertext, 5);
    stored.push({ index: i, blobId });
    console.log(`  [${i}] blobId=${blobId}`);
  }
  console.log('\nSeal + Walrus round-trip for maker reserve:');
  const reserveCiphertext = await vault.sealBid(encodedReserveBytes, closeMs);
  const reserveBlobId = await walrus.store(reserveCiphertext, 5);
  console.log(`  reserveBlobId=${reserveBlobId}`);

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
    console.log(`  Fetching + decrypting quote blob ${blobId}...`);
    const ciphertext = await readWithRetry(walrus, blobId);
    const plaintext = await vault.unsealBid(ciphertext, closeMs, sessionKey);
    entries.push({ index, plaintext });
  }

  console.log(`  Fetching + decrypting reserve blob ${reserveBlobId}...`);
  const fetchedReserveCiphertext = await readWithRetry(walrus, reserveBlobId);
  const fetchedReservePlaintext = await vault.unsealBid(fetchedReserveCiphertext, closeMs, sessionKey);
  const decodedReserve = decodeReserve(fetchedReservePlaintext);
  console.log(`  Unsealed reserve: ${decodedReserve.reserve} MIST`);

  console.log('\n✅ Quotes fetched and decrypted! Reveal arrays settle would take:');
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
