'use client';

import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';
import { Hexagon } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-transparent">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 no-underline group">
          <Hexagon className="h-[26px] w-[26px] text-accent group-hover:text-accent-hover transition-colors" strokeWidth={1.5} />
          <div className="flex items-center gap-1.5 text-2xl leading-none pt-0.5">
            <span className="text-text-primary" style={{ fontFamily: 'var(--font-logo)' }}>VEIL</span>
            <span className="text-accent" style={{ fontFamily: 'var(--font-logo)' }}>PROTOCOL</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
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
