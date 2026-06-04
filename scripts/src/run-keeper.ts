import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SessionKey } from '@mysten/seal';
import {
  SealVault,
  WalrusClient,
  LaunchTxBuilder,
  OtcTxBuilder,
  TatumClient,
  encodeArchive,
  type ArchiveRecord,
} from '@veil/sdk';
import { optionalEnv } from './env.js';
import {
  buildLaunchSettleArrays,
  buildOtcSettleArrays,
  type RevealedEntry,
} from './keeper.js';

const KEY_SERVERS = optionalEnv(
  'SEAL_KEY_SERVER_OBJECT_IDS',
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
)
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

async function main() {
  const args = process.argv.slice(2);
  const typeIndex = args.indexOf('--type');
  const type = typeIndex >= 0 ? args[typeIndex + 1] : null;
  const objectIdIndex = args.findIndex(arg => arg === '--sale' || arg === '--rfq');
  const objectId = objectIdIndex >= 0 ? args[objectIdIndex + 1] : null;

  if (!type || (type !== 'launch' && type !== 'otc') || !objectId) {
    console.error('Usage: pnpm keeper --type <launch|otc> --sale <objectId> (or --rfq <objectId>)');
    process.exit(1);
  }

  const packageId = process.env.VEIL_PACKAGE_ID?.trim();
  if (!packageId) throw new Error('VEIL_PACKAGE_ID must be set in .env');

  const privKeyStr = process.env.SUI_PRIVATE_KEY;
  if (!privKeyStr) throw new Error('SUI_PRIVATE_KEY missing for keeper decryption');

  const { secretKey } = decodeSuiPrivateKey(privKeyStr);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);

  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const tatumApiKey = process.env.TATUM_API_KEY;
  if (!tatumApiKey) throw new Error('TATUM_API_KEY missing for Data API');
  const tatum = new TatumClient(tatumApiKey);
  const walrus = new WalrusClient({
    publisherUrl: optionalEnv('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
    aggregatorUrl: optionalEnv('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
  });
  const vault = new SealVault({
    suiClient,
    keyServerObjectIds: KEY_SERVERS,
    packageId,
    threshold: 1,
  });

  const sessionKey = await SessionKey.create({
    address: keypair.toSuiAddress(),
    packageId,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });

  console.log(`Keeper triggered for ${type} ${objectId}`);
  console.log(`Fetching object state...`);
  
  const objRes = await suiClient.getObject({ id: objectId, options: { showContent: true } });
  if (!objRes.data || !objRes.data.content || objRes.data.content.dataType !== 'moveObject') {
    throw new Error('Object not found or is not a moveObject');
  }

  const content = objRes.data.content as any;
  const fields = content.fields;
  const objType = content.type; // e.g. "package_id::veil_launch::Sale<0x2::sui::SUI>"
  
  // Extract coinType
  const typeArgsMatch = objType.match(/<([^>]+)>/);
  if (!typeArgsMatch) throw new Error(`Could not parse coinType from object type: ${objType}`);
  const coinType = typeArgsMatch[1];

  const state = fields.state;
  const closeMs = BigInt(fields.close_ms);
  
  // Wait if not closed
  if (state === 0) {
    const nowMs = Date.now();
    if (closeMs > BigInt(nowMs)) {
      const delay = Number(closeMs) - nowMs;
      console.log(`State is BIDDING. Sleeping for ${delay}ms until close time...`);
      await new Promise(r => setTimeout(r, delay + 2000)); // Sleep until slightly past close time
    }
  }

  const tx = new Transaction();

  // Decrypt and build arrays
  if (type === 'launch') {
    const bids = fields.bids as any[];
    const entries: RevealedEntry[] = [];
    
    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const blobIdBytes = bid.fields.blob_id;
      const blobIdStr = new TextDecoder().decode(new Uint8Array(blobIdBytes));
      console.log(`  [${i}] Fetching & decrypting blob ${blobIdStr}...`);
      
      try {
        const ciphertext = await walrus.read(blobIdStr);
        const plaintext = await vault.unsealBid(ciphertext, closeMs, sessionKey);
        entries.push({ index: i, plaintext });
      } catch (err) {
        console.error(`Failed to unseal bid ${i}:`, err);
        // Fallback: zero plaintext to force rejection
        entries.push({ index: i, plaintext: new Uint8Array(48) });
      }
    }
    
    const arrays = buildLaunchSettleArrays(entries);
    
    if (state === 0) {
      console.log('Appending close() to PTB...');
      LaunchTxBuilder.close(tx, packageId, { sale: objectId, coinType });
    }
    console.log('Appending settle() to PTB...');
    LaunchTxBuilder.settle(tx, packageId, {
      sale: objectId,
      prices: arrays.prices,
      quantities: arrays.quantities,
      nonces: arrays.nonces,
      coinType
    });
    
  } else {
    // OTC
    const quotes = fields.quotes as any[];
    const entries: RevealedEntry[] = [];
    
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      const blobIdBytes = quote.fields.blob_id;
      const blobIdStr = new TextDecoder().decode(new Uint8Array(blobIdBytes));
      console.log(`  [${i}] Fetching & decrypting blob ${blobIdStr}...`);
      
      try {
        const ciphertext = await walrus.read(blobIdStr);
        const plaintext = await vault.unsealBid(ciphertext, closeMs, sessionKey);
        entries.push({ index: i, plaintext });
      } catch (err) {
        console.error(`Failed to unseal quote ${i}:`, err);
        entries.push({ index: i, plaintext: new Uint8Array(48) });
      }
    }
    
    const arrays = buildOtcSettleArrays(entries);
    
    // For OTC, we need the maker's reserve & reserveNonce to settle.
    // However, the keeper doesn't have the plaintext reserve/reserveNonce!
    // The maker must provide them. In a real system, the maker runs the keeper 
    // or provides a sealed envelope with the reserve.
    // Since the keeper runs universally, let's look for env vars for the reserve just for this script,
    // or fail if it's OTC and we don't have them.
    const reserveStr = process.env.OTC_RESERVE;
    const reserveNonceHex = process.env.OTC_RESERVE_NONCE;
    if (!reserveStr || !reserveNonceHex) {
      throw new Error("OTC settle requires OTC_RESERVE and OTC_RESERVE_NONCE in env to open the reserve commitment!");
    }
    const reserve = BigInt(reserveStr);
    const reserveNonce = new Uint8Array(Buffer.from(reserveNonceHex, 'hex'));

    if (state === 0) {
      console.log('Appending close() to PTB...');
      OtcTxBuilder.close(tx, packageId, { rfq: objectId, coinType });
    }
    console.log('Appending settle() to PTB...');
    OtcTxBuilder.settle(tx, packageId, {
      rfq: objectId,
      prices: arrays.prices,
      nonces: arrays.nonces,
      reserve,
      reserveNonce,
      coinType
    });
  }

  console.log(`Executing transaction...`);
  const res = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showEvents: true,
    }
  });

  if (res.effects?.status.status === 'success') {
    console.log(`✅ Keeper executed successfully! Digest: ${res.digest}`);
    if (res.events) {
      for (const ev of res.events) {
        if (ev.type.includes('SaleSettled') || ev.type.includes('RfqSettled')) {
          console.log(`Settled Event:`, ev.parsedJson);
          
          // Data API Integration
          console.log('\n--- DeFi + Data Integration ---');
          const dataJson = ev.parsedJson as any;
          const price = dataJson.clearing_price || dataJson.price || 0;
          const winner = dataJson.winner || 'Multiple (Launch)';
          const count = dataJson.bid_count || dataJson.quote_count || 0;
          
          try {
            const suiUsd = await tatum.getExchangeRate('SUI', 'USD');
            const priceInSui = Number(price) / 1_000_000_000;
            const priceInUsd = priceInSui * suiUsd;
            
            console.log(`Tatum Data API: Current SUI price is $${suiUsd.toFixed(4)} USD`);
            console.log(`Mark-to-Market: Clearing price of ${priceInSui} SUI is ~$${priceInUsd.toFixed(4)} USD`);
          } catch (err: any) {
            console.error(`Failed to fetch Tatum Data API:`, err.message);
          }

          // Archive-on-settle Integration
          console.log('\n--- Archive-on-Settle Integration ---');
          const record: ArchiveRecord = {
            auctionId: objectId,
            winner,
            price: price.toString(),
            bidCount: Number(count),
            settledAtMs: Date.now()
          };
          
          try {
            const bytes = encodeArchive(record);
            const archiveBlobId = await walrus.store(bytes);
            console.log(`Archived settlement record to Walrus! Blob ID: ${archiveBlobId}`);
          } catch (err: any) {
            console.error(`Failed to store archive blob to Walrus:`, err.message);
          }
        }
      }
    }
  } else {
    console.error(`❌ Keeper transaction failed!`, res.effects?.status.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Keeper failed:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
