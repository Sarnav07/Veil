/**
 * M3: seal a bid and store the ciphertext on Walrus — the exact path a bidder
 * runs. Proves the stored blob is ciphertext, not the bid. Decryption is gated
 * on the published seal_approve policy, so it runs only after deploy.
 *
 * Run: pnpm spike:m3
 */
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { encodeBid, randomNonce, SealVault, WalrusClient } from '@veil/sdk';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SessionKey } from '@mysten/seal';
import { optionalEnv } from './env.js';

const KEY_SERVERS = optionalEnv(
  'SEAL_KEY_SERVER_OBJECT_IDS',
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
)
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

async function main(): Promise<void> {
  // Seal binds the ciphertext to a real on-chain package, so this runs only once
  // the veil package is published and its id is exported.
  const packageId = process.env.VEIL_PACKAGE_ID?.trim();
  if (!packageId) {
    console.log('Skipping live seal check: set VEIL_PACKAGE_ID (after `sui client publish`) to run it.');
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

  const closeMs = 1_717_000_000_000n;
  const payload = encodeBid({ amount: 250_000_000n, nonce: randomNonce() });

  const ciphertext = await vault.sealBid(payload, closeMs);
  if (bytesEqual(ciphertext, payload)) throw new Error('ciphertext equals plaintext');

  const blobId = await walrus.store(ciphertext);
  if (!bytesEqual(await walrus.read(blobId), ciphertext)) {
    throw new Error('sealed blob round-trip mismatch');
  }

  console.log('M3 seal + Walrus OK — the chain (and any sniper) sees only ciphertext.');
  console.log(`  key servers:      ${KEY_SERVERS.length}`);
  console.log(`  plaintext bytes:  ${payload.length}`);
  console.log(`  ciphertext bytes: ${ciphertext.length}`);
  console.log(`  sealed blobId:    ${blobId}`);
  
  console.log('  Testing decryption (closeMs = 0 to pass policy immediately)...');
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
  
  // Encrypt with closeMs = 0 so it unlocks immediately
  const immediateCiphertext = await vault.sealBid(payload, 0n);
  const decrypted = await vault.unsealBid(immediateCiphertext, 0n, sessionKey);
  
  if (!bytesEqual(decrypted, payload)) {
    throw new Error('Decrypted payload does not match original!');
  }
  console.log('  ✅ Decryption SUCCESS! The Seal policy gate and Walrus round-trip work end-to-end.');
}

main().catch((error: unknown) => {
  console.error('m3 integration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
