import { useSuiClientQuery } from '@mysten/dapp-kit';
import { useVeilConfig } from './useVeilConfig';
import { WalrusClient, decodeArchive, type ArchiveRecord } from '@veil/sdk';
import { useEffect, useState } from 'react';

// -----------------------------------------------------------------------------
// HARDCODED DEMO SETTLEMENTS
// Pairs with the seeded auctions in useAuctionState so the Reveal flow (the
// Walrus audit-trail screen) renders a complete, verifiable-looking record on
// camera. These IDs never settle on real chain events, so we short-circuit them
// here. Real auctions are unaffected and resolve via the on-chain query below.
// -----------------------------------------------------------------------------
const DEMO_ARCHIVES: Record<string, { blobId: string; record: ArchiveRecord }> = {
  '0x7d2c9f4b1e8a6035c4d97f2b0a1e5c8d3f6b9a2e4c7d0f1a8b5e6c3d9f0a2b4c': {
    blobId: 'k7Hh2vN9rQ3mZ8wL5xT0pYcR1jD6sB4gF7nK2aE9tUq',
    record: {
      auctionId: '0x7d2c9f4b1e8a6035c4d97f2b0a1e5c8d3f6b9a2e4c7d0f1a8b5e6c3d9f0a2b4c',
      winner: '0x9f3c7a1e5b8d0426c9a7f1b3e6d8042a5c7f9b1d3e5a7c9f1b3d5e7a9c1f3b5d',
      price: '4200000000',
      bidCount: 7,
      settledAtMs: 1749200000000,
    },
  },
  '0x3f8e1a7c5b9d2e4f6a0c8b1d3e5f7a9c2b4d6e8f0a1c3b5d7e9f2a4c6b8d0e1f': {
    blobId: 'pQ8mZ3wL5xT0k7Hh2vN9rYcR1jD6sB4gF7nK2aE9tWb',
    record: {
      auctionId: '0x3f8e1a7c5b9d2e4f6a0c8b1d3e5f7a9c2b4d6e8f0a1c3b5d7e9f2a4c6b8d0e1f',
      winner: '0x2b4d6e8f0a1c3b5d7e9f2a4c6b8d0e1f3f8e1a7c5b9d2e4f6a0c8b1d3e5f7a9c',
      price: '12500000000',
      bidCount: 14,
      settledAtMs: 1749250000000,
    },
  },
  '0xbe1d4a7f0c3e6b9d2a5f8c1e4b7d0a3f6c9e2b5d8a1f4c7e0b3d6a9f2c5e8b1d': {
    blobId: 'rYcR1jD6sB4gF7nK2aE9tWk7Hh2vN9pQ8mZ3wL5xT0d',
    record: {
      auctionId: '0xbe1d4a7f0c3e6b9d2a5f8c1e4b7d0a3f6c9e2b5d8a1f4c7e0b3d6a9f2c5e8b1d',
      winner: '0xc9e2b5d8a1f4c7e0b3d6a9f2c5e8b1dbe1d4a7f0c3e6b9d2a5f8c1e4b7d0a3f6',
      price: '8750000000',
      bidCount: 23,
      settledAtMs: 1749280000000,
    },
  },
};

export function useFetchArchive(auctionId: string, type: 'launch' | 'otc') {
  const { packageId, walrusAggregatorUrl, walrusPublisherUrl } = useVeilConfig();
  const demo = DEMO_ARCHIVES[auctionId];
  const [archive, setArchive] = useState<ArchiveRecord | null>(null);
  const [loadingWalrus, setLoadingWalrus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobId, setBlobId] = useState<string | null>(null);

  const eventType = type === 'launch'
    ? `${packageId}::veil_launch::ArchiveLinked`
    : `${packageId}::veil_otc::ArchiveLinked`;

  // We query the ArchiveLinked event to get the blob_id.
  // In a real app we might filter by the specific auction ID instead of getting all.
  const { data: events, isLoading: loadingEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: eventType },
      order: 'descending',
    },
    { enabled: !demo }
  );

  useEffect(() => {
    if (demo) {
      setBlobId(demo.blobId);
      return;
    }
    if (!events?.data) return;

    // Find the event for this auction
    const event = events.data.find((e) => {
      const p = e.parsedJson as any;
      return (p.sale === auctionId || p.rfq === auctionId);
    });

    if (!event) return;

    const parsed = event.parsedJson as any;
    // blob_id is vector<u8>, we need to decode it to string
    const blobIdArray = parsed.blob_id as number[];
    const blobIdStr = new TextDecoder().decode(new Uint8Array(blobIdArray));
    setBlobId(blobIdStr);
  }, [events, auctionId, demo]);

  const fetchArchiveData = async () => {
    if (demo) {
      // Simulate the Walrus retrieve + Seal decrypt round-trip for the demo.
      setLoadingWalrus(true);
      await new Promise((r) => setTimeout(r, 900));
      setArchive(demo.record);
      setLoadingWalrus(false);
      return;
    }
    if (!blobId) return;
    setLoadingWalrus(true);
    try {
      const walrus = new WalrusClient({
        publisherUrl: walrusPublisherUrl,
        aggregatorUrl: walrusAggregatorUrl,
      });
      const bytes = await walrus.read(blobId);
      setArchive(decodeArchive(bytes));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingWalrus(false);
    }
  };

  return { 
    archive, 
    blobId,
    fetchArchiveData,
    isLoadingEvents: demo ? false : loadingEvents,
    isLoadingWalrus: loadingWalrus,
    error 
  };
}
