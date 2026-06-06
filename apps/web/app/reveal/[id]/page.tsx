'use client';

import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { useFetchArchive } from '@/hooks/useFetchArchive';
import { useVeilConfig } from '@/hooks/useVeilConfig';
import { ExternalLink, Database } from 'lucide-react';

export default function RevealPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const auctionType = (searchParams.get('type') || 'launch') as 'launch' | 'otc';
  
  const { archive, blobId, fetchArchiveData, isLoadingEvents, isLoadingWalrus, error } = useFetchArchive(params.id, auctionType);
  const { walrusAggregatorUrl } = useVeilConfig();

  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Settlement</p>
      <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Auction Results</h1>
      <p className="text-sm text-text-secondary font-mono mb-8 break-all">
        {params.id}
      </p>

      {isLoadingEvents && (
        <div className="glass p-12 text-center text-text-secondary">
          <p className="animate-pulse">Locating archive on Sui...</p>
        </div>
      )}

      {error && (
        <div className="glass p-12 text-center text-error border-error/20">
          <p>{error}</p>
        </div>
      )}

      {!isLoadingEvents && !blobId && !error && (
        <div className="glass p-12 text-center text-text-secondary">
          <p>Auction has not been settled yet, or archive not found on chain.</p>
        </div>
      )}

      {blobId && !archive && !isLoadingWalrus && !error && (
        <div className="glass p-12 flex flex-col items-center justify-center space-y-6">
          <Database size={48} className="text-accent opacity-50" />
          <div className="text-center">
            <h3 className="font-serif text-2xl mb-2">Archive Found</h3>
            <p className="text-text-secondary mb-6">The sealed auction results are stored trustlessly on Walrus.</p>
          </div>
          <button 
            onClick={fetchArchiveData}
            className="px-8 py-3 bg-accent text-black font-semibold rounded-full hover:bg-[#3ae86d] transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(58,232,109,0.2)]"
          >
            Fetch Decrypted Record
          </button>
        </div>
      )}

      {isLoadingWalrus && (
        <div className="glass p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-accent animate-pulse font-mono tracking-widest uppercase">Retrieving and Decrypting from Walrus...</p>
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

          {/* Leaderboard */}
          <div className="glass overflow-hidden mb-8">
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

          {/* Walrus Raw Record Section */}
          <div className="glass border-accent/20 overflow-hidden">
            <div className="flex items-center justify-between bg-accent/5 px-5 py-3 border-b border-accent/10">
              <div className="flex items-center space-x-2 text-accent">
                <Database size={16} />
                <span className="eyebrow font-bold">Verified on Walrus</span>
              </div>
              {blobId && (
                <a 
                  href={`${walrusAggregatorUrl}/v1/${blobId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-xs text-text-secondary hover:text-accent transition-colors"
                >
                  <span className="font-mono">{blobId.substring(0, 8)}...{blobId.substring(blobId.length - 8)}</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="p-5 bg-[#0a0a0a] overflow-x-auto">
              <pre className="text-xs font-mono text-text-secondary leading-relaxed">
                {JSON.stringify(archive, null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
