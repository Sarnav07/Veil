# VEIL — Implementation Plan (solo, GitHub, frequent-commit)

> **VEIL** — a confidential sealed-bid trading **primitive** on Sui. Bids that no one can see, size, or trace until the auction closes. One sealed-bid engine; two apps on top: **VEIL-Launch** (anti-snipe fair token launches) and **VEIL-OTC** (private dark-pool for large trades).
>
> **Hackathon:** Tatum x Walrus · Track: **DeFi + Data** · Stack: **Sui Move + Walrus + Seal + Tatum**.

---

## 0. The basis (what we implement, and the anchoring fix)

**Construction basis (the whitepaper we build on):**
- ⭐ Agarwal, Fernando, Pinkas — *Efficiently-Thresholdizable Batched Identity-Based Encryption, with Applications* — **CRYPTO 2025** (rev. 21 Jun 2025) — https://eprint.iacr.org/2024/1575
  → the primitive **Seal** realizes: batched IBE keyed by a batch label (auction id) ⇒ delayed/threshold decryption at close.
- BEAT-MEV — USENIX Security 2025 (epochless batched threshold encryption for MEV prevention)
- Boneh, Laufer, Tas — *Batch decryption without epochs* — https://eprint.iacr.org/2025/1254
- *Time-Lock Encrypted Storage for Blockchains* — https://eprint.iacr.org/2025/2048

**Security definitions only** (not construction): *Censorship-Resistant Sealed-Bid Auctions* — https://eprint.iacr.org/2025/2127 — we adopt its strong-hiding triple as VEIL's goals:
- **Value Indistinguishability** — bid amount hidden.
- **Existential Obfuscation** — that you bid at all is hidden.
- **User Obfuscation** — who bid is hidden.

**Prior art (auction pattern):** ZeroAuction https://eprint.iacr.org/2024/189 · Cryptobazaar https://eprint.iacr.org/2024/1410

**Anchoring fix (resolved):** IACR 2025/2127's actual mechanism is timestamp-certificates + FOCIL inclusion lists on **Ethereum PoS** — consensus-coupled and encryption-*avoiding*. We do **not** port it. We implement threshold-IBE delayed decryption via **Seal** instead. On **Sui (Mysticeti BFT)** there is no single block proposer, so 2025/2127's censorship apparatus is unnecessary — short-term censorship resistance comes from Sui's validator set.

---

## 1. Architecture

```
 Bidder ──encrypt(bid, id=auctionId‖closeTime) via Seal──▶ ciphertext
   │                                                          │
   │                                              upload ▼ (Walrus)
   │                                            Walrus blob  (blobId)
   ▼ submitBid(auctionId, blobId, commitment) via Tatum Sui RPC
 Sui Move: veil_core::auction  (state, blobId table, Seal policy)
   ▼ at closeTime
 Keeper: Seal key request → decrypt blobs from Walrus → submit clearing
   ▼
 veil_core::settlement → winner on-chain, funds move, archive blob → Walrus
```

**Move package `veil` (testnet → mainnet):**
| Module | Responsibility | Key entries |
|---|---|---|
| `auction.move` | Auction object + lifecycle: `Registration → Bidding → Reveal → Settled`; holds Walrus `blobId` table, Seal policy id, `closeTime` | `create`, `submit_bid`, `close`, `settle` |
| `seal_policy.move` | Seal access policy: `seal_approve` gates key release on `clock ≥ closeTime` & auction state | `seal_approve` |
| `settlement.move` | Clearing rule (first-price → second-price → uniform-price), winner, escrow/deposit, refunds | `clear`, `payout`, `refund` |
| `veil_launch.move` | Fair-launch IDO: sealed bids → uniform clearing price → pro-rata allocation | `create_sale`, `finalize` |
| `veil_otc.move` | RFQ dark-pool: request → sealed quotes → best wins → settle | `open_rfq`, `submit_quote`, `settle_rfq` |

