import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useVeilConfig } from './useVeilConfig';
import { LaunchTxBuilder, OtcTxBuilder, SealVault, WalrusClient, randomNonce, commit, encodeReserve } from '@veil/sdk';

export function useDeployAuction() {
  const suiClient = useSuiClient();
  const config = useVeilConfig();

  const deployLaunch = async (
    coinType: string,
    supplyAmount: bigint, // Changed from supplyCoin: string
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
    const reserveBlobId = new TextEncoder().encode(blobIdStr);

    const tx = new Transaction();
    
    // Split the supply amount from gas since we assume coinType is SUI for now
    const [supplyCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(supplyAmount)]);

    LaunchTxBuilder.create(tx, config.packageId, {
      supplyCoin,
      reserveCommitment: commitment,
      reserveBlobId,
      closeMs,
      deposit,
      coinType,
    });
    return tx;
  };

  const deployOtc = async (
    coinType: string,
    assetAmount: bigint, // Changed from assetCoin: string
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
    const reserveBlobId = new TextEncoder().encode(blobIdStr);

    const tx = new Transaction();
    
    // Split the asset amount from gas
    const [assetCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(assetAmount)]);

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
