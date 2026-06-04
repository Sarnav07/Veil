# VEIL — Project Status

_Confidential sealed-bid trading primitive on Sui (Move + Walrus + Seal + Tatum).
One sealed-bid engine; two apps on top: **VEIL-Launch** (anti-snipe token sales) and
**VEIL-OTC** (sealed-quote dark pool)._

**Verified at this snapshot (run locally, not just claimed):**
- `sui move test --path move/veil` → **31 / 31 pass, 0 failures** (Sui CLI 1.73.0).
- `pnpm typecheck` (`pnpm -r --if-present typecheck`) → **green** for all three TS
  projects: `@veil/sdk`, `@veil/scripts`, `@veil/web`.
- **Package is deployed to Testnet**. The `VEIL_PACKAGE_ID` is recorded in `docs/ADDRESSES.md` and `.env`.
- **End-to-End thesis proven**: Seal encryption, Walrus storage, and Keeper decryption paths (`m3`/`m4`/`m5`) run flawlessly live on Testnet.

---

## 1. What is done (fully implemented and functional)

### On-chain — Move package `veil` (`move/veil/sources/`)

- **`settlement.move` — pure clearing logic.** `clear(amounts, pricing)`
  (`settlement.move:23`) does single-winner first-price (`FIRST_PRICE=0`) and
  second-price/Vickrey (`SECOND_PRICE=1`), ties to earliest index. `uniform_clear(prices,
  quantities, supply)` (`settlement.move:67`) does uniform-price multi-unit clearing:
  `sort_by_price_desc` (`settlement.move:152`, insertion sort, stable on ties) → walk the
  demand curve to the marginal price → fill strictly-above bids in full → pro-rata the
  marginal tier with a `u128` floor so allocations stay `<= supply`. No network, no
  object state — unit-tested in isolation. 13 settlement tests
  (`settlement_tests.move`) cover empty/first/second/ties/single-bid and
  undersubscribed/exact/oversubscribed-pro-rata/floor-within-supply/zero-supply.

- **`auction.move` — base sealed-bid engine.** `Auction<T: key+store>` holds an
  `Option<T>` item. Lifecycle `new`/`create` (`:66`/`:95`, shares the object) →
  `submit_bid` (`:108`, escrows exactly `auction.deposit` SUI, records
  `{blob_id, commitment}`) → `close` (`:130`, state→REVEALING once `clock >= close_ms`)
  → `settle` (`:139`). `settle` re-hashes every reveal as `sha2_256(bcs(amount)‖nonce)`
  and aborts on mismatch (`:171`, `EBadCommitment`) **before** moving any funds; winner
  pays the clearing price, all others fully refunded, item transferred to winner. Zero-bid
  path returns the item to the seller (`:151`). `send_or_destroy` (`:198`) avoids
  zero-value coin objects. Read accessors `state`/`bid_count`/`close_ms`/`deposit`/
  `bidder`/`bid_blob_id`/`bid_commitment` (`:206`–`:226`) deliberately expose **no
  amount**. 4 tests incl. `commitment_matches_sdk` (pins the exact SDK hash bytes) and
  `settle_rejects_forged_reveal`.

- **`veil_launch.move` — VEIL-Launch (uniform-price sealed token sale).**
  `Sale<phantom T: store>` escrows `Balance<T>` supply. Commitment is
  `sha2_256(bcs(price)‖bcs(qty)‖nonce)`. `settle` (`:140`) checks `price*qty <= deposit`
  in `u128` (`:169`) and re-hashes every reveal before clearing via
  `settlement::uniform_clear`; winners pay `clearing_price*allocated`, receive tokens,
  refunded the rest; seller gets proceeds + unsold supply (`:203`–`:206`); empty-sale path
  `settle_empty` (`:212`). 9 tests in `veil_launch_tests.move`.

