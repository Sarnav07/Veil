'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuctionListing } from '../hooks/useActiveListings';

// Generate a deterministic gradient color based on auction ID
function getGradient(id: string) {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 2) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 80%, 60%), hsl(${hue2}, 80%, 40%))`;
}

function formatAddr(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function timeRemaining(ms: number) {
  const now = Date.now();
  if (ms < now) return 'Closed';
  const s = Math.floor((ms - now) / 1000);
  if (s < 60) return `${s}s left`;
  if (s < 3600) return `${Math.floor(s / 60)}m left`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left`;
}

const statusConfig = {
  live: { tick: '#2DC964', text: '#2DC964', label: 'LIVE', pulse: true },
  closed: { tick: '#262C39', text: 'var(--text-muted)', label: 'CLOSED', pulse: false },
};

const capabilityStyles = {
  'launch': { bg: 'rgba(45,201,100,0.08)', text: '#19B254', border: 'rgba(45,201,100,0.2)' },
  'otc': { bg: 'rgba(129,105,216,0.08)', text: '#8169D8', border: 'rgba(129,105,216,0.2)' },
};

export default function AuctionCard({ auction }: { auction: AuctionListing }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(auction.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const isLive = auction.closesMs > Date.now();
  const status = isLive ? statusConfig.live : statusConfig.closed;
  const capStyle = capabilityStyles[auction.type];

  // Make the deposit amount look like the Reputation score
  const depositParts = auction.deposit.replace(' SUI', '').split('.');
  const intPart = depositParts[0];
  const decPart = depositParts.length > 1 ? depositParts[1].substring(0, 3) : '000';
  const accentColor = isLive ? '#2DC964' : '#F5B041';

  return (
    <Link href={`/participate/${auction.id}?type=${auction.type}`} className="no-underline block">
      <div
        className="cursor-pointer border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          background: '#000000',
          borderColor: 'rgba(255,255,255,0.1)',
          borderRadius: 'var(--r-lg, 12px)',
          padding: '20px',
          boxShadow: '0 0 0 1px rgba(45,201,100,0.06) inset',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(45,201,100,0.3)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Top row: Avatar + address + status badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar blockie */}
            <div 
              className="w-11 h-11 rounded-full flex-shrink-0 border border-white/10"
              style={{ background: getGradient(auction.id) }}
            />
            <div>
              <div className="font-mono text-sm" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {formatAddr(auction.id)}
              </div>
              <button
                onClick={handleCopy}
                className="font-mono text-[10px] mt-0.5 transition-colors flex items-center gap-1"
                style={{ color: 'var(--text-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                title="Copy address"
              >
                {copied ? '✓ copied' : '⧉ copy'}
              </button>
            </div>
          </div>

          {/* Status badge */}
          <span
            className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm border"
            style={{
              color: status.text,
              borderColor: `${status.tick}40`,
              background: `${status.tick}10`,
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${status.pulse ? 'animate-pulse' : ''}`}
              style={{ background: status.tick }}
            />
            {status.label}
          </span>
        </div>

        {/* Score -> Deposit Amount */}
        <div className="mb-4">
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-text-subtle mb-2">Deposit Required</div>
          <div className="font-serif leading-none" style={{ fontSize: 28 }}>
            <em style={{ color: accentColor, fontStyle: 'italic' }}>{intPart}</em>
            <span style={{ color: 'var(--text-subtle)' }}>.</span>
            <span style={{ color: 'var(--text-muted)' }}>{decPart}</span>
            <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-subtle)', fontSize: 11 }}>
              SUI
            </span>
          </div>
        </div>

        {/* Capabilities -> Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span
            className="font-mono text-[10px] border"
            style={{
              background: capStyle.bg,
              color: capStyle.text,
              borderColor: capStyle.border,
              borderRadius: '9999px',
              padding: '3px 8px',
            }}
          >
            {auction.label}
          </span>
          <span
            className="font-mono text-[10px] border"
            style={{
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-subtle)',
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: '9999px',
              padding: '3px 8px',
            }}
          >
            sealed-bid
          </span>
        </div>

        {/* Footer stats */}
        <div
          className="flex items-center justify-between font-mono text-[11px] pt-4 border-t"
          style={{ color: 'var(--text-subtle)', borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <span suppressHydrationWarning>{timeRemaining(auction.closesMs)}</span>
          <span className="text-accent/60">0% fee</span>
        </div>
      </div>
    </Link>
  );
}
