'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useSubmitBid } from '@/hooks/useSubmitBid';
import { useAuctionState } from '@/hooks/useAuctionState';
import { AlertCircle } from 'lucide-react';

export default function ParticipatePage({ params }: { params: { id: string } }) {
  const account = useCurrentAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auctionType = searchParams.get('type') || 'launch';
  
  const [bidStr, setBidStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { data: rate } = useExchangeRate();
  const { submitLaunchBid, submitOtcQuote } = useSubmitBid();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const auctionState = useAuctionState(params.id);

  const { data: coins } = useSuiClientQuery(
    'getCoins',
    { owner: account?.address as string, coinType: '0x2::sui::SUI' },
    { enabled: !!account }
  );
  
  const balance = coins?.data.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) || 0n;

  useEffect(() => {
    if (auctionState?.hasArchive) {
      router.push(`/reveal/${params.id}?type=${auctionType}`);
    }
  }, [auctionState?.hasArchive, params.id, auctionType, router]);

  const handleBid = async () => {
    setErrorMsg(null);
    if (!account) return setErrorMsg('Please connect your wallet first.');
    if (!bidStr || !auctionState) return;
    
    setIsSubmitting(true);
    try {
      const price = BigInt(Number(bidStr) * 1_000_000_000);
      const coinType = '0x2::sui::SUI'; // Dummy for PoC
      
      let tx;
      if (auctionType === 'launch') {
        const qty = 100n; // mock qty
        tx = await submitLaunchBid(coinType, params.id, '0x0', price, qty, BigInt(auctionState.closeMs));
      } else {
        tx = await submitOtcQuote(coinType, params.id, '0x0', price, BigInt(auctionState.closeMs));
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
        setErrorMsg(err.message || 'An unexpected error occurred while submitting.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fiatValue = rate && bidStr ? (Number(bidStr) * rate).toFixed(2) : '0.00';
  const bidAmountNano = BigInt(Number(bidStr) * 1_000_000_000);
  const totalRequired = bidAmountNano + (auctionState?.deposit || 0n);
  const hasInsufficientBalance = !!account && !!bidStr && totalRequired > balance;

  if (auctionState.isLoading) {
    return (
      <Shell className="max-w-2xl flex items-center justify-center py-20">
        <p className="text-text-secondary animate-pulse">Loading auction state...</p>
      </Shell>
    );
  }

  const closesInMs = Math.max(0, auctionState.closeMs - Date.now());
  const hrs = Math.floor(closesInMs / (1000 * 60 * 60));
  const mins = Math.floor((closesInMs % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <Shell className="max-w-2xl">
      <p className="eyebrow text-accent mb-2">Participate</p>
      <h1 className="text-3xl font-bold tracking-tight mb-2 font-serif">Submit Sealed Bid</h1>
      <p className="text-sm text-text-secondary font-mono mb-8 break-all">
        Auction: {params.id}
      </p>

      {/* Auction info */}
      <div className="glass p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="eyebrow mb-1">Status</p>
            {auctionState.isClosed ? (
              <p className="text-sm font-semibold text-error">Closed</p>
            ) : (
              <p className="text-sm font-semibold text-success">Open</p>
            )}
          </div>
          <div>
            <p className="eyebrow mb-1">Closes In</p>
            <p className="text-sm font-semibold">
              {auctionState.isClosed ? 'Ended' : `${hrs}h ${mins}m`}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">Deposit</p>
            <p className="text-sm font-semibold">
              {(Number(auctionState.deposit) / 1e9).toString()} SUI
            </p>
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

      {errorMsg && (
        <div className="rounded-xl border border-error/50 bg-error/10 px-4 py-3 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{errorMsg}</p>
        </div>
      )}

      {/* Bid form */}
      <div className="glass p-6 space-y-5 relative">
        {auctionState.isClosed && (
          <div className="absolute inset-0 z-10 bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl border border-border-subtle">
            <p className="text-lg font-semibold mb-2">Auction Closed</p>
            <p className="text-sm text-text-secondary animate-pulse">Waiting for Keeper settlement...</p>
          </div>
        )}

        <Input 
          label="Bid Amount" 
          placeholder="0.00" 
          suffix="SUI" 
          type="number"
          value={bidStr}
          onChange={(e) => setBidStr(e.target.value)}
          disabled={auctionState.isClosed}
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            ≈ ${fiatValue} USD <span className="text-text-secondary/50">· rate via Tatum</span>
          </p>
          {account && (
            <p className={`text-xs ${hasInsufficientBalance ? 'text-error' : 'text-text-secondary'}`}>
              Balance: {(Number(balance) / 1e9).toFixed(2)} SUI
            </p>
          )}
        </div>

        <Button 
          className="w-full text-base py-3" 
          onClick={handleBid}
          disabled={!account || isSubmitting || auctionState.isClosed || !bidStr || hasInsufficientBalance || Number(bidStr) <= 0}
        >
          {hasInsufficientBalance ? 'Insufficient Balance' : isSubmitting ? 'Submitting...' : 'Encrypt & Submit Bid'}
        </Button>
      </div>
    </Shell>
  );
}
