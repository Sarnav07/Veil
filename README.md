# Veil Protocol 🛡️

**Confidential, front-run-resistant trading on Sui.** Sealed-bid auctions, fair token launches, and an OTC dark pool — where every bid stays encrypted until the moment it settles.

![Veil Protocol — any asset, any size, fully on-chain](apps/web/public/screenshots/hero.png)

**▶ Live demo: [veil-web-eight.vercel.app](https://veil-web-eight.vercel.app)** · Built for the **Tatum × Walrus Hackathon 2026** · Sui Testnet

---

## The Problem

Every order on a public chain is visible before it executes. That visibility is expensive:

- **Front-running & MEV** — bots read the mempool and sandwich your trade.
- **Market impact** — a large sell order is seen coming, so the price craters before it fills.
- **No price discovery for blocks** — whales can't move size, and launches get sniped by the fastest bot, not the fairest bid.

Veil removes the information leak. Bids are encrypted client-side, the ciphertext lives on decentralized storage, and the chain holds **only a hash commitment** until the auction closes. Nobody — not other bidders, not the seller, not a keeper — can read a bid early.

## How It Works

A bidder encodes their bid, encrypts it with **Mysten Seal** time-lock encryption (keyed to the auction's close time), uploads the ciphertext to **Walrus**, and submits a transaction to **Sui** carrying just the Walrus blob ID and a SHA-256 commitment. While the auction is live, on-chain state leaks nothing about the demand curve. 

After the close time, a decentralized keeper downloads every blob, unseals them through the Seal key servers (which only release keys once the chain confirms the auction is over), and calls `settle` — where the **contract re-hashes every revealed bid against its original commitment** before a single coin moves. 

All on-chain reads and transaction execution flow through the **Tatum Sui RPC gateway**; the **Tatum Data API** prices the result in USD.

### Architecture

![Veil Architecture Diagram](docs/assets/architecture.png)

## Pitch Deck

| | |
|:--:|:--:|
| ![Slide 1](docs/assets/slide1.png) | ![Slide 2](docs/assets/slide2.png) |
| ![Slide 3](docs/assets/slide3.png) | ![Slide 4](docs/assets/slide4.png) |

## The Three Primitives

Veil is a shared sealed-bid engine (`settlement.move`) driving three distinct products. We designed it this way so the core clearing logic is perfectly unit-tested in isolation:

- **Single-Item Sealed Auction (`auction.move`):** Clears using a First-price or Vickrey (second-price) model. The on-chain commitment is simply a hash of the bid amount and a nonce.
- **Fair Token Launch (`veil_launch.move`):** Uses uniform-price clearing, allocated pro-rata at the margin. Every winner pays the exact same marginal clearing price. This completely eliminates the advantage of being the fastest bot, rewarding honest price discovery instead.
- **OTC Dark Pool (`veil_otc.move`):** An RFQ model where the highest sealed quote wins, provided it meets a **hidden reserve floor**. The maker's reserve floor is itself a hidden cryptographic commitment, meaning counterparties cannot reverse-engineer or squeeze the floor price.

## Sponsor Integrations

- **Sui:** The settlement layer. We use Move contracts to enforce the state machine and handle fully on-chain payouts using Programmable Transaction Blocks (PTBs).
- **Walrus (Core Storage):** Every encrypted bid ciphertext and the maker's hidden reserve live entirely on Walrus. The Sui blockchain only holds the blob ID. 
  - *Smart Epoch Strategy:* To optimize costs, live bids are stored ephemerally for exactly 1 epoch (just long enough to settle). However, the final decrypted settlement audit records are archived permanently for 90 epochs, creating a trustless historical trail.
- **Tatum (RPC & Data API):** We proxy 100% of the DApp's on-chain reads and transaction executions server-side through the Tatum Sui Gateway. We also utilize the Tatum Data API to stream live SUI/USD exchange rates into our UI and our Keeper's mark-to-market settlement logic.
- **Mysten Seal:** Time-locked encryption. We use Threshold IBE keyed to the auction ID and close time, guaranteeing that bids are mechanically un-decryptable by anyone until the auction successfully ends.

## Security Model

- **Confidentiality:** Rests on Seal time-lock encryption — keys are released by the threshold network only after `seal_policy::seal_approve` confirms on-chain that the close time passed.
- **Integrity:** Rests on the commitment: `settle` re-hashes every revealed `(price, qty, nonce)` and aborts on any mismatch, so the keeper cannot forge, drop, or alter a bid's value.
- **Permissionless Settlement:** The Keeper is just a convenience daemon. Settlement is entirely permissionless. Because Seal enforces time-based decryption cryptographically, and the Move contract validates the math, the keeper cannot censor or cheat. Anyone can run `close` and `settle`.
- **Hidden reserve:** (OTC) is a SHA-256 commitment over `bcs(reserve) ‖ nonce`; the nonce makes it non-brute-forceable, so the floor stays secret until the maker reveals it at settle.

## Tech Stack & Architecture

- **Language:** TypeScript (Node 20+) · **Contracts:** Sui Move (2024 edition)
- **Monorepo:** pnpm workspaces
- **Chain:** Sui Testnet · **Storage:** Walrus · **Encryption:** Mysten Seal (`@mysten/seal`)
- **Data & RPC:** Tatum Sui gateway + Data API
- **Frontend Resilience:** Next.js 14 frontend includes robust fault tolerance. It handles missing on-chain objects gracefully and includes a simulation fallback layer for the Walrus network to guarantee stable presentation during live demos or network congestion.

## Getting Started

### Prerequisites
- Node.js 20+, pnpm 9+, Git
- Sui Wallet extension (Testnet) for the frontend

### Install & Configure

```bash
git clone https://github.com/Sarnav07/Veil.git
cd Veil
pnpm install

# Configure Tatum RPC Server Proxy
cp apps/web/.env.example apps/web/.env.local
# set TATUM_API_KEY=... in apps/web/.env.local
```

### Run
```bash
pnpm dev          # starts the web app (http://localhost:3000)
pnpm move:test    # 31/31 Move unit tests
```

### Run the keeper (settlement orchestrator)
```bash
# requires SUI_PRIVATE_KEY, TATUM_API_KEY, VEIL_PACKAGE_ID in scripts/.env
pnpm --filter @veil/scripts keeper --type launch --sale <objectId>
pnpm --filter @veil/scripts keeper --type otc   --rfq  <objectId>
```

## Deployed Addresses (Testnet)
| | |
|--|--|
| Package ID | `0xe519726f67050bfee2538afdc8ff262f77de450bfb5591c7d06d9c764e440a54` |
| UpgradeCap | `0x3cdadddb6d6e31f6623a41c45bf22a1f56f37b56a80eec3ae5f281767cf916c4` |

See [docs/ADDRESSES.md](./docs/ADDRESSES.md). Full design rationale in [docs/WHITEPAPER.md](./docs/WHITEPAPER.md).

## Team
- **Sarnav07** — Full Stack / Smart Contracts
- **Chainer_Rio** — [Twitter (@Chainer_Rio)](https://x.com/Chainer_Rio)

**Project Handle:** [@veil_sui](https://x.com/veil_sui)

## License
MIT
