/**
 * M0 spike: connect to Seal's key servers and encrypt a secret under a
 * threshold-IBE identity. This proves the encryption path VEIL uses for bids.
 *
 * Decryption is intentionally NOT exercised here: Seal releases keys only when
 * an on-chain `seal_approve` policy passes, which we publish in M3. So M0
 * verifies connectivity + encryption; M3 verifies the time-locked decryption.
 *
 * Key-server object ids are supplied via SEAL_KEY_SERVER_OBJECT_IDS — the SDK
 * no longer bundles an allowlist. Get the current testnet ids from the Seal docs
 * (https://seal-docs.wal.app/) and paste them into .env.
 *
 * Run: pnpm spike:seal
 */
import { SealClient } from '@mysten/seal';
import { SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { optionalEnv, requireEnv } from './env.js';

// The published `veil` package id (the one defining `seal_approve`).
const VEIL_PACKAGE_ID = optionalEnv(
  'VEIL_PACKAGE_ID',
  '0x67b75f6c83a888d8736f47297c1a2e7212e8d8b8b4d1062aace46d024d22e30c'
);

function toHexId(label: string): string {
  return `0x${Buffer.from(label, 'utf8').toString('hex')}`;
}

function keyServerIds(): string[] {
  const ids = requireEnv('SEAL_KEY_SERVER_OBJECT_IDS')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (ids.length === 0) throw new Error('SEAL_KEY_SERVER_OBJECT_IDS is empty');
  return ids;
}

async function main(): Promise<void> {
  const apiKey = requireEnv('TATUM_API_KEY');
  const url = optionalEnv('TATUM_SUI_RPC_URL', 'https://sui-testnet.gateway.tatum.io');

  const suiClient = new SuiClient({
    transport: new SuiHTTPTransport({ url, rpc: { headers: { 'x-api-key': apiKey } } }),
  });

  const ids = keyServerIds();
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: ids.map((objectId) => ({ objectId, weight: 1 })),
    verifyKeyServers: false,
  });

  const secret = new TextEncoder().encode('veil-seal-spike: a bid no one can see yet');
  const { encryptedObject } = await sealClient.encrypt({
    threshold: 1,
    packageId: VEIL_PACKAGE_ID,
    id: toHexId('veil-m0-spike'),
    data: secret,
  });

  console.log('Seal encryption OK (decryption deferred to M3 policy).');
  console.log(`  key servers: ${ids.length}`);
  console.log(`  plaintext:   ${secret.length} bytes`);
  console.log(`  ciphertext:  ${encryptedObject.length} bytes`);
}

main().catch((error: unknown) => {
  console.error('seal spike failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
