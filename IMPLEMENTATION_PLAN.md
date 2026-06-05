# Veil Protocol — Implementation Plan

> A decentralized sealed-bid trading engine on **Sui**: single-item auctions, fair token
> launches, and an OTC dark pool. Bids are time-locked with **Seal**, stored on **Walrus**,
> and every chain call is routed through **Tatum**.

This document is the build map: it walks the system bottom-up, layer by layer, naming the
**actual files** in the repo, what each one does, its inputs/outputs, and how to verify it.
It mirrors what is built, not an aspiration.

---

## Contents

1. [Architecture](#1-architecture)
2. [Build Order & Dependency Graph](#2-build-order--dependency-graph)
3. [Layer 0 — Workspace](#3-layer-0--workspace)
4. [Layer 1 — Move Contracts](#4-layer-1--move-contracts)
5. [Layer 2 — SDK: Encoding & Crypto](#5-layer-2--sdk-encoding--crypto)
6. [Layer 3 — SDK: Storage & Data](#6-layer-3--sdk-storage--data)
7. [Layer 4 — SDK: Transaction Builders](#7-layer-4--sdk-transaction-builders)
8. [Layer 5 — Keeper Orchestrator](#8-layer-5--keeper-orchestrator)
9. [Layer 6 — Frontend](#9-layer-6--frontend)
10. [End-to-End Trace](#10-end-to-end-trace)
11. [Verification Matrix](#11-verification-matrix)

---

## 1. Architecture

```
┌──────────────────────────── apps/web (Next.js 14) ────────────────────────────┐
│  /  ·  /create  ·  /participate  ·  /reveal                                    │
│  hooks: useActiveListings · useAuctionState · useSubmitBid · useDeployAuction  │
│         useExchangeRate · useFetchArchive · useVeilConfig                      │
│  /api/rpc  ──▶ Tatum Sui RPC gateway (server-side key, public fallback)        │
│  /api/rates ──▶ Tatum Data API (SUI/USD, stale-cached fallback)               │
└───────────────┬───────────────────────────────────────────────┬──────────────┘
                │ @veil/sdk                                       │
┌───────────────▼───────────────┐               ┌────────────────▼──────────────┐
│  packages/sdk                 │               │  scripts (keeper)             │
│  bid/launch/otc  encoding     │               │  run-keeper.ts orchestrator   │
│  seal   time-lock encrypt     │               │  keeper.ts  reveal arrays     │
│  walrus store/read            │               │  m2..m5 integration spikes    │
│  tx     PTB builders          │               └────────────────┬──────────────┘
│  tatum  SUI/USD               │                                │
│  archive record codec         │                                │
└───────────────┬───────────────┘                                │
                │ matches byte-for-byte                           │ signs & submits
┌───────────────▼─────────────────────────────────────────────────▼─────────────┐
│  move/veil (Sui Move)                                                          │
│  settlement.move  ── pure clearing (first / second / uniform-price)            │
│  auction.move · veil_launch.move · veil_otc.move  ── sealed-bid state machines │
│  seal_policy.move ── time-lock approval   ·   version.move                     │
└────────────────────────────────────────────────────────────────────────────────┘
        ▲ Seal key servers (threshold IBE)        ▲ Walrus blobs        ▲ Tatum RPC
```

**Protocol flow.** Seller creates an auction/sale/RFQ defining asset, deposit, and close time.
Bidders encode → Seal-encrypt → Walrus-store their bid, then submit `(deposit, blobId,
commitment)` on-chain. After close, the keeper unseals every blob, calls `settle`, the contract
re-hashes each reveal against its commitment, funds settle, and the keeper archives the record
to Walrus and links it on-chain.

---

## 2. Build Order & Dependency Graph

```
L0  Workspace (pnpm, tsconfig, Move.toml)
      │
L1  Move:  settlement ─▶ auction ─▶ veil_launch ─▶ veil_otc ─▶ seal_policy
      │
L2  SDK crypto:  bid · launch · otc  (encoding)  +  seal  (time-lock)
      │
L3  SDK io:  walrus (storage)  +  tatum (data)  +  archive (record codec)
      │
L4  SDK tx:  LaunchTxBuilder · OtcTxBuilder  (PTB builders)
      │
L5  Keeper:  keeper.ts (reveal arrays) ─▶ run-keeper.ts (orchestrator)
      │
L6  Frontend:  /api/rpc · /api/rates ─▶ hooks ─▶ /create · /participate · /reveal
```

Each layer depends only on the ones above it. The SDK encoders (L2) are the load-bearing
contract between TypeScript and Move: their byte layout must match the Move commitments exactly.

---

## 3. Layer 0 — Workspace

**Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `move/veil/Move.toml`,
`vercel.json`

- pnpm workspace spanning `apps/*`, `packages/*`, `scripts`.
- `@mysten/sui` pinned to `1.37.4` via root `pnpm.overrides` so every package resolves one
  client version.
- `Move.toml` deliberately does **not** pin Sui/MoveStdlib — the toolchain auto-adds the
  framework matching the installed `sui` binary (pinning it breaks `sui move test`).
- Root scripts: `dev`, `build`, `start`, `typecheck` (`pnpm -r`), `lint`, `move:test`,
  `spike:{tatum,walrus,seal}`.
- `vercel.json` commits the monorepo build settings (`pnpm --filter @veil/web build`,
  output `apps/web/.next`).

**Verify:** `pnpm install` clean; `pnpm typecheck` green across all three TS projects.

---

## 4. Layer 1 — Move Contracts

**Files:** `move/veil/sources/*.move` · **Tests:** `move/veil/tests/*.move` (31 tests)

### `settlement.move` — pure clearing engine
Stateless functions over arrays, unit-tested in isolation (13 tests):
- `clear(amounts, pricing) -> (winner_index, price)` — first-price or second-price (Vickrey),
  ties to the earliest bid.
- `uniform_clear(prices, quantities, supply) -> (clearing_price, allocations)` — walks the
  demand curve to the marginal price; above-margin fills full, at-margin splits pro-rata
  (floored), `u128`-safe.

### `auction.move` — single-item sealed auction
`Auction<T: key + store>` holding `Option<T>`. `new`/`create`, `submit_bid` (rejects late bids,
wrong deposit), `close`, `settle` (opens commitments via `sha2_256(bcs(amount)‖nonce)`, clears,
pays seller, refunds losers, transfers item; empty → item back to seller).

### `veil_launch.move` — fair token launch
`Sale<phantom T>` holding `Balance<T>` supply. Commitment `sha2_256(bcs(price)‖bcs(qty)‖nonce)`;
`settle` enforces `price·qty ≤ deposit`, uniform-clears, every winner pays the same marginal
price, seller takes proceeds + unsold supply. `add_archive` links the Walrus audit blob.

### `veil_otc.move` — sealed-quote RFQ dark pool
`Rfq<phantom T>` holding `Option<Coin<T>>` and a **hidden** `reserve_commitment`. Dealers escrow
a uniform deposit + sealed quote (`sha2_256(bcs(price)‖nonce)`). `settle` verifies the reserve
preimage first, opens quotes, awards highest quote ≥ reserve (first-price) and pays the maker;
otherwise refunds all and returns the asset — reserve never revealed if unmet. `add_archive`
links the audit blob.

### `seal_policy.move` — time-lock gate
`seal_approve` predicate the Seal key servers consult; releases keys only once close time passed.

### `version.move`
Package version marker.

**Verify:** `pnpm move:test` → `Total tests: 31; passed: 31`.

---

## 5. Layer 2 — SDK: Encoding & Crypto

**Files:** `packages/sdk/src/{bid,launch,otc,seal}.ts`

> ⚠️ The encoders are the byte-level contract with Move. Any change here must keep
> `sha2_256(encode(...))` equal to the Move commitment, or settlement aborts with
> `EBadCommitment`.

- **`bid.ts`** — `encodeBid/decodeBid` (`bcs(u64 amount) ‖ nonce`), `commit` (WebCrypto SHA-256,
  matches Move `sha2_256`), `randomNonce`, `toHex`.
- **`launch.ts`** — `encodeLaunchBid/decodeLaunchBid` (`bcs(price) ‖ bcs(qty) ‖ nonce`).
- **`otc.ts`** — `encodeQuote/decodeQuote` (`bcs(price) ‖ nonce`); `generateReserve`,
  `encodeReserve/decodeReserve` (`bcs(reserve) ‖ reserveNonce`) for the hidden floor.
- **`seal.ts`** — `timeLockId(closeMs)` derives the Seal identity; `SealVault` wraps
  `@mysten/seal` to encrypt a payload and `unsealBid` via the threshold key servers using a
  `SessionKey` (default threshold-of-2 testnet servers).

**Verify:** `pnpm typecheck`; round-trip `decode(encode(x)) === x`; integration spike
`m3-seal.integration.ts`.

---

## 6. Layer 3 — SDK: Storage & Data

**Files:** `packages/sdk/src/{walrus,tatum,archive}.ts`

- **`walrus.ts`** — `WalrusClient({ publisherUrl, aggregatorUrl })` with `store(bytes) ->
  blobId` (PUT to publisher, with retry) and `read(blobId) -> bytes` (GET from aggregator).
  Defaults to the Walrus testnet publisher/aggregator.
- **`tatum.ts`** — `TatumClient(apiKey).getExchangeRate('SUI','USD')` hits the Tatum Data API
  with `x-api-key`; the response is typed and validated before `parseFloat`.
- **`archive.ts`** — `ArchiveRecord` + `encodeArchive/decodeArchive` (JSON ↔ bytes) for the
  post-settlement audit blob.

**Verify:** `spike:walrus` round-trips a blob; `spike:tatum` prints a live rate;
`m2-walrus.integration.ts`.

---

## 7. Layer 4 — SDK: Transaction Builders

**Files:** `packages/sdk/src/tx.ts`

- **`LaunchTxBuilder`** — `create`, `submitBid`, `close`, `settle(prices, quantities, nonces)`,
  `addArchive`, each appending the right `moveCall` to a `Transaction` given `packageId` +
  `coinType`.
- **`OtcTxBuilder`** — `create`, `submitQuote`, `close`, `settle(prices, nonces, reserve,
  reserveNonce)`, `addArchive`.

These keep PTB construction in one place so both the keeper and the frontend build identical
calls. **Verify:** `pnpm typecheck`; exercised by the keeper and `m4`/`m5` integrations.

---

## 8. Layer 5 — Keeper Orchestrator

**Files:** `scripts/src/{run-keeper,keeper,env}.ts`, `scripts/src/m{2..5}.integration.ts`

- **`keeper.ts`** — `buildLaunchSettleArrays` / `buildOtcSettleArrays`: decode revealed
  plaintexts into the parallel `prices/quantities/nonces` arrays `settle` expects.
- **`run-keeper.ts`** — the orchestrator. CLI: `--type launch|otc --sale|--rfq <objectId>`.
  Reads the object, sleeps until close, unseals every blob via `SealVault`, builds one PTB
  (`close` + `settle`), signs & executes, then on success: queries Tatum for SUI/USD and prints
  the clearing price marked to market, encodes the `ArchiveRecord`, stores it to Walrus, and
  calls `addArchive` to link the blob on-chain. Crash handler logs only `err.name` so env
  secrets (`SUI_PRIVATE_KEY`, `TATUM_API_KEY`) never reach stderr.
- **`env.ts`** — `optionalEnv` with safe defaults (Walrus URLs, Seal key-server ids).
- **`m2..m5.integration.ts`** — standalone end-to-end walkthroughs per layer.

**Env required:** `VEIL_PACKAGE_ID`, `SUI_PRIVATE_KEY`, `TATUM_API_KEY`.
**Verify:** run the keeper against a closed sale/RFQ; expect `✅ Keeper executed`,
`Archived settlement record to Walrus! Blob ID: …`, `✅ On-chain archive trail linked`.

---

## 9. Layer 6 — Frontend

**Files:** `apps/web/app/**`, `apps/web/hooks/**`, `apps/web/components/**`

### API routes (the Tatum surface)
- **`app/api/rpc/route.ts`** — POST proxy: forwards the JSON-RPC body to the Tatum Sui gateway
  (`TATUM_SUI_RPC_URL`) with `x-api-key`, returns the upstream JSON verbatim, falls back to a
  public fullnode if no key. `app/providers.tsx` points dapp-kit's `SuiClientProvider` at
  `/api/rpc`, so **100% of browser Sui traffic flows through Tatum** with the key server-side.
- **`app/api/rates/route.ts`** — GET: live SUI/USD from the Tatum Data API; returns
  `{ rate, stale }`, never 500 (serves a cached fallback so the demo can't break).

### Hooks
`useVeilConfig` (public defaults, never throws) · `useActiveListings` · `useAuctionState` ·
`useSubmitBid` (encode → Seal → Walrus → PTB) · `useDeployAuction` · `useExchangeRate`
(drives the live price pill) · `useFetchArchive`.

### Pages
`/` explorer + live activity feed · `/create` launch a sale/RFQ · `/participate` submit a
sealed bid · `/reveal` settlement view.

**Verify:** `pnpm dev`, pages return 200 with zero env config; `/api/rpc` returns a real
`sui_getChainIdentifier`; `/api/rates` returns a rate (or stale fallback); `pnpm build` compiles
all routes including `ƒ /api/rpc`.

---

## 10. End-to-End Trace

1. **Create** — seller calls `LaunchTxBuilder.create` (or OTC) from `/create`; asset + deposit
   + close time go on-chain, `SaleCreated`/`RfqCreated` emitted.
2. **Bid** — bidder on `/participate`: `useSubmitBid` encodes the bid, `SealVault` encrypts it,
   `WalrusClient.store` returns a blobId, `submit_bid` records `(deposit, blobId, commitment)`.
   On-chain leaks only a hash + pointer.
3. **Close** — close time passes; `seal_policy::seal_approve` now lets Seal release keys.
4. **Settle** — keeper unseals all blobs, submits `close` + `settle`; the contract re-hashes
   every reveal == commitment, clears, and moves funds.
5. **Mark-to-market** — keeper prints clearing price in USD via Tatum Data API.
6. **Archive** — record stored to Walrus, blob linked on-chain via `add_archive`
   (`ArchiveLinked`). `/reveal` + `useFetchArchive` can display the immutable trail.

---

## 11. Verification Matrix

| Layer | Command | Expected |
|-------|---------|----------|
| L1 Move | `pnpm move:test` | `Total tests: 31; passed: 31` |
| L0/L2–L4 TS | `pnpm typecheck` | sdk · web · scripts all green |
| L3 Walrus | `pnpm spike:walrus` | blob store + read round-trips |
| L3 Tatum | `pnpm spike:tatum` | prints live SUI/USD |
| L2 Seal | `pnpm spike:seal` | encrypt + threshold unseal |
| L6 Web | `pnpm build` | all routes compile incl. `ƒ /api/rpc` |
| L6 RPC | `curl -XPOST /api/rpc` (chainId) | real chain identifier via Tatum |
| L5 Keeper | `pnpm --filter @veil/scripts keeper …` | `✅` settle + Walrus archive + on-chain link |

---

*Design rationale: [docs/WHITEPAPER.md](./docs/WHITEPAPER.md). Deployed addresses:
[docs/ADDRESSES.md](./docs/ADDRESSES.md). Demo script: see `DEMO_SCRIPT.md`.*
