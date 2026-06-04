'use client';

import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';


const MOCK_AUCTIONS = [
  { id: '0xabc1', type: 'launch' as const, label: 'TOKEN-A Sale', deposit: '500 SUI', closes: '2h 14m', bids: 12 },
  { id: '0xabc2', type: 'launch' as const, label: 'TOKEN-B Sale', deposit: '200 SUI', closes: '45m', bids: 8 },
  { id: '0xabc3', type: 'otc' as const, label: 'OTC RFQ #7', deposit: '1,000 SUI', closes: '6h 30m', bids: 3 },
];

export default function Dashboard() {
  const account = useCurrentAccount();

  const { data: coins } = useSuiClientQuery(
    'getCoins',
    { owner: account?.address as string, coinType: '0x2::sui::SUI' },
    { enabled: !!account }
  );

  const balance = coins?.data.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) || 0n;

  return (
    <Shell>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow text-accent mb-2">Dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight">Active Listings</h1>
          {account && (
             <p className="text-sm text-text-secondary mt-2">
               Balance: {Number(balance) / 1_000_000_000} SUI
             </p>
          )}
        </div>
        <Link href="/create">
          <Button>+ New Auction</Button>
        </Link>
      </div>

      {!account && (
        <div className="glass px-6 py-12 text-center">
          <p className="text-text-secondary">Connect your wallet to view and participate in auctions.</p>
        </div>
      )}

      {account && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_AUCTIONS.map((a) => (
            <Link key={a.id} href={`/participate/${a.id}`} className="no-underline">
              <div className="glass px-5 py-5 transition-transform duration-150 ease-snappy hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <span className="eyebrow">{a.type === 'launch' ? 'Launch' : 'OTC'}</span>
                  <span className="text-xs text-text-secondary">{a.closes} left</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">{a.label}</h3>
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Deposit: {a.deposit}</span>
                  <span>{a.bids} bids</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
