# Veil — Frontend Design & Performance Blueprint

This document is the single source of truth for all UI decisions, performance constraints, and component hierarchy for the Veil frontend, derived from our reference architecture analysis (`agent-net-frontend.vercel.app` & `overflow.sui.io`).

---

## 1. Visual Design Analysis (Reference Extraction)

Both references share a distinct **High-Tech Web3 / Minimalist Editorial** aesthetic.
- **Agent Net**: Tailwind-driven, ultra-snappy micro-animations (`duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]`), incredibly tight heading typography (`leading-[0.94] tracking-[-0.02em]`), and heavy use of "eyebrow" tags.
- **Sui Overflow**: Webflow-driven, heavily animated, deep dark-mode UI with subtle glowing gradients, glassmorphism cards (`border-white/10` with `backdrop-blur`), and structural grid backgrounds.

### Extracted Patterns:
- **Layout**: Centered, max-width shell (`max-w-6xl` or `1200px`), with generous vertical rhythm (`pt-28`, `pb-24`).
- **Typography**: Dual font strategy. A stark, geometric sans-serif (like Inter) for body/display, paired with a monospaced font for "code/eyebrow" labels to give a technical feel.
- **Colors**: Deep, pure blacks (`#000000` or `#0A0A0A`) paired with high-contrast stark white (`#FFFFFF`) and a vibrant primary accent (Sui Blue / Electric Cyan).
- **Animations**: Fast, purposeful, and structural. Snappy bezier curves for hover states; zero sluggishness.

---

## 2. Our Design Specification

We will build an interface that feels like a **high-end, institutional dark-pool terminal**. 
It must be brutally clean, completely devoid of clutter, with micro-animations that make it feel instantly responsive.

### 2.1 Color Tokens (Tailwind Config)
We are strictly **Dark Mode Only** to match the "dark pool / stealth" narrative.
- `bg-base`: `#050505` (Deepest off-black)
- `bg-surface`: `#121212` (Elevated card background)
- `bg-surface-hover`: `#1A1A1A` 
- `text-primary`: `#F3F4F6` (Gray-50)
- `text-secondary`: `#9CA3AF` (Gray-400)
- `accent`: `#38BDF8` (Sui Ocean Blue / Sky 400)
- `border-subtle`: `rgba(255, 255, 255, 0.08)`
- `status-success`: `#10B981` (Emerald)
- `status-error`: `#EF4444` (Red)

### 2.2 Typography Scale
Using `next/font` for zero layout shift.
- **Display/Headings**: `Inter` (or similar geometric sans).
  - *Style*: Extreme tight tracking (`-0.02em` to `-0.04em`), tight leading (`0.95` to `1.0`).
  - *Sizes*: `text-4xl` to `text-7xl` for hero moments.
- **Body**: `Inter`.
  - *Style*: Loose leading for readability (`1.6`), `text-base` to `text-lg`.
- **Technical/Eyebrow**: `JetBrains Mono` or `Roboto Mono`.
  - *Style*: Uppercase, `text-xs`, wide tracking (`0.05em`), used for tags, labels, and hex addresses.

### 2.3 Component Styles
- **Cards**: Flat surface (`bg-[#121212]`), 1px subtle inner border (`border-white/10`), subtle `backdrop-blur-md` if layered. Sharp or small radii (`rounded-xl`).
- **Buttons**: Pill-shaped (`rounded-full`), high contrast (White bg, black text for primary), stark hover states (opacity fade or scale).
- **Inputs**: Transparent background, bottom-border only or minimal box, glowing border on focus (`ring-accent/50`).

### 2.4 Animation Philosophy
- **Curves**: Everything uses `cubic-bezier(0.2, 0.8, 0.2, 1)` for a "snap" feel.
- **Durations**: Hover states `150ms`. Layout shifts `300ms`.
- **Transforms**: Buttons scale down slightly on active (`active:scale-95`). Cards subtly lift on hover (`hover:-translate-y-1`).

---

## 3. Performance-First Architecture

**Goal:** <500ms First Contentful Paint, feeling instant.

### 3.1 Framework & Tooling
- **Framework**: Next.js 14 App Router. Selected because we need Server React Components to minimize the JS bundle sent to the client, while easily proxying external APIs (Tatum) via Server Routes.
- **Styling**: Tailwind CSS. Zero runtime overhead, generates an incredibly small CSS payload (<10kb gzipped) compared to CSS-in-JS.

### 3.2 Rendering Strategy
- **Static Generation (SSG)**: The marketing shell, landing page, and layout are entirely static and cached at the edge.
- **Client Rendered (CSR)**: ONLY the specific interactive components (`ConnectButton`, `BidForm`, `Countdown`) use `"use client"`. The rest of the page remains Server Components.
- **Bundle Size Target**: <100kb of first-load JavaScript.

### 3.3 Asset & Network Optimization
- **Fonts**: Local/optimized via `next/font/google`. `preload=true`, `display=swap`.
- **Images**: Only WebP/AVIF via `next/image` to prevent layout shift.
- **Data Caching**: The Tatum fiat price feed is fetched server-side and cached using Next.js `revalidate: 60` (cached for 1 minute to ensure ultra-fast TTFB without hitting Tatum rate limits). 
- **RPC Polling**: Sui RPC data is fetched client-side via `@tanstack/react-query` to ensure the user always sees the freshest blockchain state.

---

## 4. Component Build Order

We will build the UI bottom-up, ensuring no component depends on something that hasn't been built yet.

### Phase 1: Core Layout & Shell
1. `Tailwind Config & Global CSS` (Inject tokens, gradients, bezier curves)
2. `Typography Components` (Heading, Text, Eyebrow, Address)
3. `Button & Input Components` (Primary, Secondary, Ghost, TextField)
4. `Navbar` (Logo + dapp-kit ConnectButton wrapper)
5. `Footer` (Links, Status indicators)
6. `Main Layout` (Application shell)

### Phase 2: Domain UI Components (Reusable)
7. `AuctionCard` / `RfqCard` (Displays asset, countdown, status)
8. `CountdownTimer` (Client-side animated clock for `close_ms`)
9. `SealLockIndicator` (Visual representation of the IBE encryption lock)
10. `TatumPriceWidget` (Client component fetching from `/api/rates`)

### Phase 3: Page-Level Views (The 4 Screens)
11. **Dashboard View**: Grid of `AuctionCard`s (fetching from Sui RPC).
12. **Create View**: Form to deploy a new Launch or OTC contract.
13. **Participate View**: The Bid/Quote entry form (invokes SDK encoders, Seal encrypt, Walrus upload, and Sui PTB execution).
14. **Reveal Panel**: The post-close state (fetches `archive_blob_id` from Walrus, parses JSON, displays leaderboard and winners).

---

*This blueprint is approved for execution. All code written must strictly adhere to these constraints.*
