'use client';

import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { useFetchArchive } from '@/hooks/useFetchArchive';

export default function RevealPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const auctionType = (searchParams.get('type') || 'launch') as 'launch' | 'otc';
  
  const { archive, isLoading, error } = useFetchArchive(params.id, auctionType);

  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Settlement</p>
      <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Auction Results</h1>
      <p className="text-sm text-text-secondary font-mono mb-8 break-all">
        {params.id}
      </p>

      {isLoading && (
        <div className="glass p-12 text-center text-text-secondary">
          <p>Fetching encrypted archive from Walrus...</p>
        </div>
      )}

      {error && (
        <div className="glass p-12 text-center text-error border-error/20">
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !archive && !error && (
        <div className="glass p-12 text-center text-text-secondary">
          <p>Auction has not been settled yet, or archive not found.</p>
        </div>
      )}

      {archive && (
        <>
          {/* Clearing summary */}
          <div className="glass p-5 mb-6">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <p className="eyebrow mb-1">Clearing Price</p>
                <p className="text-2xl font-bold text-accent">{(Number(archive.price) / 1e9).toFixed(2)} SUI</p>
              </div>
              <div>
                <p className="eyebrow mb-1">Total Bids</p>
                <p className="text-2xl font-bold">{archive.bidCount}</p>
              </div>
            </div>
          </div>

          {/* Leaderboard (Minimal for PoC since archive only stores winner info right now) */}
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="eyebrow px-5 py-3 text-left font-medium">Winner Address</th>
                  <th className="eyebrow px-5 py-3 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border-subtle last:border-0">
                  <td className="px-5 py-3 font-mono">{archive.winner}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-success font-medium">Won</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Archive link */}
      <p className="mt-4 text-xs text-text-secondary text-center">
        Archive blob stored on Walrus · linked on-chain via <code className="text-accent">archive_blob_id</code>
      </p>
    </Shell>
  );
}
