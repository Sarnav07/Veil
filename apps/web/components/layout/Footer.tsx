'use client';


import Link from 'next/link';
import { Hexagon } from 'lucide-react';


export function Footer() {
  return (
    <footer className="mt-auto bg-[#000000]">
      {/* Get in touch row */}
      <div className="max-w-7xl mx-auto px-8 py-8 flex justify-end border-t border-border-subtle">
        <Link href="mailto:hello@veilprotocol.xyz" className="flex items-center gap-4 group no-underline">
          <span className="font-sans font-semibold text-xl text-text-primary">
            Get in touch
          </span>
          <span
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-transform duration-150 group-hover:scale-110 bg-accent text-black"
          >
            ↗
          </span>
        </Link>
      </div>

      {/* Big wordmark */}
      <div className="max-w-7xl mx-auto px-8 py-10 flex flex-nowrap items-center justify-center gap-4 md:gap-8 border-b border-border-subtle overflow-hidden">
        <div
          className="shrink-0 rounded-full flex items-center justify-center bg-accent/5 border border-accent/20"
          style={{ width: 'clamp(48px, 8vw, 120px)', height: 'clamp(48px, 8vw, 120px)' }}
        >
          <Hexagon className="w-1/2 h-1/2 text-accent" strokeWidth={1.5} />
        </div>
        <h2
          className="leading-none whitespace-nowrap flex items-baseline"
          style={{ fontFamily: 'var(--font-logo)', fontSize: 'clamp(32px, 8vw, 130px)' }}
        >
          <span
            style={{ color: 'var(--text-primary)', fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit' }}
          >
            VEIL
          </span>
          <span
            className="ml-2"
            style={{ color: '#3ae86d', fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit' }}
          >
            PROTOCOL
          </span>
        </h2>
      </div>

      {/* Copyright bar */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="font-sans text-sm text-text-secondary">
          © 2026 Veil Protocol. All rights reserved. · <a href="https://tatum.io/tatum-x-walrus-hackathon" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors no-underline text-inherit">Tatum x Walrus Hackathon</a>
        </p>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <p className="font-mono text-xs text-text-secondary uppercase tracking-widest">
            Sui Testnet
          </p>
        </div>
      </div>
    </footer>
  );
}
