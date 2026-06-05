'use client';

import { useState, useEffect } from 'react';

interface ActivityEvent {
  id: string;
  type: 'launch' | 'bid' | 'settlement';
  summary: string;
  actors: string[];
  timestamp: number;
  txHash?: string;
}

type FilterType = 'all' | 'launch' | 'bid' | 'settlement';

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

const eventDot: Record<ActivityEvent['type'], string> = {
  launch: '#2DC964',     /* bio-400 - Green */
  bid: '#F5B041',        /* amber-400 - Yellow */
  settlement: '#8169D8', /* lilac-400 - Purple */
};

const eventLabel: Record<ActivityEvent['type'], string> = {
  launch: 'Auction',
  bid: 'Bid',
  settlement: 'Settle',
};

// Mock data to simulate network activity
const mockEvents: ActivityEvent[] = [
  { id: '1', type: 'bid', summary: 'Encrypted bid submitted: 500 SUI', actors: ['0x8eB4...245a'], timestamp: Date.now() - 45000, txHash: '0x25b5...eca6' },
  { id: '2', type: 'launch', summary: 'New Token Launch deployed', actors: ['0x54d1...3fdA'], timestamp: Date.now() - 120000, txHash: '0xc95e...eddb' },
  { id: '3', type: 'bid', summary: 'Encrypted bid submitted: 1200 SUI', actors: ['0xDCcA...3b59'], timestamp: Date.now() - 360000, txHash: '0xb7A0...09ea' },
  { id: '4', type: 'settlement', summary: 'OTC Dark Pool settled successfully', actors: ['0x9bdf...c1cc'], timestamp: Date.now() - 860000, txHash: '0x215C...F940' },
  { id: '5', type: 'bid', summary: 'Encrypted bid submitted: 250 SUI', actors: ['0x5819...1941'], timestamp: Date.now() - 1400000, txHash: '0x568a...aa92' },
];

export default function ActivityFeed({ filter: initialFilter = 'all', maxItems = 10 }: { filter?: FilterType, maxItems?: number }) {
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [events, setEvents] = useState<ActivityEvent[]>(mockEvents);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = events
    .filter((e) => activeFilter === 'all' || e.type === activeFilter)
    .slice(0, maxItems);

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'launch', label: 'Launch' },
    { key: 'bid', label: 'Bids' },
    { key: 'settlement', label: 'Settled' },
  ];

  if (!mounted) return null;

  return (
    <div
      className="border overflow-hidden"
      style={{
        background: '#000000',
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 'var(--r-lg, 12px)',
        boxShadow: '0 0 0 1px rgba(45,201,100,0.06) inset',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#000000' }}
      >
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-text-secondary">Network Activity</span>
        <div className="flex gap-1 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className="font-mono text-[9px] uppercase tracking-[0.06em] transition-all duration-[120ms]"
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: activeFilter === tab.key ? 'rgba(45,201,100,0.12)' : 'transparent',
                color: activeFilter === tab.key ? 'var(--accent)' : 'var(--text-subtle)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-[500px] overflow-y-auto divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {filtered.length === 0 ? (
          <div className="py-10 text-center font-sans text-sm px-4" style={{ color: 'var(--text-subtle)' }}>
            No recent activity.
          </div>
        ) : (
          filtered.map((event) => (
            <div
              key={event.id}
              className="py-4 px-4 flex items-start gap-3 transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(45,201,100,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Type dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: eventDot[event.type], boxShadow: `0 0 8px ${eventDot[event.type]}40` }}
              />

              <div className="flex-1 min-w-0">
                {/* Type eyebrow + summary */}
                <div
                  className="font-mono text-[9px] uppercase tracking-[0.08em] mb-1"
                  style={{ color: eventDot[event.type] }}
                >
                  {eventLabel[event.type]}
                </div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {event.summary}
                </p>

                {/* Actor links */}
                {event.actors.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 mt-1.5">
                    {event.actors.map((actor) => (
                      <span
                        key={actor}
                        className="font-mono text-[10px] transition-colors cursor-pointer"
                        style={{ color: 'var(--text-subtle)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                      >
                        {actor}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tx hash */}
                {event.txHash && (
                  <a
                    href={`https://suiscan.xyz/testnet/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] mt-1 inline-block transition-colors"
                    style={{ color: 'var(--text-subtle)', letterSpacing: '-0.01em' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                  >
                    {event.txHash} ↗
                  </a>
                )}
              </div>

              {/* Timestamp */}
              <span
                className="font-mono text-[9px] flex-shrink-0 mt-0.5"
                style={{ color: 'var(--text-subtle)' }}
                suppressHydrationWarning
              >
                {timeAgo(event.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