**Off-chain (TypeScript):** Seal SDK (encrypt/keys) · Walrus client (upload/fetch) · Tatum Sui RPC (all reads/writes) · Tatum Data API (price/metadata) · keeper (decrypt-at-close) · Next.js + @mysten/dapp-kit frontend · optional Tatum MCP agent.

**Hiding-triple ↔ mechanism:** ciphertext on Walrus (only `blobId`+commitment on-chain) ⇒ Value + Existential hiding; identity-decoupled commitment / no bidder address in clear ⇒ User Obfuscation; all enforced until `closeTime` by Seal time-lock.

---

## 2. Git workflow (frequent chunks, solo)

- **Repo:** new public GitHub repo `veil` (MIT). `main` always green.
- **Branches:** one per milestone — `feat/m1-auction-core`, `feat/m2-walrus`, … Self-review PR per milestone, squash-or-merge into `main`.
- **Commit granularity (the rule):** *one logical unit per commit* — a Move entry + its test, a TS helper + its integration test, one UI component. Push after each. No bulk commits.
- **Conventional commits:** `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Each ends with the Co-Authored-By trailer.
- **CI (GitHub Actions, from M0):** `sui move test` + `pnpm lint && pnpm test` on every push; branch protection requires green CI.
- **Docs-as-you-go:** every milestone updates `README.md` + `/docs`. Deployed package/object ids recorded in `docs/ADDRESSES.md`.

---

## 3. Milestones & commit checklist

Order is sequential (solo). Each box ≈ one commit.

### M0 — Repo + dependency spikes (prove every piece works alone)
- [ ] Init repo: README skeleton, `.gitignore`, MIT license, GitHub Actions CI stub
- [ ] Tatum API key; verify Sui RPC gateway reachable (`sui-testnet.gateway.tatum.io`) with a script
- [ ] Sui CLI + Move toolchain; `sui move new veil`; empty package builds + deploys to testnet
- [ ] Walrus: store + read a "hello" blob (publisher/aggregator endpoints), log blobId
- [ ] Seal: encrypt + decrypt a "hello" secret under a dummy time-lock policy
- [ ] Frontend scaffold (Next.js + @mysten/dapp-kit), connect a Sui wallet — screens per `docs/DEMO.md`
- **Exit:** every external dependency individually verified; CI green.

### M1 — Core auction (no privacy yet)
- [ ] `auction.move`: Auction object, lifecycle states, events
- [ ] `submit_bid` storing `blobId` + commitment in a table
- [ ] `settlement.move`: first-price clearing + winner selection
- [ ] Second-price clearing variant
- [ ] Move unit tests: lifecycle transitions + clearing correctness
- [ ] Deploy to testnet via Tatum RPC; record package id in `docs/ADDRESSES.md`

### M2 — Walrus integration (storage = core)
- [ ] TS lib: `uploadBid()` → Walrus blob → `blobId`
- [ ] TS lib: `fetchBid(blobId)` → ciphertext
- [ ] Move: `blobId` table wired into `submit_bid`; read path
- [ ] Encrypted **trade archive** writer (append cleared-auction record to Walrus)
- [ ] Integration test: submit bid → blob on Walrus → `blobId` on Sui → fetch back

### M3 — Seal privacy (the hiding triple) — the differentiator
- [ ] `seal_policy.move`: `seal_approve` gating on `clock ≥ closeTime` + auction state
- [ ] TS: encrypt bid to identity `auctionId‖closeTime` via Seal threshold IBE
- [ ] Keeper: at close, request Seal keys → fetch+decrypt all blobs → call `settle`
- [ ] Test: bid **unreadable** before close (assert Value/Existential/User hiding)
- [ ] Test: bids **readable & cleared** exactly at/after close
- [ ] `docs/SECURITY.md`: map each hiding property → the test that proves it

### M4 — VEIL-Launch (app #1)
- [ ] `veil_launch.move`: token sale, uniform clearing price, pro-rata allocation, refunds
- [ ] Anti-snipe flow + tests (bots submitting late/visible txs gain nothing)
- [ ] Frontend S1+S2 (`docs/DEMO.md`): launch list + place-sealed-bid pipeline (Encrypt→Upload→Submit)

### M5 — VEIL-OTC (app #2)
- [ ] `veil_otc.move`: RFQ → sealed quotes → best wins → settle
- [ ] Tatum **Data API** price reference shown in UI (mark-to-market)
- [ ] Frontend: OTC desk UI

### M6 — Polish + Tatum MCP (AI bonus) + demo
- [ ] Frontend S3 "What the chain sees" panel + 🤖 Sniper pane (the star — `docs/DEMO.md` §3)
- [ ] Frontend S4 reveal/result + encrypted-archive link; seed + fast-clock demo mode
- [ ] Optional: Tatum **MCP** agent ("set up an auction" / "explain this result")
- [ ] Record 2–3 min demo video to the storyboard (`docs/DEMO.md` §4)

### M7 — Whitepaper + submission
- [ ] Whitepaper in `/docs/WHITEPAPER.md` (structure in §4) with citations above
- [ ] README: architecture, addresses, Walrus blob layout, Seal policy, run instructions
- [ ] Deploy to **mainnet** (preferred) or finalize testnet; record addresses
- [ ] Submit (GitHub + video + Google Form); social tags @Tatum_io @WalrusFoundation @SuiNetwork

---

## 4. Whitepaper structure (built alongside, finalized M7)
1. Abstract + one-line thesis
2. Problem (open mempools leak bids; launches sniped; OTC front-run) + dated 2025–2026 why-now
3. Security goals — the 2025/2127 hiding triple, stated formally
4. Construction — batched threshold-IBE + delayed decryption (Agarwal–Fernando–Pinkas, CRYPTO 2025), instantiated on Seal; Walrus storage model; Sui Move auction/settlement; Tatum integration
5. The two apps — VEIL-Launch, VEIL-OTC
6. Architecture diagram + contract surface + Walrus blob layout + Seal policy
7. Trust model & limitations (Seal key-server threshold; MEV residual; Sui BFT censorship)
8. Business model — launchpad fee / OTC take-rate (recurring)
9. Hackathon-criteria mapping + demo script
10. Roadmap + references

---

## 5. Roadmap

**A. Hackathon sprint (MVP-first, ship order):**
`M0 → M1 → M2 → M3` = a **working private sealed-bid auction** (the whole thesis, demoable). Then `M4` (one app, lead with VEIL-Launch) → `M6` (demo) → `M7` (whitepaper + submit). `M5` (OTC) is the stretch if time remains. Cut line if needed: ship Launch only, frame OTC as roadmap.

**B. Product roadmap (post-hackathon — "the future"):**
- **v0.1 (hackathon):** testnet/mainnet primitive + VEIL-Launch, private sealed bids, encrypted archive on Walrus.
- **v0.2:** VEIL-OTC live; uniform-price + batch auctions; Tatum Data API mark-to-market; fee/treasury module.
- **v0.3:** audit (Move) + mainnet hardening; multi-asset; deposit-slashing for non-settlement.
- **v0.4:** cross-chain settlement via Tatum multichain; SDK so any Sui project embeds VEIL sealed bids.
- **v1.0:** permissionless auction factory + fee switch; the "private price-discovery layer for Sui."

---

## 6. Judging-criteria coverage (sanity check)
- **Walrus + Tatum (30%):** encrypted bids + trade archive on Walrus (core); all chain I/O via Tatum RPC + Data API (+ MCP). Targets both special prizes.
- **Technical (30%):** faithful threshold-IBE delayed-decryption (CRYPTO 2025) on Seal; tested Move modules.
- **Creativity (20%):** "a DEX where not even the sequencer sees your order until it's filled."
- **Presentation (20%):** working demo (bots fail to snipe) + clear docs + whitepaper.
