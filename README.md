# Veil Protocol 🛡️

**Confidential, front-run-resistant trading on Sui.** Sealed-bid auctions, fair token
launches, and an OTC dark pool — where every bid stays encrypted until the moment it settles.

![Veil Protocol — any asset, any size, fully on-chain](apps/web/public/screenshots/hero.png)

**▶ Live demo: [veil-web-eight.vercel.app](https://veil-web-eight.vercel.app)** · Built for the **Tatum × Walrus Hackathon 2026** · Sui Testnet

---

## The Problem

Every order on a public chain is visible before it executes. That visibility is expensive:

- **Front-running & MEV** — bots read the mempool and sandwich your trade.
- **Market impact** — a large sell order is seen coming, so the price craters before it fills.
- **No price discovery for blocks** — whales can't move size, and launches get sniped by the fastest bot, not the fairest bid.

Veil removes the information leak. Bids are encrypted client-side, the ciphertext lives on
decentralized storage, and the chain holds **only a hash commitment** until the auction
closes. Nobody — not other bidders, not the seller, not a keeper — can read a bid early.

## How It Works (one paragraph)

A bidder encodes their bid, encrypts it with **Mysten Seal** time-lock encryption (keyed to
the auction's close time), uploads the ciphertext to **Walrus**, and submits a transaction to
**Sui** carrying just the Walrus blob ID and a SHA-256 commitment. While the auction is live,
on-chain state leaks nothing about the demand curve. After the close time, a keeper downloads
every blob, unseals them through the Seal key servers (which only release keys once the chain
confirms the auction is over), and calls `settle` — where the **contract re-hashes every
revealed bid against its original commitment** before a single coin moves. All on-chain reads
and transaction execution flow through the **Tatum Sui RPC gateway**; the **Tatum Data API**
prices the result in USD.

```
 Bidder                         Off-chain                        Sui (testnet)
 ──────                         ─────────                        ─────────────
 encode bid ──▶ Seal encrypt ──▶ Walrus store ──▶ blobId
                                                    │
        commitment = sha2_256(bcs(bid) ‖ nonce)     ▼
                                          submit_bid(deposit, blobId, commitment)
                                                    │   (only hash + pointer on-chain)
        ── close time passes ──                     │
 Keeper: read blobs ◀── Walrus      Seal key servers│ release keys (close confirmed)
         unseal bids ◀──────────────────────────────┘
         settle(reveals) ──▶ contract re-hashes each reveal == commitment ──▶ funds move
         archive record ──▶ Walrus ──▶ add_archive(blobId) on-chain
         mark-to-market ──▶ Tatum Data API (SUI/USD)
```

## Screenshots

| | |
|:--:|:--:|
| ![Live Network explorer](apps/web/public/screenshots/dashboard.png) | ![Submit a sealed bid](apps/web/public/screenshots/submit-bid.png) |
| **Live Network explorer** — active auctions, TVL and a live event feed, priced in USD live from the **Tatum Data API**. | **Submit a sealed bid** — encrypted client-side with **Seal**, stored on **Walrus**; only the SHA-256 commitment touches the chain. |

| ![Create a sealed auction](apps/web/public/screenshots/create-auction.png) |
|:--:|
| **Create** a sealed token launch or an OTC dark pool — pick the asset, supply, deposit and close time, then deploy on-chain via the Tatum Sui RPC gateway. |

## The Three Primitives

Veil is a shared sealed-bid engine (`settlement.move`) driving three products:

| Module | Product | Clearing rule | Commitment |
|--------|---------|---------------|------------|
| `auction.move` | **Single-item sealed auction** | First-price or Vickrey (second-price) | `sha2_256(bcs(amount) ‖ nonce)` |
| `veil_launch.move` | **Fair token launch** | Uniform-price, pro-rata at the margin | `sha2_256(bcs(price) ‖ bcs(qty) ‖ nonce)` |
| `veil_otc.move` | **OTC dark pool (RFQ)** | Highest sealed quote ≥ a **hidden reserve** | quote `sha2_256(bcs(price) ‖ nonce)`; reserve `sha2_256(bcs(reserve) ‖ nonce)` |

In the launch, all winners pay the same marginal clearing price — so there's no advantage to
being the fastest bot, only to bidding honestly. In OTC, the maker's reserve floor is itself a
hidden commitment, so counterparties can't reverse-engineer and squeeze it.

## Sponsor Integrations

| Sponsor | Role | Where it lives |
|---------|------|----------------|
| **Sui** | Settlement layer — Move contracts, sealed-bid state machine, fully on-chain payout via PTBs. | `move/veil/sources/*`, deployed package in [docs/ADDRESSES.md](./docs/ADDRESSES.md) |
| **Walrus** | **Core storage** — every encrypted bid/quote ciphertext and the maker's hidden reserve live on Walrus; the chain holds only the blob ID. The settlement audit record is archived back to Walrus and linked on-chain. | `packages/sdk/src/walrus.ts`, `add_archive` in the Move modules |
| **Tatum** | **Sui RPC + Data API** — *all* of the dApp's on-chain reads and tx execution are proxied through the Tatum Sui gateway (`/api/rpc`, server-side key). The Data API (`/api/rates`) provides live SUI/USD for the header price pill, bid conversions, and the keeper's mark-to-market. | `apps/web/app/api/rpc/route.ts`, `apps/web/app/api/rates/route.ts`, `packages/sdk/src/tatum.ts` |
| **Seal** | Time-lock encryption — Threshold IBE keyed to the auction ID + close time, so bids are mechanically un-decryptable until the auction ends. | `packages/sdk/src/seal.ts`, `move/veil/sources/seal_policy.move` |

## Repository Layout

```
move/veil/            Sui Move package (the on-chain engine)
  sources/
    settlement.move     pure clearing logic (first/second/uniform-price) — unit-tested in isolation
    auction.move        single-item sealed-bid auction
    veil_launch.move    uniform-price sealed token sale
    veil_otc.move       sealed-quote RFQ dark pool with hidden reserve
    seal_policy.move    Seal time-lock approval policy
    version.move        package version marker
  tests/                31 Move unit tests
packages/sdk/         @veil/sdk — TypeScript client
  src/
    bid.ts / launch.ts / otc.ts   payload encoding (byte-matches the Move sha2_256∘bcs)
    seal.ts                       SealVault: encrypt / unseal via Seal key servers
    walrus.ts                     WalrusClient: store / read blobs (with retry)
    tx.ts                         LaunchTxBuilder / OtcTxBuilder PTB builders
    tatum.ts                      TatumClient: SUI/USD exchange rate
    archive.ts                    settlement-record encode/decode
scripts/              @veil/scripts — keeper + integration spikes
  src/
    run-keeper.ts        settlement orchestrator (decrypt → settle → archive → mark-to-market)
    keeper.ts            reveal-array builders
    m2..m5.integration   end-to-end integration walkthroughs
apps/web/             Next.js 14 frontend (the explorer)
  app/                 / · /create · /participate · /reveal · /api/rpc · /api/rates
  hooks/               useActiveListings, useAuctionState, useDeployAuction,
                       useExchangeRate, useFetchArchive, useSubmitBid, useVeilConfig
docs/                 ADDRESSES.md · WHITEPAPER.md · DEMO.md
```

## Getting Started

### Prerequisites
- Node.js 20+, pnpm 9+, Git
- Sui Wallet extension (Testnet) for the frontend
- Sui CLI (only if you want to run the Move tests / redeploy)

### Install

```bash
git clone https://github.com/Sarnav07/Veil.git
cd Veil
pnpm install
```

### Configure (optional — the app boots with zero config)

The frontend ships with public testnet defaults, so `pnpm dev` works immediately. To route
on-chain traffic and pricing through **Tatum**, add a free key from
[dashboard.tatum.io](https://dashboard.tatum.io):

```bash
cp apps/web/.env.example apps/web/.env.local
# set TATUM_API_KEY=... in apps/web/.env.local
```

`TATUM_API_KEY` is **server-side only** and never reaches the browser. Without it the RPC
proxy falls back to a public fullnode and `/api/rates` serves a cached value flagged `stale`.

### Run

```bash
pnpm dev          # starts the web app (http://localhost:3000, or next free port)
```

### Verify

```bash
pnpm move:test    # 31/31 Move unit tests
pnpm typecheck    # @veil/sdk · @veil/web · @veil/scripts
pnpm build        # production build of the web app
```

### Run the keeper (settlement orchestrator)

```bash
# requires SUI_PRIVATE_KEY, TATUM_API_KEY, VEIL_PACKAGE_ID in scripts/.env
pnpm --filter @veil/scripts keeper --type launch --sale <objectId>
pnpm --filter @veil/scripts keeper --type otc   --rfq  <objectId>
```

The keeper sleeps until close time, unseals every bid via Seal, builds one PTB that
`close()`s and `settle()`s atomically, archives the result to Walrus, links the archive blob
on-chain, and prints the clearing price marked to market via the Tatum Data API.

## Security Model

- **Confidentiality** rests on Seal time-lock encryption — keys are released by the threshold
  network only after `seal_policy::seal_approve` confirms on-chain that the close time passed.
- **Integrity** rests on the commitment: `settle` re-hashes every revealed `(price, qty, nonce)`
  and aborts on any mismatch, so the keeper cannot forge, drop, or alter a bid's value.
- **Fund conservation** is checked on every settlement path — winners pay exactly the clearing
  price from their own deposit, losers are fully refunded, and the seller collects proceeds
  plus any unsold supply. The empty-auction path returns the asset to the seller.
- **Hidden reserve** (OTC) is a SHA-256 commitment over `bcs(reserve) ‖ nonce`; the nonce makes
  it non-brute-forceable, so the floor stays secret until the maker reveals it at settle.
- **Trust assumption:** `close`/`settle` are permissionless but bound by the commitments, so a
  keeper can only ever settle to the truth. Document the keeper as a liveness (not safety) role.

## Tech Stack

- **Language:** TypeScript (Node 20+) · **Contracts:** Sui Move (2024 edition)
- **Monorepo:** pnpm workspaces
- **Chain:** Sui Testnet · **Storage:** Walrus · **Encryption:** Mysten Seal (`@mysten/seal`)
- **Data & RPC:** Tatum Sui gateway + Data API
- **Frontend:** Next.js 14, TailwindCSS, GSAP, three.js
- **Blockchain SDKs:** `@mysten/dapp-kit`, `@mysten/sui` (pinned `1.37.4`)

## Deployed Addresses (Testnet)

| | |
|--|--|
| Package ID | `0xe519726f67050bfee2538afdc8ff262f77de450bfb5591c7d06d9c764e440a54` |
| UpgradeCap | `0x3cdadddb6d6e31f6623a41c45bf22a1f56f37b56a80eec3ae5f281767cf916c4` |

See [docs/ADDRESSES.md](./docs/ADDRESSES.md). Full design rationale in
[docs/WHITEPAPER.md](./docs/WHITEPAPER.md); module-by-module build notes in
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Team

- **Sarnav07** — Full Stack / Smart Contracts

## License

MIT
