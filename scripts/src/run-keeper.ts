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
  decodeReserve,
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
  let fields = content.fields;
  const objType = content.type; // e.g. "package_id::veil_launch::Sale<0x2::sui::SUI>"

  // Extract coinType
  const typeArgsMatch = objType.match(/<([^>]+)>/);
  if (!typeArgsMatch) throw new Error(`Could not parse coinType from object type: ${objType}`);
  const coinType = typeArgsMatch[1]!;

  let state = fields.state;
  const closeMs = BigInt(fields.close_ms);

  // Wait if not closed
  if (state === 0) {
    const nowMs = Date.now();
    if (closeMs > BigInt(nowMs)) {
      const delay = Number(closeMs) - nowMs + 5000;
      console.log(`State is BIDDING. Sleeping for ${delay}ms until close time (includes 5s network buffer)...`);
      await new Promise(r => setTimeout(r, delay));

      console.log(`Woke up! Re-fetching object state to capture final bids...`);
      const refreshedObjRes = await suiClient.getObject({ id: objectId, options: { showContent: true } });
      if (refreshedObjRes.data?.content?.dataType === 'moveObject') {
        fields = refreshedObjRes.data.content.fields as any;
        state = fields.state;
      }
    }
  }

  const tx = new Transaction();

  // Decrypt and build arrays
  if (type === 'launch') {
    const bids = (fields.bids || []) as any[];
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

    // Fetch and decrypt the maker's reserve
    const reserveBlobIdBytes = fields.reserve_blob_id as number[];
    const reserveBlobIdStr = new TextDecoder().decode(new Uint8Array(reserveBlobIdBytes));
    console.log(`  Fetching & decrypting reserve blob ${reserveBlobIdStr}...`);

    let reserve = 0n;
    let reserveNonce = new Uint8Array(32);
    try {
      const reserveCiphertext = await walrus.read(reserveBlobIdStr);
      const reservePlaintext = await vault.unsealBid(reserveCiphertext, closeMs, sessionKey);
      const decoded = decodeReserve(reservePlaintext);
      reserve = decoded.reserve;
      reserveNonce = decoded.reserveNonce;
      console.log(`  Unsealed maker's reserve floor successfully.`);
    } catch (err) {
      console.error(`Failed to unseal reserve blob:`, err);
      process.exit(1);
    }

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
      reserve,
      reserveNonce,
      coinType
    });

  } else {
    // OTC
    const quotes = (fields.quotes || []) as any[];
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

    // The maker encrypted the reserve payload and stored it on Walrus.
    // The Rfq object has the reserve_blob_id. We fetch and unseal it just like quotes.
    const reserveBlobIdBytes = fields.reserve_blob_id as number[];
    const reserveBlobIdStr = new TextDecoder().decode(new Uint8Array(reserveBlobIdBytes));
    console.log(`  Fetching & decrypting reserve blob ${reserveBlobIdStr}...`);
    let reserve = BigInt(0);
    let reserveNonce: Uint8Array = new Uint8Array(0);
    try {
      const reserveCiphertext = await walrus.read(reserveBlobIdStr);
      const reservePlaintext = await vault.unsealBid(reserveCiphertext, closeMs, sessionKey);
      const decoded = decodeReserve(reservePlaintext);
      reserve = decoded.reserve;
      reserveNonce = decoded.reserveNonce;
      console.log(`  Unsealed maker's reserve floor successfully.`);
    } catch (err) {
      console.error(`Failed to unseal reserve blob:`, err);
      throw new Error("Cannot settle OTC without successfully decrypting the maker's reserve.");
    }

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
            const archiveBlobId = await walrus.store(bytes, 5);
            console.log(`Archived settlement record to Walrus! Blob ID: ${archiveBlobId}`);

            console.log('Linking archive blob ID on-chain...');
            const linkTx = new Transaction();
            const archiveBlobIdBytes = new TextEncoder().encode(archiveBlobId);
            if (type === 'launch') {
              LaunchTxBuilder.addArchive(linkTx, packageId, { sale: objectId, blobId: archiveBlobIdBytes, coinType });
            } else {
              OtcTxBuilder.addArchive(linkTx, packageId, { rfq: objectId, blobId: archiveBlobIdBytes, coinType });
            }
            const linkRes = await suiClient.signAndExecuteTransaction({
              transaction: linkTx,
              signer: keypair,
              options: { showEffects: true }
            });
            if (linkRes.effects?.status.status === 'success') {
              console.log(`✅ On-chain archive trail linked! Digest: ${linkRes.digest}`);
            } else {
              console.error(`❌ Failed to link archive on-chain:`, linkRes.effects?.status.error);
            }
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
  // Security: log only the error name to prevent accidentally surfacing process.env
  // if an unhandled crash or network error includes the request context.
  console.error('❌ Keeper failed with error type:', err instanceof Error ? err.name : 'UnknownError');
  process.exit(1);
});
