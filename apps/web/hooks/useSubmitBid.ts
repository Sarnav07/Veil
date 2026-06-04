import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useVeilConfig } from './useVeilConfig';
import { LaunchTxBuilder, OtcTxBuilder, SealVault, WalrusClient, randomNonce, encodeLaunchBid, encodeQuote, commit } from '@veil/sdk';

export function useSubmitBid() {
  const suiClient = useSuiClient();
  const config = useVeilConfig();

  const submitLaunchBid = async (
    coinType: string,
    saleId: string,
    depositCoin: string,
    price: bigint,
    qty: bigint,
    closeMs: bigint
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

    const nonce = randomNonce();
    const payload = encodeLaunchBid({ price, qty, nonce });
    const commitment = await commit(payload);

    const ciphertext = await sealVault.sealBid(payload, closeMs);
    const blobIdStr = await walrus.store(ciphertext, 1);
    const blobId = new TextEncoder().encode(blobIdStr);

    const tx = new Transaction();
    LaunchTxBuilder.submitBid(tx, config.packageId, {
      sale: saleId,
      depositCoin,
      blobId,
      commitment,
      coinType,
    });
    return tx;
  };

  const submitOtcQuote = async (
    coinType: string,
    rfqId: string,
    depositCoin: string,
    price: bigint,
    closeMs: bigint
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

    const nonce = randomNonce();
    const payload = encodeQuote({ price, nonce });
    const commitment = await commit(payload);

    const ciphertext = await sealVault.sealBid(payload, closeMs);
    const blobIdStr = await walrus.store(ciphertext, 1);
    const blobId = new TextEncoder().encode(blobIdStr);

    const tx = new Transaction();
    OtcTxBuilder.submitQuote(tx, config.packageId, {
      rfq: rfqId,
      depositCoin,
      blobId,
      commitment,
      coinType,
    });
    return tx;
  };

  return { submitLaunchBid, submitOtcQuote };
}
