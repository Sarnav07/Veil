'use client';

import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ParticipatePage({ params }: { params: { id: string } }) {
  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Participate</p>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Submit Sealed Bid</h1>
      <p className="text-sm text-text-secondary font-mono mb-8 break-all">
        Auction: {params.id}
      </p>

      {/* Auction info */}
      <div className="glass p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="eyebrow mb-1">Status</p>
            <p className="text-sm font-semibold text-success">Open</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Closes In</p>
            <p className="text-sm font-semibold">2h 14m</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Deposit</p>
            <p className="text-sm font-semibold">500 SUI</p>
          </div>
        </div>
      </div>

      {/* Privacy indicator */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 mb-6">
        <p className="text-xs text-accent">
          🔒 Your bid will be encrypted with Seal and stored on Walrus.
          Only the SHA-256 commitment goes on-chain — the amount stays hidden until settlement.
        </p>
      </div>

      {/* Bid form */}
      <div className="glass p-6 space-y-5">
        <Input label="Bid Amount" placeholder="0.00" suffix="SUI" type="number" />

        <p className="text-xs text-text-secondary">
          ≈ $0.00 USD <span className="text-text-secondary/50">· rate via Tatum</span>
        </p>

        <Button className="w-full">Encrypt &amp; Submit Bid</Button>
      </div>
    </Shell>
  );
}
