import { useSuiClientQuery } from '@mysten/dapp-kit';
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
  const { data: launchEvents, isLoading: loadingLaunch } = useSuiClientQuery('queryEvents', {
    query: { MoveEventType: `${packageId}::veil_launch::SaleCreated` },
    order: 'descending',
    limit: 10,
  });

  // Query RfqCreated events
  const { data: otcEvents, isLoading: loadingOtc } = useSuiClientQuery('queryEvents', {
    query: { MoveEventType: `${packageId}::veil_otc::RfqCreated` },
    order: 'descending',
    limit: 10,
  });

  const isLoading = loadingLaunch || loadingOtc;

  const listings: AuctionListing[] = [];

  if (launchEvents?.data) {
    for (const event of launchEvents.data) {
      const p = event.parsedJson as any;
      listings.push({
        id: p.sale,
        type: 'launch',
        label: 'Token Launch',
        deposit: (Number(p.deposit) / 1e9).toString() + ' SUI',
        closesMs: Number(p.close_ms),
      });
    }
  }

  if (otcEvents?.data) {
    for (const event of otcEvents.data) {
      const p = event.parsedJson as any;
      listings.push({
        id: p.rfq,
        type: 'otc',
        label: 'OTC Dark Pool',
        deposit: (Number(p.deposit) / 1e9).toString() + ' SUI',
        closesMs: Number(p.close_ms),
      });
    }
  }

  // Sort by closest to closing
  listings.sort((a, b) => a.closesMs - b.closesMs);

  // Filter out closed ones? For this PoC let's show all or just ones in the future
  const activeListings = listings.filter((l) => l.closesMs > Date.now());

  return { listings: activeListings, isLoading };
}