- **`veil_otc.move` — VEIL-OTC (sealed-quote RFQ dark pool).** `Rfq<phantom T: store>`
  sells `Option<Coin<T>>` with a **hidden reserve stored as a hash commitment**
  (`reserve_commitment = sha2_256(bcs(reserve)‖reserve_nonce)`, `:85`–`:87`). `settle`
  (`:154`) verifies the reserve preimage first (`:169`), then every quote commitment,
  then `settlement::clear(prices, first_price())`; if `winning_price >= reserve` the top
  quote wins first-price and pays the maker, else asset returns to maker and all dealers
  refunded. `reserve()` accessor returns the **hash, never the value** (`:273`). 5 tests
  incl. `reserve_stays_hidden_until_settle` and `forged_reveal_aborts`.

- **`seal_policy.move` — Seal time-lock policy.** `time_lock_id(unlock_ms)` =
  `bcs(unlock_ms)` (`:10`), `seal_approve(id, clock)` (`:20`) aborts with `ETooEarly`
  unless `clock >= unlock_ms` decoded from `id`. 3 tests (`seal_policy_tests.move`) prove
  locked-before / unlocked-at close.

- **`version.move`** — `version() = 1` marker (`:12`). 2 tests.

### Off-chain — TypeScript

- **`@veil/sdk` (`packages/sdk/src/`)** — all functional and exported via `index.ts`:
  - `bid.ts`: `encodeBid`/`decodeBid` (`bcs(amount)‖nonce`), `commit` (Web Crypto
    SHA-256, byte-identical to Move `sha2_256` — pinned by `commitment_matches_sdk`),
    `randomNonce`, `toHex`.
  - `launch.ts`: `encodeLaunchBid`/`decodeLaunchBid` (`bcs(price)‖bcs(qty)‖nonce`).
  - `otc.ts`: `encodeQuote`/`decodeQuote` (aliases `encodeBid`’s shape).
  - `walrus.ts`: `WalrusClient.store/read` over the publisher/aggregator HTTP API,
    handling both `newlyCreated` and `alreadyCertified` responses.
  - `seal.ts`: `SealVault.sealBid` (encrypt to `timeLockId(closeMs)`) and `unsealBid`
    (builds the `seal_approve` PTB with clock `0x6`). `timeLockId` matches the Move side.
  - `archive.ts`: `encodeArchive`/`decodeArchive` JSON record for the trade archive.

- **`@veil/scripts` (`scripts/src/`)** — runnable spikes, all typechecking:
  - `tatum-rpc.spike.ts` — Sui RPC reachability through the Tatum gateway (chain id +
    checkpoint). **Verified live.**
  - `walrus.spike.ts` / `m2-walrus.integration.ts` — Walrus store+read round-trip for a
    bid payload and an archive record, with commitment-stability assertion.
  - `keeper.ts` — **pure** decode→reshape: `buildLaunchSettleArrays`/
    `buildOtcSettleArrays` turn decrypted plaintexts into the parallel
    `prices/quantities/nonces` arrays `settle` expects, sorted by on-chain index.
  - `env.ts` — `requireEnv`/`optionalEnv` loading the repo-root `.env`.

### Tooling / CI
- pnpm workspace (`scripts`, `apps/*`, `packages/*`); `@mysten/sui` pinned to `1.37.4`
  via root `pnpm.overrides`. `@mysten/dapp-kit@0.16.16` resolved and compatible
  (typecheck passes).
- `.github/workflows/ci.yml` runs `pnpm typecheck` and `sui move test` (Sui pinned
  `testnet-v1.73.0`) on push/PR.

---

## 2. What is partially done (started but incomplete)

