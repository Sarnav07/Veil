'use client';

import { Shell } from '@/components/layout/Shell';

const MOCK_RESULTS = [
  { rank: 1, address: '0x7a3f...e91c', amount: '1,200 SUI', winner: true },
  { rank: 2, address: '0x4b2d...a7f0', amount: '1,100 SUI', winner: true },
  { rank: 3, address: '0x9e1a...c3b8', amount: '900 SUI', winner: false },
  { rank: 4, address: '0x2c8f...d4e5', amount: '750 SUI', winner: false },
];

export default function RevealPage({ params }: { params: { id: string } }) {
  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Settlement</p>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Auction Results</h1>
      <p className="text-sm text-text-secondary font-mono mb-8 break-all">
        {params.id}
      </p>

      {/* Clearing summary */}
      <div className="glass p-5 mb-6">
        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <p className="eyebrow mb-1">Clearing Price</p>
            <p className="text-2xl font-bold text-accent">1,100 SUI</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Winners</p>
            <p className="text-2xl font-bold">2 / 4</p>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="eyebrow px-5 py-3 text-left font-medium">#</th>
              <th className="eyebrow px-5 py-3 text-left font-medium">Bidder</th>
              <th className="eyebrow px-5 py-3 text-right font-medium">Amount</th>
              <th className="eyebrow px-5 py-3 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_RESULTS.map((r) => (
              <tr key={r.rank} className="border-b border-border-subtle last:border-0">
                <td className="px-5 py-3 font-mono text-text-secondary">{r.rank}</td>
                <td className="px-5 py-3 font-mono">{r.address}</td>
                <td className="px-5 py-3 text-right">{r.amount}</td>
                <td className="px-5 py-3 text-right">
                  {r.winner ? (
                    <span className="text-success font-medium">Won</span>
                  ) : (
                    <span className="text-text-secondary">Refunded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Archive link */}
      <p className="mt-4 text-xs text-text-secondary text-center">
        Archive blob stored on Walrus · linked on-chain via <code className="text-accent">archive_blob_id</code>
      </p>
    </Shell>
  );
}
