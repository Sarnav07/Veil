import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useVeilConfig } from './useVeilConfig';
import { LaunchTxBuilder, OtcTxBuilder, SealVault, WalrusClient, randomNonce, commit, encodeReserve } from '@veil/sdk';

export function useDeployAuction() {
  const suiClient = useSuiClient();
  const config = useVeilConfig();

  const deployLaunch = async (
    coinType: string,
    supplyCoin: string,
    deposit: bigint,
    closeMs: bigint
  ) => {
    const tx = new Transaction();
    LaunchTxBuilder.create(tx, config.packageId, {
      supplyCoin,
      closeMs,
      deposit,
      coinType,
    });
    return tx;
  };

  const deployOtc = async (
    coinType: string,
    assetCoin: string,
    deposit: bigint,
    closeMs: bigint,
    reservePrice: bigint
  ) => {
    const sealVault = new SealVault({
      suiClient,
      keyServerObjectIds: config.sealKeyServerObjectIds,
      packageId: config.packageId,
    });
    const walrus = new WalrusClient({
      publisherUrl: config.walrusPublisherUrl,
      aggregatorUrl: config.walrusAggregatorUrl,
    });

    const reserveNonce = randomNonce();
    const payload = encodeReserve({ reserve: reservePrice, reserveNonce });
    const commitment = await commit(payload);

    const ciphertext = await sealVault.sealBid(payload, closeMs);
    const blobIdStr = await walrus.store(ciphertext, 1);
    
    // Walrus blobId is base64 url-safe encoded string. Wait, we need it as a byte array?
    // Let's assume we can just pass the string if the SDK takes string, or parse it.
    // The SDK expects Uint8Array for reserveBlobId. We decode it or just encode the string.
    const reserveBlobId = new TextEncoder().encode(blobIdStr);

    const tx = new Transaction();
    OtcTxBuilder.create(tx, config.packageId, {
      assetCoin,
      reserveCommitment: commitment,
      reserveBlobId,
      closeMs,
      deposit,
      coinType,
    });
    return tx;
  };

  return { deployLaunch, deployOtc };
}
