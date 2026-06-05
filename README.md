# Veil Protocol 🛡️

A decentralized, sealed-bid auction network and OTC Dark Pool. Built entirely onchain.  
**Tatum x Walrus Hackathon**

---

## What Is Veil Protocol?

Veil Protocol solves the critical issues of MEV, front-running, and price manipulation in DeFi. It allows anyone to launch a token or an OTC Dark Pool where bids are completely sealed and encrypted.

Sellers define the asset, minimum deposit, and closing time. Buyers submit cryptographically sealed bids. The market decides the fairest price, completely anonymously, until the auction closes and settles fully onchain.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND EXPLORER                        │
│   Launch Auction · Submit Encrypted Bid · Live Network Feed     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST / RPC
┌──────────────────────────────▼──────────────────────────────────┐
│                      VEIL PROTOCOL SDK                          │
│     Encryption · Hashing · Walrus Publishing · Sui Client       │
└───┬──────────────┬───────────────┬──────────────┬───────────────┘
    │              │               │              │
┌───▼───┐    ┌─────▼─────┐   ┌────▼────┐   ┌────▼────┐
│Seal   │    │  Walrus   │   │  Tatum  │   │  Sui    │
│Crypto │    │  Storage  │   │  Data   │   │  Network│
│Engine │    │  Layer    │   │  APIs   │   │  Layer  │
└───┬───┘    └─────┬─────┘   └────┬────┘   └─────────┘
    │              │               │
    │    ┌─────────▼───────────┐   │
    │    │ SUI SMART CONTRACTS │   │
    │    │ veil_launch         │   │
    │    │ veil_otc            │   │
    │    └──┬──────┬───────┬───┘   │
    │       │      │       │       │
┌───▼───┐ ┌▼──────▼┐ ┌────▼───┐ ┌─▼──────────┐
│Token  │ │  Sui   │ │Walrus  │ │  Seal      │
│Deposit│ │  Coin  │ │Blob ID │ │  SHA-256   │
└───────┘ └────────┘ └────────┘ └────────────┘
```

## Sponsor Integrations

| Sponsor | Integration | What It Does |
|---------|-------------|--------------|
| **Sui** | Network Layer | Move smart contracts, sealed-bid state machine, and fully on-chain settlement via programmable transaction blocks. |
| **Walrus** | Storage Layer (core) | Stores every encrypted bid/quote ciphertext and the maker's hidden reserve, then archives the settlement record. Sealed bids only exist because the ciphertext lives on Walrus while the chain holds just a hash commitment. |
| **Tatum** | Sui RPC + Data API | **All** of the dApp's on-chain reads and transaction execution are routed through the Tatum Sui gateway (`/api/rpc`, server-side key). The Tatum Data API (`/api/rates`) provides live SUI/USD for the header price pill and bid conversions. |
| **Seal** | Encryption Engine | Mysten Seal time-lock encryption makes bids mechanically un-decryptable until the auction's close time. |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Git
- Sui Wallet Extension (Testnet)

### Setup

```bash
git clone https://github.com/Sarnav07/Veil.git
cd Veil
pnpm install
```

### Configure (optional — the app runs with zero config)

The frontend ships with public testnet defaults, so it boots out of the box. To route
on-chain traffic and pricing through **Tatum**, add your free key
([dashboard.tatum.io](https://dashboard.tatum.io)):

```bash
cp apps/web/.env.example apps/web/.env.local
# then set TATUM_API_KEY=... in apps/web/.env.local
```

`TATUM_API_KEY` is server-side only and never ships to the browser. Without it, the RPC
proxy falls back to a public fullnode and the rate endpoint serves a cached value.

### Run the App

```bash
# Single command from the repo root
pnpm dev
```

Open `http://localhost:3000` (Next picks the next free port if 3000 is taken).

### Verify

```bash
pnpm move:test   # 31/31 Move unit tests
pnpm typecheck   # @veil/sdk, @veil/web, @veil/scripts
pnpm build       # production build of the web app
```

## Project Structure

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full module breakdown and coding agent guidelines.

Deployed testnet package id and object ids live in [docs/ADDRESSES.md](./docs/ADDRESSES.md).

## Tech Stack

- **Language:** TypeScript (Node.js 20+)
- **Monorepo:** pnpm workspaces
- **Contracts:** Sui Move
- **Chain:** Sui Testnet
- **Storage:** Walrus Network
- **Encryption:** Mysten Seal (`@mysten/seal`)
- **Data & RPC:** Tatum Sui gateway + Data API
- **Frontend:** Next.js 14, TailwindCSS, GSAP
- **Blockchain SDKs:** `@mysten/dapp-kit`, `@mysten/sui`

## Team
- **Sarnav07** — Full Stack / Smart Contracts

Built for the **Tatum x Walrus Hackathon 2026**.

## License

MIT
