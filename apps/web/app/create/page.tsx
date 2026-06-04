'use client';

import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Mode = 'launch' | 'otc';

export default function CreatePage() {
  const [mode, setMode] = useState<Mode>('launch');

  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Create</p>
      <h1 className="text-3xl font-bold tracking-tight mb-8">New Sealed Auction</h1>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-8">
        {(['launch', 'otc'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 ease-snappy ${
              mode === m
                ? 'bg-white text-black'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {m === 'launch' ? 'Token Launch' : 'OTC Dark Pool'}
          </button>
        ))}
      </div>

      <div className="glass p-6 space-y-5">
        <Input label="Required Deposit" placeholder="500" suffix="SUI" type="number" />
        <Input label="Auction Duration" placeholder="120" suffix="minutes" type="number" />

        {mode === 'otc' && (
          <Input label="Hidden Reserve Price" placeholder="0" suffix="SUI" type="number" />
        )}

        <div className="pt-2">
          <Button className="w-full">
            {mode === 'launch' ? 'Deploy Token Sale' : 'Deploy OTC RFQ'}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
