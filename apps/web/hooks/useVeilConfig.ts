export interface VeilConfig {
  packageId: string;
  walrusPublisherUrl: string;
  walrusAggregatorUrl: string;
  sealKeyServerObjectIds: string[];
}

// Public testnet defaults so the dApp builds and runs out-of-the-box with zero
// configuration. None of these are secrets — they are the deployed VEIL package
// (see docs/ADDRESSES.md), public Walrus testnet HTTP endpoints, and Mysten's
// verified Seal key-server object ids. Override any of them with NEXT_PUBLIC_* env
// vars for a different deployment.
const DEFAULTS = {
  packageId: '0x67b75f6c83a888d8736f47297c1a2e7212e8d8b8b4d1062aace46d024d22e30c',
  walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
  sealKeyServerObjectIds:
    '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
} as const;

export function useVeilConfig(): VeilConfig {
  const packageId = process.env.NEXT_PUBLIC_VEIL_PACKAGE_ID || DEFAULTS.packageId;
  const walrusPublisherUrl =
    process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL || DEFAULTS.walrusPublisherUrl;
  const walrusAggregatorUrl =
    process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL || DEFAULTS.walrusAggregatorUrl;
  const sealKeyServerObjectIdsStr =
    process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS || DEFAULTS.sealKeyServerObjectIds;

  return {
    packageId,
    walrusPublisherUrl,
    walrusAggregatorUrl,
    sealKeyServerObjectIds: sealKeyServerObjectIdsStr.split(',').map((s) => s.trim()),
  };
}
