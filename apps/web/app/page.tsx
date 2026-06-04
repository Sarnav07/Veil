'use client';

import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useActiveListings } from '@/hooks/useActiveListings';
import { Wallet, Database } from 'lucide-react';

export default function Dashboard() {
  const account = useCurrentAccount();
  const { listings, isLoading } = useActiveListings();

  const { data: coins } = useSuiClientQuery(
    'getCoins',
    { owner: account?.address as string, coinType: '0x2::sui::SUI' },
    { enabled: !!account }
  );

  const balance = coins?.data.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) || 0n;

  return (
    <>
      <div className="animated-grid-bg">
        <div className="animated-grid"></div>
      </div>

      <Shell>
        {/* HERO SECTION */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center pt-24 pb-32">
          <p className="eyebrow text-accent mb-6">Decentralized Sealed-Bid Network</p>
          
          <h1 className="font-serif text-6xl md:text-8xl tracking-tight leading-[1.1] mb-6">
            Any bid.<br />
            Any size.<br />
            <span className="text-accent italic">Fully on-chain.</span>
          </h1>

          <p className="text-text-secondary max-w-lg mb-10 leading-relaxed text-lg">
            Sealed bids. Zero front-running. Best price wins.<br/>
            Sellers define conditions. Buyers compete anonymously.
          </p>

          <div className="flex items-center gap-4">
            <Link href="/create">
              <Button className="px-8 py-3 text-base">Launch an Auction ➔</Button>
            </Link>
            <Button variant="secondary" className="px-8 py-3 text-base">Read Docs</Button>
          </div>

          {account && (
             <p className="text-sm text-text-secondary mt-8 font-mono bg-surface px-4 py-2 rounded-full border border-border-subtle">
               Connected: {Number(balance) / 1_000_000_000} SUI
             </p>
          )}
        </div>

        {/* LIVE NETWORK SECTION */}
        <div className="relative z-10 pt-16 border-t border-border-subtle/50">
          <div className="flex items-center justify-between mb-8">
            <h2 className="eyebrow tracking-[0.2em]">Live Network</h2>
          </div>

          {!account && (
            <div className="glass px-6 py-20 text-center flex flex-col items-center justify-center border-dashed border-border-subtle">
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 ring-1 ring-accent/20">
                <Wallet className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-text-secondary max-w-sm">
                Authenticate with your Sui wallet to view the live network and participate in sealed-bid auctions.
              </p>
            </div>
          )}

          {account && isLoading && (
            <div className="glass px-6 py-20 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 flex items-center justify-center mb-6">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-text-secondary animate-pulse">Scanning the Sui network...</p>
            </div>
          )}

          {account && !isLoading && listings.length === 0 && (
            <div className="glass px-6 py-24 text-center flex flex-col items-center justify-center border-dashed border-border-subtle">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full"></div>
                <div className="relative h-16 w-16 rounded-full bg-surface-hover flex items-center justify-center ring-1 ring-border-subtle">
                  <Database className="w-8 h-8 text-text-secondary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-text-primary">No Active Auctions</h3>
              <p className="text-text-secondary max-w-sm mb-8">
                The network is currently quiet. Be the first to deploy a token launch or an OTC dark pool.
              </p>
              <Link href="/create">
                <Button className="px-6 py-2">Create an Auction</Button>
              </Link>
            </div>
          )}

          {account && !isLoading && listings.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((a) => {
                const closesInMs = a.closesMs - Date.now();
                const hrs = Math.max(0, Math.floor(closesInMs / (1000 * 60 * 60)));
                const mins = Math.max(0, Math.floor((closesInMs % (1000 * 60 * 60)) / (1000 * 60)));
                
                return (
                  <Link key={a.id} href={`/participate/${a.id}?type=${a.type}`} className="no-underline">
                    <div className="glass px-5 py-5 transition-transform duration-150 ease-snappy hover:-translate-y-0.5 border hover:border-accent/50 group">
                      <div className="flex items-center justify-between mb-3">
                        <span className="eyebrow group-hover:text-accent transition-colors">{a.type === 'launch' ? 'Launch' : 'OTC'}</span>
                        <span className="text-xs text-text-secondary">{hrs}h {mins}m left</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-1 truncate">{a.id.slice(0, 8)}...{a.id.slice(-4)}</h3>
                      <div className="flex items-center justify-between text-sm text-text-secondary">
                        <span>Deposit: {a.deposit}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Shell>
    </>
  );
}
