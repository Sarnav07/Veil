'use client';

import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';
import { Hexagon } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-base/80 backdrop-blur-lg">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 no-underline group">
          <Hexagon className="h-6 w-6 text-accent group-hover:text-accent-hover transition-colors" />
          <div className="flex items-center gap-1.5 font-bold tracking-[0.08em] text-xl">
            <span className="text-accent">VEIL</span>
            <span className="text-text-secondary font-medium">PROTOCOL</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <ConnectButton 
            className="!bg-accent !text-black !rounded-full !px-5 !py-2.5 !text-sm !font-bold hover:!bg-[#34d399] !transition-all !shadow-[0_0_12px_var(--color-accent-dim)] hover:!shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:!-translate-y-0.5" 
          />
        </div>
      </nav>
    </header>
  );
}
