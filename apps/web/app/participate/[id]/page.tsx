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
  const [qtyStr, setQtyStr] = useState('');
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
    if (auctionType === 'launch') {
      if (!qtyStr) return setErrorMsg('Please enter a quantity.');
      if (isNaN(Number(qtyStr)) || Number(qtyStr) <= 0) return setErrorMsg('Please enter a valid positive quantity.');
    }
    if (isNaN(Number(bidStr)) || Number(bidStr) <= 0) return setErrorMsg('Please enter a valid positive bid amount.');
    
    setIsSubmitting(true);
    try {
      const price = BigInt(Math.floor(Number(bidStr) * 1_000_000_000));
      const coinType = auctionState.coinType;
      
      let tx;
      if (auctionType === 'launch') {
        const qty = BigInt(Math.floor(Number(qtyStr) * 1_000_000_000));
        tx = await submitLaunchBid(coinType, params.id, BigInt(auctionState.deposit), price, qty, BigInt(auctionState.closeMs));
      } else {
        tx = await submitOtcQuote(coinType, params.id, BigInt(auctionState.deposit), price, BigInt(auctionState.closeMs));
      }

      await signAndExecute({ transaction: tx });
      router.push('/');
    } catch (err: any) {

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
  const bidAmountNano = BigInt(Math.floor(Number(bidStr || '0') * 1_000_000_000));
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
    <Shell className="max-w-xl mx-auto pt-24 pb-32">
      <div className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-accent mb-6 text-center">
        Participate
      </div>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tight leading-none mb-4 text-center text-text-primary">
        Submit <em className="text-accent italic font-medium">Sealed</em> Bid
      </h1>
      <p className="text-sm text-text-secondary font-mono mb-12 text-center max-w-sm mx-auto break-all bg-white/5 py-2 px-4 rounded-full border border-border-subtle">
        Auction: {params.id.slice(0, 10)}...{params.id.slice(-6)}
      </p>

      {/* Auction info */}
      <div className="p-6 mb-8 border border-border-subtle rounded-3xl bg-[#000000] shadow-[0_0_0_1px_rgba(58,232,109,0.06)_inset]">
        <div className="grid grid-cols-3 gap-6 text-center divide-x divide-border-subtle/50">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-secondary mb-2">Status</p>
            {auctionState.isClosed ? (
              <p className="text-lg font-serif text-error">Closed</p>
            ) : (
              <p className="text-lg font-serif text-success">Open</p>
            )}
          </div>
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-secondary mb-2">Closes In</p>
            <p className="text-lg font-serif text-text-primary">
              {auctionState.isClosed ? 'Ended' : `${hrs}h ${mins}m`}
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-text-secondary mb-2">Deposit</p>
            <p className="text-lg font-serif text-text-primary">
              {(Number(auctionState.deposit) / 1e9).toString()} <span className="text-xs text-accent">SUI</span>
            </p>
          </div>
        </div>
      </div>

      {/* Privacy indicator */}
      <div className="rounded-2xl border border-accent/20 bg-accent/5 px-6 py-4 mb-8">
        <p className="text-sm text-accent font-sans leading-relaxed">
          <span className="font-bold mr-2">🔒 END-TO-END ENCRYPTED</span><br/>
          Your bid will be encrypted with Seal and stored on Walrus.
          Only the SHA-256 commitment goes on-chain — the amount stays hidden until settlement.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-error/50 bg-error/10 px-6 py-4 mb-8 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error font-mono">{errorMsg}</p>
        </div>
      )}

      {/* Bid form */}
      <div className="p-8 border border-border-subtle rounded-3xl bg-[#000000] shadow-[0_0_0_1px_rgba(58,232,109,0.06)_inset] space-y-8 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

        {auctionState.isClosed && (
          <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
            <p className="text-2xl font-serif text-text-primary mb-2">Auction Closed</p>
            <p className="text-sm font-mono text-accent animate-pulse">Waiting for Keeper settlement...</p>
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

        {auctionType === 'launch' && (
          <Input 
            label="Bid Quantity" 
            placeholder="How many tokens do you want?" 
            type="number"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            disabled={auctionState.isClosed}
          />
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary font-mono">
            ≈ ${fiatValue} USD <span className="text-text-secondary/50">· via Tatum</span>
          </p>
          {account && (
            <p className={`text-xs font-mono ${hasInsufficientBalance ? 'text-error' : 'text-text-secondary'}`}>
              Balance: {(Number(balance) / 1e9).toFixed(2)} SUI
            </p>
          )}
        </div>

        <div className="pt-4">
          <Button 
            className="w-full py-6 text-base font-semibold !bg-accent !text-black rounded-full hover:!bg-[#4ade80] transition-colors border border-accent shadow-[0_0_20px_rgba(58,232,109,0.2)]"
            onClick={handleBid}
            disabled={!account || isSubmitting || auctionState.isClosed || !bidStr || hasInsufficientBalance || Number(bidStr) <= 0}
          >
            {hasInsufficientBalance ? 'Insufficient Balance' : isSubmitting ? 'Submitting on-chain...' : 'Encrypt & Submit Bid ➔'}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
