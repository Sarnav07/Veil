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
| **Sui** | Network Layer | Fast, cheap programmable transaction blocks and state management. |
| **Walrus** | Storage Layer | Decentralized storage of encrypted bids. Removes the need to store large ciphertexts onchain. |
| **Tatum** | Data APIs & RPC | Fetches real-time USD exchange rates for Sui to power the frontend Fiat conversions. |

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

### Run the App

```bash
# Start the Next.js development server
pnpm --filter @veil/web dev
```

Open your browser and navigate to `http://localhost:3000`.

## Project Structure

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full module breakdown and coding agent guidelines.

## Tech Stack

- **Language:** TypeScript (Node.js 20+)
- **Monorepo:** pnpm workspaces
- **Contracts:** Sui Move
- **Chain:** Sui Testnet
- **Storage:** Walrus Network
- **Frontend:** Next.js 14, TailwindCSS, Framer Motion
- **Blockchain SDKs:** `@mysten/dapp-kit`, `@mysten/sui.js`

## Team
- **Sarnav07** — Full Stack / Smart Contracts

Built for the **Tatum x Walrus Hackathon 2026**.

## License

MIT
