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
import { AlertCircle, Copy, Check } from 'lucide-react';

export default function ParticipatePage({ params }: { params: { id: string } }) {
  const account = useCurrentAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auctionType = searchParams.get('type') || 'launch';
  
  const [bidStr, setBidStr] = useState('');
  const [qtyStr, setQtyStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  
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
      setIsSuccess(true);
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
  const bidNum = Number(bidStr);
  const bidAmountNano = Number.isFinite(bidNum) && bidNum > 0
    ? BigInt(Math.floor(bidNum * 1_000_000_000))
    : 0n;
  const totalRequired = bidAmountNano + (auctionState?.deposit || 0n);
  const hasInsufficientBalance = !!account && !!bidStr && totalRequired > balance;

  if (auctionState.isLoading) {
    return (
      <Shell className="max-w-2xl flex items-center justify-center py-20">
        <p className="text-text-secondary animate-pulse">Loading auction state...</p>
      </Shell>
    );
  }

  if (auctionState.error || !auctionState.coinType) {
    return (
      <Shell className="max-w-xl mx-auto pt-24 pb-32 text-center">
        <div className="p-10 border border-border-subtle rounded-3xl bg-[#000000]">
          <AlertCircle className="w-10 h-10 text-error mx-auto mb-4" />
          <h1 className="font-serif text-3xl mb-2 text-text-primary">Auction Not Found</h1>
          <p className="text-sm text-text-secondary font-mono mb-8 break-all">
            No active auction exists at {params.id.slice(0, 10)}...{params.id.slice(-6)}
          </p>
          <Button href="/" className="px-8 py-3 !bg-white/5 !text-white border border-white/10 hover:!bg-white/10">
            Return to Dashboard
          </Button>
        </div>
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

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-serif">Bid Encrypted & Secured</h3>
            <p className="text-text-secondary text-center max-w-sm">
              Your sealed bid has been processed. The cipher will remain encrypted until the auction closes.
            </p>
            <div className="pt-6">
              <Button href="/" className="px-8 py-3 !bg-white/5 !text-white border border-white/10 hover:!bg-white/10">
                Return to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-border-subtle bg-[#0a0a0a]">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-secondary">Auction ID</span>
                <div className="flex items-center gap-2 font-mono text-text-primary ml-4">
                  <span>{params.id.slice(0, 10)}...</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(params.id);
                      setHasCopied(true);
                      setTimeout(() => setHasCopied(false), 2000);
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Copy full Auction ID"
                  >
                    {hasCopied ? <Check size={14} className="text-primary" /> : <Copy size={14} className="text-text-secondary hover:text-text-primary" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-secondary">Closes In</span>
                <span className="font-mono text-text-primary">
                  {hrs > 0 && `${hrs}h `}{mins}m
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Required Deposit</span>
                <span className="font-mono text-text-primary">
                  {Number(auctionState.deposit) / 1_000_000_000} SUI
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-lg bg-error/10 border border-error/20 flex items-start gap-3 text-error text-sm">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {auctionType === 'launch' && (
              <div className="space-y-2 relative group">
                <label className="text-xs font-mono uppercase tracking-wider text-text-secondary ml-1">
                  Quantity
                </label>
                <div className="relative">
                  <Input 
                    type="number"
                    placeholder="1000"
                    value={qtyStr}
                    onChange={(e) => setQtyStr(e.target.value)}
                    className="w-full text-lg pr-24 pl-4 py-4 !bg-[#050505] !border-border-subtle focus:!border-accent/50 transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-text-secondary uppercase">
                    Tokens
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 relative group">
              <label className="text-xs font-mono uppercase tracking-wider text-text-secondary ml-1 flex justify-between">
                <span>{auctionType === 'launch' ? 'Price per Token' : 'Total Quote'}</span>
                {rate && bidStr && (
                  <span className="text-accent">~${fiatValue} USD</span>
                )}
              </label>
              <div className="relative">
                <Input 
                  type="number"
                  placeholder="0.00"
                  value={bidStr}
                  onChange={(e) => setBidStr(e.target.value)}
                  className="w-full text-lg pr-16 pl-4 py-4 !bg-[#050505] !border-border-subtle focus:!border-accent/50 transition-colors font-mono"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-text-secondary">
                  SUI
                </div>
              </div>
            </div>

            <Button
              className="w-full py-6 text-base font-semibold !bg-accent !text-black rounded-full hover:!bg-[#4ade80] transition-colors border border-accent shadow-[0_0_20px_rgba(58,232,109,0.2)] mt-8"
              onClick={handleBid}
              disabled={isSubmitting || hasInsufficientBalance || closesInMs === 0}
            >
              {isSubmitting 
                ? 'Sealing Bid on Walrus...' 
                : closesInMs === 0 
                  ? 'Auction Closed' 
                  : hasInsufficientBalance 
                    ? 'Insufficient SUI' 
                    : `Submit Sealed ${auctionType === 'launch' ? 'Bid' : 'Quote'} ➔`}
            </Button>
            
            <p className="text-center text-xs text-text-secondary mt-4 max-w-sm mx-auto">
              Your bid is encrypted with Seal and stored on <a href="https://docs.walrus.site" target="_blank" rel="noreferrer" className="text-accent hover:underline">Walrus</a>. It cannot be decrypted until the auction closes.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
