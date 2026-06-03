/**
 * M0 spike: verify Sui RPC reachability through the Tatum gateway.
 *
 * Builds a SuiClient whose HTTP transport injects the Tatum API key, then reads
 * the chain identifier and latest checkpoint — the same transport the rest of
 * VEIL will use for every on-chain read/write.
 *
 * Run: pnpm spike:tatum
 */
import { SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { optionalEnv, requireEnv } from './env.js';

async function main(): Promise<void> {
  const apiKey = requireEnv('TATUM_API_KEY');
  const url = optionalEnv('TATUM_SUI_RPC_URL', 'https://sui-testnet.gateway.tatum.io');

  const client = new SuiClient({
    transport: new SuiHTTPTransport({
      url,
      rpc: { headers: { 'x-api-key': apiKey } },
    }),
  });

  const [chainId, checkpoint] = await Promise.all([
    client.getChainIdentifier(),
    client.getLatestCheckpointSequenceNumber(),
  ]);

  console.log('Tatum Sui RPC reachable.');
  console.log(`  endpoint:   ${url}`);
  console.log(`  chain id:   ${chainId}`);
  console.log(`  checkpoint: ${checkpoint}`);
}

main().catch((error: unknown) => {
  console.error('tatum spike failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