- **VEIL-OTC vs. the frozen interface contract (`tasks/m4-m5-contract.md`).** The
  implemented `new`/`create`/`settle` added `reserve_nonce` parameters
  (`veil_otc.move:75`, `:108`, `:154`) that the frozen signatures omit. This is a
  deliberate **security improvement** — a bare `sha2_256(bcs(reserve))` over a `u64` is
  brute-forceable — but it is an undocumented deviation from the "single source of truth"
  contract and the SDK has **no OTC RFQ helper** for it (the contract asked for "a thin
  RFQ helper" in `otc.ts`; only `encodeQuote`/`decodeQuote` exist).

- **Frontend (`apps/web`).** Scaffolding only: `providers.tsx` wires
  dapp-kit + react-query + testnet fullnode; `page.tsx` is a `ConnectButton` + tagline +
  connected-address line. **None** of the screens/components specified in `docs/DEMO.md`
  (S1–S4, `ChainSeesPanel`, `SealPipeline`, `SniperPane`, `CountdownRing`, `BlobChip`,
  `ResultCard`, `TatumStatusBadge`) exist.

- **Trade archive.** `archive.ts` encode/decode works and round-trips on Walrus in `m2`,
  but it is **not wired into any settle flow** — no Move `settle` emits or stores an
  archive blob, and no TS path calls `encodeArchive` after a settlement.

---

## 3. What is broken or will not run as-is

- **`spike:seal` requires real secrets** — `seal.spike.ts` calls `requireEnv('TATUM_API_KEY')`
  and `requireEnv('SEAL_KEY_SERVER_OBJECT_IDS')` and will throw with an actionable message
  if `.env` is unfilled. `.env.example` ships default testnet key-server ids but
  `TATUM_API_KEY` and `SUI_PRIVATE_KEY` are blank.

- **`m2`/`walrus` spikes depend on live Walrus testnet endpoints** — they hit
  `publisher/aggregator.walrus-testnet.walrus.space` and will fail offline or if those
  public endpoints rate-limit. No retry/backoff in `WalrusClient`.

- **Lint is effectively a no-op for non-web packages** — root `pnpm lint` runs
  `pnpm -r --if-present lint`, but only `apps/web` defines a `lint` script (`next lint`);
  `@veil/sdk` and `@veil/scripts` have none, so they are never linted.

_No correctness bugs were found in the Move modules during this review: fund-conservation,
overflow guards (`price*qty` in `u128`, winner `cost <= deposit`), and commit-before-pay
ordering all check out, and the suite is green._

---

## 4. What is left to build (referenced/implied but absent)
- **Archive-on-settle** — emit/store an `ArchiveRecord` when an auction/sale/RFQ settles.
- **Tatum Data API integration** — `IMPLEMENTATION_PLAN.md:53` and `docs/STATUS.md` call
  for price/mark-to-market reads; only RPC reachability (`tatum-rpc.spike.ts`) exists.
- **Frontend screens & components** — the entire `docs/DEMO.md` inventory, plus the
  seed/fast-clock demo mode.
- **Whitepaper** — `docs/WHITEPAPER.md` (`IMPLEMENTATION_PLAN.md:123`), a submission
  requirement; not present.
- **Placeholders to replace:** `PLACEHOLDER_PACKAGE_ID` (`seal.spike.ts:21`) and the
  `Sale`-phantom/version marker `version.move` once real upgrade flow exists.
- No literal `TODO`/`FIXME` markers exist in first-party source (only in vendored Sui
  framework deps under `move/veil/build/`).

---

## 5. Immediate next steps (priority order)

1. **Build the demo frontend (`docs/DEMO.md` S1–S4) starting with `ChainSeesPanel` +
   `SniperPane`.** _Why:_ the "what the chain sees" reveal is the product's whole pitch and
   carries Presentation (20%) + Creativity (20%); the dapp-kit shell already exists, so
   this is additive. Include the seed/fast-clock mode so the demo video doesn't wait on
   real timers.

2. **Wire the archive into settle and add a Tatum Data API read.** _Why:_ these are the two
   remaining "DeFi + **Data**" / Walrus + Tatum (30%) surfaces — an archive blob emitted at
   settlement and a price/mark-to-market reference — both currently stubbed in the SDK but
   never called from a real flow.
