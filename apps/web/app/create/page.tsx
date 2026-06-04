'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDeployAuction } from '@/hooks/useDeployAuction';
import { AlertCircle } from 'lucide-react';

type Mode = 'launch' | 'otc';

export default function CreatePage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('launch');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [depositStr, setDepositStr] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [reserveStr, setReserveStr] = useState('');
  // For simplicity, we hardcode supplyCoin/assetCoin to 0x2::sui::SUI for testnet.
  // In a real flow, the user would select from their wallet.
  const coinType = '0x2::sui::SUI';

  const { deployLaunch, deployOtc } = useDeployAuction();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const handleDeploy = async () => {
    setErrorMsg(null);
    if (!account) return setErrorMsg('Please connect your wallet first.');
    if (!depositStr || !durationStr || (mode === 'otc' && !reserveStr)) {
      return setErrorMsg('Please fill in all required fields.');
    }
    
    setIsSubmitting(true);
    try {
      // 1 SUI = 1_000_000_000 MIST
      const deposit = BigInt(Number(depositStr) * 1_000_000_000);
      const closeMs = BigInt(Date.now() + Number(durationStr) * 60 * 1000);

      let tx;
      if (mode === 'launch') {
        tx = await deployLaunch(coinType, '0x0', deposit, closeMs);
      } else {
        const reserve = BigInt(Number(reserveStr) * 1_000_000_000);
        tx = await deployOtc(coinType, '0x0', deposit, closeMs, reserve);
      }

      await signAndExecute({ transaction: tx });
      router.push('/');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Rejected')) {
        // User cancelled in wallet, just reset state
        return;
      }
      if (err.message?.includes('Walrus')) {
        setErrorMsg('Decentralized storage timeout. Please try again.');
      } else {
        setErrorMsg(err.message || 'An unexpected error occurred while deploying.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Create</p>
      <h1 className="font-serif text-4xl font-bold tracking-tight mb-8">New Sealed Auction</h1>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-8">
        {(['launch', 'otc'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 ease-snappy ${
              mode === m
                ? 'bg-accent text-black shadow-[0_0_8px_var(--color-accent-dim)]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {m === 'launch' ? 'Token Launch' : 'OTC Dark Pool'}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-error/50 bg-error/10 px-4 py-3 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{errorMsg}</p>
        </div>
      )}

      <div className="glass p-6 space-y-5">
        <Input 
          label="Required Deposit" 
          placeholder="500" 
          suffix="SUI" 
          type="number" 
          value={depositStr}
          onChange={(e) => setDepositStr(e.target.value)}
        />
        <Input 
          label="Auction Duration" 
          placeholder="120" 
          suffix="minutes" 
          type="number"
          value={durationStr}
          onChange={(e) => setDurationStr(e.target.value)}
        />

        {mode === 'otc' && (
          <Input 
            label="Hidden Reserve Price" 
            placeholder="0" 
            suffix="SUI" 
            type="number"
            value={reserveStr}
            onChange={(e) => setReserveStr(e.target.value)}
          />
        )}

        <div className="pt-2">
          <Button 
            className="w-full text-base py-3" 
            onClick={handleDeploy}
            disabled={!account || isSubmitting}
          >
            {isSubmitting ? 'Deploying...' : mode === 'launch' ? 'Deploy Token Sale' : 'Deploy OTC RFQ'}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
