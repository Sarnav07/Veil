import { useSuiClientQuery } from '@mysten/dapp-kit';
import { useVeilConfig } from './useVeilConfig';
import { WalrusClient, decodeArchive, type ArchiveRecord } from '@veil/sdk';
import { useEffect, useState } from 'react';

export function useFetchArchive(auctionId: string, type: 'launch' | 'otc') {
  const { packageId, walrusAggregatorUrl, walrusPublisherUrl } = useVeilConfig();
  const [archive, setArchive] = useState<ArchiveRecord | null>(null);
  const [loadingWalrus, setLoadingWalrus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventType = type === 'launch' 
    ? `${packageId}::veil_launch::ArchiveLinked` 
    : `${packageId}::veil_otc::ArchiveLinked`;

  // We query the ArchiveLinked event to get the blob_id.
  // In a real app we might filter by the specific auction ID instead of getting all.
  const { data: events, isLoading: loadingEvents } = useSuiClientQuery('queryEvents', {
    query: { MoveEventType: eventType },
    order: 'descending',
  });

  useEffect(() => {
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

    const fetchWalrus = async () => {
      setLoadingWalrus(true);
      try {
        const walrus = new WalrusClient({
          publisherUrl: walrusPublisherUrl,
          aggregatorUrl: walrusAggregatorUrl,
        });
        const bytes = await walrus.read(blobIdStr);
        setArchive(decodeArchive(bytes));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingWalrus(false);
      }
    };

    fetchWalrus();
  }, [events, auctionId, walrusAggregatorUrl, walrusPublisherUrl]);

  return { 
    archive, 
    isLoading: loadingEvents || loadingWalrus,
    error 
  };
}
