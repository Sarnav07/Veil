'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDeployAuction } from '@/hooks/useDeployAuction';
import { AlertCircle } from 'lucide-react';

type Mode = 'launch' | 'otc';

export default function CreatePage() {
  const account = useCurrentAccount();
  const [mode, setMode] = useState<Mode>('launch');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form state
  const [amountStr, setAmountStr] = useState('');
  const [depositStr, setDepositStr] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [reserveStr, setReserveStr] = useState('');
  const [coinTypeStr, setCoinTypeStr] = useState('0x2::sui::SUI');

  const { deployLaunch, deployOtc } = useDeployAuction();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const handleDeploy = async () => {
    setErrorMsg(null);
    if (!account) return setErrorMsg('Please connect your wallet first.');
    if (!amountStr || !depositStr || !durationStr || !coinTypeStr || !reserveStr) {
      return setErrorMsg('Please fill in all required fields.');
    }
    if (isNaN(Number(amountStr)) || Number(amountStr) <= 0) return setErrorMsg('Amount must be a positive number.');
    if (isNaN(Number(depositStr)) || Number(depositStr) <= 0) return setErrorMsg('Deposit must be a positive number.');
    if (isNaN(Number(durationStr)) || Number(durationStr) <= 0) return setErrorMsg('Duration must be a positive number.');
    if (isNaN(Number(reserveStr)) || Number(reserveStr) <= 0) return setErrorMsg('Reserve price must be a positive number.');
    
    setIsSubmitting(true);
    try {
      const amount = BigInt(Math.floor(Number(amountStr) * 1_000_000_000));
      const deposit = BigInt(Math.floor(Number(depositStr) * 1_000_000_000));
      const closeMs = BigInt(Date.now() + Math.floor(Number(durationStr) * 60 * 1000));
      const reserve = BigInt(Math.floor(Number(reserveStr) * 1_000_000_000));

      let tx;
      if (mode === 'launch') {
        tx = await deployLaunch(coinTypeStr, amount, deposit, closeMs, reserve);
      } else {
        tx = await deployOtc(coinTypeStr, amount, deposit, closeMs, reserve);
      }

      await signAndExecute({ transaction: tx });
      setIsSuccess(true);
    } catch (err: any) {
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
    <Shell className="max-w-xl mx-auto pt-24 pb-32">
      <div className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-accent mb-6 text-center">
        Create
      </div>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tight leading-none mb-12 text-center text-text-primary">
        New <em className="text-accent italic font-medium">Sealed</em> Auction
      </h1>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-12 p-1.5 bg-[#000000] rounded-full border border-border-subtle max-w-sm mx-auto shadow-[0_0_0_1px_rgba(58,232,109,0.06)_inset]">
        {(['launch', 'otc'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 ease-snappy ${
              mode === m
                ? 'bg-accent text-black shadow-[0_0_20px_rgba(58,232,109,0.2)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            {m === 'launch' ? 'Token Launch' : 'OTC Dark Pool'}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-error/50 bg-error/10 px-6 py-4 mb-8 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error font-mono">{errorMsg}</p>
        </div>
      )}

      <div className="p-8 border border-border-subtle rounded-3xl bg-[#000000] shadow-[0_0_0_1px_rgba(58,232,109,0.06)_inset] space-y-8 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-serif">Deployment Successful</h3>
            <p className="text-text-secondary text-center max-w-sm">
              Your {mode === 'launch' ? 'Token Sale' : 'OTC Dark Pool'} is now live and secured on-chain.
            </p>
            <div className="pt-6">
              <Button href="/" className="px-8 py-3 !bg-white/5 !text-white border border-white/10 hover:!bg-white/10">
                Return to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Input 
              label="Coin Type" 
              placeholder="0x2::sui::SUI" 
              type="text" 
              value={coinTypeStr}
              onChange={(e) => setCoinTypeStr(e.target.value)}
            />
            <Input 
              label={mode === 'launch' ? 'Token Supply to Auction' : 'Asset Amount to Sell'}
              placeholder="1000" 
              type="number" 
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
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

            <Input 
              label="Hidden Reserve Price" 
              placeholder="0" 
              suffix="SUI" 
              type="number"
              value={reserveStr}
              onChange={(e) => setReserveStr(e.target.value)}
            />

            <div className="pt-4">
              <Button 
                className="w-full py-6 text-base font-semibold !bg-accent !text-black rounded-full hover:!bg-[#4ade80] transition-colors border border-accent shadow-[0_0_20px_rgba(58,232,109,0.2)]"
                onClick={handleDeploy}
                disabled={!account || isSubmitting}
              >
                {isSubmitting ? 'Deploying on-chain...' : mode === 'launch' ? 'Deploy Token Sale ➔' : 'Deploy OTC Dark Pool ➔'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
