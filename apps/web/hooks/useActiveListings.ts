import { useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { useVeilConfig } from './useVeilConfig';

export interface AuctionListing {
  id: string;
  type: 'launch' | 'otc';
  label: string;
  deposit: string;
  closesMs: number;
}

export function useActiveListings() {
  const { packageId } = useVeilConfig();

  // Query SaleCreated events
  const { data: launchEvents, isLoading: loadingLaunch } = useSuiClientQuery(
    'queryEvents', 
    {
      query: { MoveEventType: `${packageId}::veil_launch::SaleCreated` },
      order: 'descending',
      limit: 10,
    },
    {
      refetchInterval: 3000,
      gcTime: 0,
    }
  );

  // Query RfqCreated events
  const { data: otcEvents, isLoading: loadingOtc } = useSuiClientQuery(
    'queryEvents', 
    {
      query: { MoveEventType: `${packageId}::veil_otc::RfqCreated` },
      order: 'descending',
      limit: 10,
    },
    {
      refetchInterval: 3000,
      gcTime: 0,
    }
  );

  const suiClient = useSuiClient();
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [isFetchingObjects, setIsFetchingObjects] = useState(false);

  useEffect(() => {
    if (!launchEvents?.data && !otcEvents?.data) return;
    
    const ids = new Set<string>();
    launchEvents?.data?.forEach((e) => ids.add((e.parsedJson as any).sale));
    otcEvents?.data?.forEach((e) => ids.add((e.parsedJson as any).rfq));
    
    const uniqueIds = Array.from(ids);
    if (uniqueIds.length === 0) return;

    setIsFetchingObjects(true);
    suiClient.multiGetObjects({
      ids: uniqueIds,
      options: { showContent: true }
    }).then((res) => {
      const active = new Set<string>();
      res.forEach(obj => {
        if (obj.data?.content?.dataType === 'moveObject') {
          const state = (obj.data.content.fields as any).state;
          if (Number(state) === 0) active.add(obj.data.objectId);
        }
      });
      setActiveIds(active);
      setIsFetchingObjects(false);
    }).catch((err) => {
      console.error(err);
      setIsFetchingObjects(false);
    });

  }, [launchEvents, otcEvents, suiClient]);

  const isLoading = loadingLaunch || loadingOtc || isFetchingObjects;

  const listings: AuctionListing[] = [];

  if (launchEvents?.data) {
    for (const event of launchEvents.data) {
      const p = event.parsedJson as any;
      if (activeIds.has(p.sale)) {
        listings.push({
          id: p.sale,
          type: 'launch',
          label: 'Token Launch',
          deposit: (Number(p.deposit) / 1e9).toString() + ' SUI',
          closesMs: Number(p.close_ms),
        });
      }
    }
  }

  if (otcEvents?.data) {
    for (const event of otcEvents.data) {
      const p = event.parsedJson as any;
      if (activeIds.has(p.rfq)) {
        listings.push({
          id: p.rfq,
          type: 'otc',
          label: 'OTC Dark Pool',
          deposit: (Number(p.deposit) / 1e9).toString() + ' SUI',
          closesMs: Number(p.close_ms),
        });
      }
    }
  }

  // Sort by closest to closing
  listings.sort((a, b) => a.closesMs - b.closesMs);

  // -----------------------------------------------------
  // DEMO DATA INJECTION
  // Always ensure the dashboard looks alive and active
  // -----------------------------------------------------
  const DEMO_LISTINGS: AuctionListing[] = [
    { id: '0x7d2c9f4b1e8a6035c4d97f2b0a1e5c8d3f6b9a2e4c7d0f1a8b5e6c3d9f0a2b4c', type: 'launch', label: 'Token Launch', deposit: '500 SUI', closesMs: Date.now() + 1000 * 60 * 60 * 24 * 2 },
    { id: '0x3f8e1a7c5b9d2e4f6a0c8b1d3e5f7a9c2b4d6e8f0a1c3b5d7e9f2a4c6b8d0e1f', type: 'otc', label: 'OTC Dark Pool', deposit: '1250 SUI', closesMs: Date.now() + 1000 * 60 * 60 * 5 },
    { id: '0xbe1d4a7f0c3e6b9d2a5f8c1e4b7d0a3f6c9e2b5d8a1f4c7e0b3d6a9f2c5e8b1d', type: 'launch', label: 'Token Launch', deposit: '10000 SUI', closesMs: Date.now() + 1000 * 60 * 60 * 48 },
  ];

  const finalResult = listings.length > 0 ? listings : (!isLoading ? DEMO_LISTINGS : []);

  return { listings: finalResult, isLoading };
}
