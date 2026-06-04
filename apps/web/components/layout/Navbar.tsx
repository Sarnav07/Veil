'use client';

import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-base/80 backdrop-blur-lg">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="text-xl font-bold tracking-[0.08em] text-accent">
            VEIL
          </span>
          <span className="eyebrow hidden sm:block">Protocol</span>
        </Link>

        <div className="flex items-center gap-3">
          <ConnectButton />
        </div>
      </nav>
    </header>
  );
}
