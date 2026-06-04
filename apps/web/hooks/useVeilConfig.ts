export interface VeilConfig {
  packageId: string;
  walrusPublisherUrl: string;
  walrusAggregatorUrl: string;
  sealKeyServerObjectIds: string[];
}

export function useVeilConfig(): VeilConfig {
  const packageId = process.env.NEXT_PUBLIC_VEIL_PACKAGE_ID;
  const walrusPublisherUrl = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL;
  const walrusAggregatorUrl = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL;
  const sealKeyServerObjectIdsStr = process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS;

  if (!packageId || !walrusPublisherUrl || !walrusAggregatorUrl || !sealKeyServerObjectIdsStr) {
    throw new Error('Missing Veil frontend configuration in .env.local');
  }

  return {
    packageId,
    walrusPublisherUrl,
    walrusAggregatorUrl,
    sealKeyServerObjectIds: sealKeyServerObjectIdsStr.split(','),
  };
}
