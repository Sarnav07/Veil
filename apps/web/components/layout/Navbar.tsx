'use client';

import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';
import { useExchangeRate } from '@/hooks/useExchangeRate';

// Live SUI/USD pill — sourced from the Tatum Data API via /api/rates. Puts a
// real, ticking data point in the header for the demo.
function LivePrice() {
  const { data: rate, isLoading } = useExchangeRate();
  return (
    <div
      className="hidden md:flex items-center gap-2 font-mono text-[0.7rem] rounded-full border border-border-subtle px-3 py-1.5"
      title="Live SUI/USD via Tatum Data API"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      <span className="text-text-secondary">SUI</span>
      <span className="text-text-primary font-semibold" suppressHydrationWarning>
        {isLoading || rate == null ? '—' : `$${rate.toFixed(4)}`}
      </span>
    </div>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-transparent">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 no-underline group">
          <img src="/logos/veil-new.png" alt="Veil Protocol" className="h-[28px] w-[28px] object-contain group-hover:opacity-80 transition-opacity" />
          <div className="flex items-center gap-1.5 text-2xl leading-none pt-0.5">
            <span className="text-text-primary" style={{ fontFamily: 'var(--font-logo)' }}>VEIL</span>
            <span className="text-accent" style={{ fontFamily: 'var(--font-logo)' }}>PROTOCOL</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <LivePrice />
          <span className="hidden sm:block font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-text-secondary">
            Sui Testnet
          </span>
          <ConnectButton
            className="!bg-accent !text-black !rounded-full !px-5 !py-2.5 !text-sm !font-bold hover:!bg-[#34d399] !transition-all !shadow-[0_0_12px_var(--color-accent-dim)] hover:!shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:!-translate-y-0.5" 
          />
        </div>
      </nav>
    </header>
  );
}
