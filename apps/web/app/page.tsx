'use client';

import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useActiveListings } from '@/hooks/useActiveListings';
import { Wallet, Database } from 'lucide-react';
import ActivityFeed from '@/components/ActivityFeed';
import dynamic from 'next/dynamic';

const GridScan = dynamic<any>(
  () => import('@/components/GridScan').then((m) => m.default),
  { ssr: false }
);
const SplitText = dynamic<any>(
  () => import('@/components/SplitText').then((m) => m.default),
  { ssr: false }
);
const Shuffle = dynamic<any>(
  () => import('@/components/Shuffle').then((m) => m.default),
  { ssr: false }
);
const ShapeGrid = dynamic<any>(
  () => import('@/components/ShapeGrid').then((m) => m.default),
  { ssr: false }
);

export default function Dashboard() {
  const account = useCurrentAccount();
  const { listings, isLoading } = useActiveListings();

  const { data: coins } = useSuiClientQuery(
    'getCoins',
    { owner: account?.address as string, coinType: '0x2::sui::SUI' },
    { enabled: !!account }
  );

  const balance = coins?.data.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) || 0n;

  const displayListings = listings;

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#050505]" style={{ minHeight: '88vh' }}>
        {/* GridScan — full-hero background */}
        <div className="absolute inset-0">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#ffffff"
            scanColor="#3ae86d"
            scanOpacity={0.4}
            gridScale={0.1}
            lineStyle="solid"
            lineJitter={0.1}
            scanDirection="pingpong"
            noiseIntensity={0.01}
            scanGlow={0.5}
            scanSoftness={2}
            scanDuration={2}
            scanDelay={2}
            scanOnClick={false}
          />
          {/* Vignette to keep text readable */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, rgba(5,5,5,0.75) 100%)',
            }}
          />
        </div>

        <Shell>
          {/* HERO SECTION */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center pt-24 pb-20">
          <div className="font-mono text-xs md:text-sm font-bold uppercase tracking-[0.25em] text-accent mb-8 mt-12">
            Decentralized Sealed-Bid Network
          </div>
          
          <h1 className="font-serif text-6xl md:text-[5.5rem] tracking-tight leading-[1.05] mb-8">
            Any bid.<br />
            Any size.<br />
            <span className="text-accent italic font-medium">Fully on-chain.</span>
          </h1>

          <p className="text-[#a1a1aa] max-w-xl mb-12 leading-relaxed text-lg font-light">
            Sealed bids. Zero front-running. Best price wins.<br/>
            Sellers define conditions. Buyers compete anonymously.
          </p>

          <div className="flex items-center gap-5">
            <Button href="/create" className="px-7 py-6 text-[15px] font-semibold !bg-accent !text-black rounded-full hover:!bg-[#4ade80] transition-colors border border-accent">
              Launch an Auction ➔
            </Button>
            <Button href="https://github.com/Sarnav07/Veil/blob/main/docs/WHITEPAPER.md" target="_blank" variant="secondary" className="px-7 py-6 text-[15px] font-medium !bg-transparent !text-white rounded-full border border-white/20 hover:!bg-white/10 transition-colors">
              Read Docs
            </Button>
          </div>

          {account && (
             <p className="text-sm text-text-secondary mt-8 font-mono bg-surface px-4 py-2 rounded-full border border-border-subtle">
               Connected: {Number(balance) / 1_000_000_000} SUI
             </p>
          )}
        </div>

        </Shell>
      </section>

      {/* ── Partners ──────────────────────────────────────── */}
      <section className="relative z-10" style={{ background: '#000000', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-8 py-10">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-text-secondary text-center mb-8">
            Integrated with
          </p>
          <div className="flex items-center justify-center flex-wrap gap-12 md:gap-20">
            {/* Sui Logo */}
            <div className="flex items-center gap-4 transition-all duration-[200ms]" style={{ opacity: 0.75 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
            >
              <img src="/logos/sui-new.png" alt="Sui logo" style={{ height: 46, width: 'auto', objectFit: 'contain', borderRadius: 8 }} />
              <span className="font-bold tracking-tight text-white" style={{ fontSize: '32px' }}>Sui</span>
            </div>

            {/* Walrus Logo */}
            <div className="flex items-center gap-4 transition-all duration-[200ms]" style={{ opacity: 0.75 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
            >
              <img src="/logos/walrus-new.png" alt="Walrus logo" style={{ height: 46, width: 'auto', objectFit: 'contain', borderRadius: 8 }} />
              <span className="font-bold tracking-tight text-white" style={{ fontSize: '32px' }}>Walrus</span>
            </div>

            {/* Tatum Logo */}
            <div className="flex items-center gap-3 transition-all duration-[200ms]" style={{ opacity: 0.75 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
            >
              <div style={{ height: 46, width: 46 }} className="relative flex items-center justify-center overflow-hidden">
                <img src="/logos/tatum-new.png" alt="Tatum logo" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
              </div>
              <span className="font-bold tracking-tight text-white" style={{ fontSize: '32px' }}>Tatum</span>
            </div>

          </div>
        </div>
      </section>

      <Shell>
        {/* HOW IT WORKS SECTION */}
        <div className="relative z-10 pt-24 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <div>
              <div className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-accent mb-6">
                HOW IT WORKS
              </div>
              <h2 className="font-serif leading-[1.05] mb-12 text-5xl md:text-6xl text-text-primary">
                Post an auction.<br />
                <span className="text-accent italic font-medium">Bidders compete.</span><br />
                Reveal on-chain.
              </h2>

              <div className="space-y-8">
                {[
                  {
                    step: '01',
                    heading: 'Create an Auction',
                    body: 'Deploy a sealed-bid auction or OTC dark pool. Specify the asset, deposit amount, and closing time.',
                  },
                  {
                    step: '02',
                    heading: 'Bidders Compete',
                    body: 'Buyers submit encrypted bids and deposits. No one can see the bids, preventing front-running and MEV.',
                  },
                  {
                    step: '03',
                    heading: 'Reveal & Settle',
                    body: 'Once the auction closes, bids are decrypted. The highest valid bid wins, and funds are settled entirely on-chain.',
                  },
                ].map((s) => (
                  <div key={s.step} className="flex gap-5 items-start">
                    <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold bg-accent-dim text-accent border border-accent/20">
                      {s.step}
                    </div>
                    <div>
                      <h3 className="font-sans font-bold text-lg mb-1.5 text-text-primary">
                        {s.heading}
                      </h3>
                      <p className="font-sans text-sm leading-relaxed text-text-secondary">
                        {s.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Graphic */}
            <div className="relative hidden lg:block min-h-[500px] w-full">
              <div className="absolute inset-0">
                {/* Back / Top Layer: Dashboard */}
                <div className="absolute top-[0%] right-[-5%] w-[550px] rounded-xl overflow-hidden border border-white/5 shadow-[0_0_40px_rgba(58,232,109,0.05)] transform rotate-[2deg] hover:rotate-0 hover:z-40 transition-all duration-500 hover:scale-105 opacity-50 hover:opacity-100 z-10 origin-center">
                  <img src="/screenshots/dashboard.png" alt="Veil Dashboard" className="w-full h-auto" />
                </div>
                
                {/* Middle Layer: Activity Feed */}
                <div className="absolute top-[35%] right-[-15%] w-[360px] rounded-xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(58,232,109,0.1)] transform rotate-[-4deg] hover:rotate-0 hover:z-40 transition-all duration-500 hover:scale-105 opacity-80 hover:opacity-100 z-20 origin-center bg-background">
                  <img src="/screenshots/activity-feed.png" alt="Veil Activity Feed" className="w-full h-auto" />
                </div>

                {/* Front Layer: Submit Bid */}
                <div className="absolute top-[50%] right-[20%] w-[420px] rounded-xl overflow-hidden border border-accent/20 shadow-[0_0_60px_rgba(58,232,109,0.15)] transform rotate-[1deg] hover:rotate-0 hover:z-40 transition-all duration-500 hover:scale-105 z-30 origin-center bg-background">
                  <img src="/screenshots/submit-bid.png" alt="Veil Submit Bid" className="w-full h-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIVE NETWORK SECTION */}
        <div className="relative z-10 pt-24 pb-16 border-t border-border-subtle/50">
          <div className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-text-secondary text-center mb-12">
            Live Network
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { eyebrow: 'Active Auctions', value: displayListings.length.toString(), delta: null },
              { eyebrow: 'Total TVL', value: displayListings.length > 0 ? displayListings.reduce((sum, l) => sum + parseFloat(l.deposit.split(' ')[0]), 0).toLocaleString() : '0', delta: 'SUI' },
              { eyebrow: 'Total OTC Pools', value: displayListings.filter(l => l.type === 'otc').length.toString(), delta: null },
              { eyebrow: 'Total Token Sales', value: displayListings.filter(l => l.type === 'launch').length.toString(), delta: null },
            ].map((kpi) => (
              <div key={kpi.eyebrow} className="p-6 border border-border-subtle rounded-2xl bg-[#000000] shadow-[0_0_0_1px_rgba(58,232,109,0.06)_inset]">
                <div className="font-mono text-[0.65rem] uppercase tracking-wider text-text-secondary mb-3">{kpi.eyebrow}</div>
                <div className="font-serif leading-none text-5xl text-text-primary">
                  <SplitText text={kpi.value} delay={50} duration={1} />
                </div>
                {kpi.delta && (
                  <div className="font-mono text-xs mt-2 text-accent">{kpi.delta}</div>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayListings.map((a) => {
              const closesInMs = a.closesMs - Date.now();
              const hrs = Math.max(0, Math.floor(closesInMs / (1000 * 60 * 60)));
              const mins = Math.max(0, Math.floor((closesInMs % (1000 * 60 * 60)) / (1000 * 60)));
              
              return (
                <Link key={a.id} href={`/participate/${a.id}?type=${a.type}`} className="no-underline">
                  <div className="glass px-5 py-5 transition-transform duration-150 ease-snappy hover:-translate-y-0.5 border hover:border-accent/50 group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[0.65rem] uppercase tracking-wider group-hover:text-accent transition-colors">{a.type === 'launch' ? 'Launch' : 'OTC'}</span>
                      <span className="text-xs text-text-secondary font-mono" suppressHydrationWarning>{hrs}h {mins}m left</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-1 truncate">{a.id.slice(0, 8)}...{a.id.slice(-4)}</h3>
                    <div className="flex items-center justify-between text-sm text-text-secondary font-mono">
                      <span>Deposit: {a.deposit}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-16">
            <ActivityFeed />
          </div>

        </div>

        {/* CTA BANNER */}
        <div className="relative z-10 pb-24">
          <div className="relative overflow-hidden px-10 py-16 text-center bg-[#000000] border border-border-subtle min-h-[400px] flex items-center justify-center" style={{ borderRadius: '22px' }}>
             {/* ShapeGrid Background */}
             <div className="absolute inset-0 z-0">
               <ShapeGrid speed={0.5} squareSize={40} direction="diagonal" borderColor="#53a04c" hoverFillColor="#4ec324" shape="square" hoverTrailAmount={0} />
             </div>
             {/* Vignette */}
             <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 100%)' }} />
             
             <div className="relative z-20 w-full max-w-2xl mx-auto">
                <div className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-text-secondary mb-6 block">
                  Open Network
                </div>
                <h2 className="font-serif leading-tight mb-6 text-text-primary" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
                  Any asset. Any size.<br />
                  <em className="text-accent italic font-medium">Fully on-chain.</em>
                </h2>
                <p className="font-sans text-base mb-10 max-w-md mx-auto text-text-secondary">
                  Create liquidity without MEV. Set your conditions. Let the market decide the best price fairly and anonymously.
                </p>
                <Link
                  href="/create"
                  className="inline-flex font-sans font-semibold text-base transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] bg-accent text-black"
                  style={{ borderRadius: '9999px', padding: '14px 32px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  Launch an Auction →
                </Link>
             </div>
          </div>
        </div>
      </Shell>
    </div>
  );
}
