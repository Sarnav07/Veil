import { useSuiClientQuery } from '@mysten/dapp-kit';
import { useMemo } from 'react';

export interface AuctionState {
  id: string;
  closeMs: number;
  deposit: bigint;
  hasArchive: boolean;
  archiveBlobId: string | null;
  isClosed: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useAuctionState(auctionId: string) {
  const { data, isLoading, error } = useSuiClientQuery(
    'getObject',
    {
      id: auctionId,
      options: { showContent: true },
    },
    {
      refetchInterval: 5000,
    }
  );

  const state = useMemo<AuctionState | null>(() => {
    if (!data?.data?.content || data.data.content.dataType !== 'moveObject') {
      return null;
    }

    const fields = data.data.content.fields as any;
    const closeMs = Number(fields.close_ms);
    const deposit = BigInt(fields.deposit);
    
    // archive_blob_id is an Option<vector<u8>>
    let archiveBlobId: string | null = null;
    if (fields.archive_blob_id) {
      const isSome = fields.archive_blob_id.type?.includes('::option::Some') ?? fields.archive_blob_id !== null;
      if (isSome) {
        // Handle varying representation of Sui Option fields
        const vec = fields.archive_blob_id.fields?.vec || fields.archive_blob_id;
        if (Array.isArray(vec) && vec.length > 0) {
          // Inner value is a vector of u8
          const bytesArray = vec[0];
          if (Array.isArray(bytesArray)) {
            archiveBlobId = new TextDecoder().decode(new Uint8Array(bytesArray));
          }
        }
      }
    }

    return {
      id: auctionId,
      closeMs,
      deposit,
      hasArchive: archiveBlobId !== null,
      archiveBlobId,
      isClosed: Date.now() >= closeMs,
      isLoading: false,
      error: null,
    };
  }, [data, auctionId]);

  if (isLoading || !state) {
    return { isLoading: true, error: error as Error | null } as AuctionState;
  }

  return state;
}
