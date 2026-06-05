# Veil Protocol — Hackathon Criteria Audit

Project: **Veil Protocol** — confidential sealed-bid auctions & OTC dark pools on Sui.
Hackathon: **Tatum × Build on Sui with Walrus**. Prize pool $2,000 + two $200 bonus tracks.
Submission deadline: **June 6, 17:00 UTC**.

Status legend: **PASS** · **PARTIAL** · **FAIL** · **NON-CODE** (needs an action outside the repo).

---

## A. Required integrations (gating)

| Requirement | Status | Evidence / what was done |
|---|---|---|
| Use a **Tatum API key** | **PASS** | `TATUM_API_KEY` powers `/api/rpc` (Sui RPC proxy) and `/api/rates` (Data API). Free key from dashboard.tatum.io. |
| Build on **Sui** (mainnet preferred, testnet OK) | **PASS** | Deployed package on Sui **testnet** — `0x67b7…e30c` (`docs/ADDRESSES.md`). 31 Move tests pass. |
| **Integrate Walrus meaningfully — core functionality, not an add-on** | **PASS** | Walrus is the confidentiality backbone: every encrypted bid/quote ciphertext and every maker reserve is stored on Walrus before anything hits the chain (`useSubmitBid.ts`, `useDeployAuction.ts`), and the post-settlement archive is written to + read from Walrus (`useFetchArchive.ts`, `scripts/run-keeper.ts`, `packages/sdk/src/walrus.ts`, `archive.ts`). Without Walrus there is no sealed bid. |
| MCP (optional, encouraged) | **N/A** | Not used. Not required; no points lost on gating. |
| GitHub repo | **PASS** | This repository. |
| 2–3 min demo video | **NON-CODE** | Script in `DEMO_READY.md §4`. Must be recorded + uploaded. |
| Submit via Google Form | **NON-CODE** | Submit repo + video before the deadline. |

---

## B. Judging criteria (weighted)

### 1. Walrus & Tatum integration — 30%  → **PASS**
- **Walrus (core):** sealed bids only exist because the ciphertext lives on Walrus; the
  chain stores just a hash commitment + deposit. Settlement records are archived to Walrus
  and linked on-chain. This is intrinsic, not decorative.
- **Tatum (now end-to-end):** `/api/rpc` routes **100% of the dApp's Sui JSON-RPC** (reads
  *and* transaction execution) through the Tatum Sui gateway; `/api/rates` uses the Tatum
  **Data API** for live SUI/USD, surfaced as a header price pill and the bid USD conversion.
  CLI spikes (`spike:tatum`) independently prove the RPC + Data API.
- **Fixed this pass:** before today the browser read from a public fullnode and used Tatum
  nowhere client-side — that gap is closed (`apps/web/app/api/rpc/route.ts`,
  `apps/web/app/providers.tsx`).

### 2. Technical quality (clean code + working Tatum Sui RPC) — 30%  → **PASS**
- Move contract suite **31/31 passing**; SDK byte-matches the Move `sha2_256∘bcs` commitment
  scheme. Commit is verified on-chain before any funds move; fund-conservation and u128
  overflow guards hold on every path.
- All three TS projects pass `tsc --noEmit`; `next build` is clean; `next lint` passes
  (only advisory `<img>` warnings).
- Tatum Sui RPC integration is live and verified at runtime
  (`sui_getChainIdentifier → 4c78adac`).

### 3. Creativity — 20%  → **PASS**
- A genuine primitive: commit–reveal sealed-bid auctions **plus** a hidden-reserve OTC dark
  pool, using Seal **time-lock** decryption so bids are mechanically un-revealable until
  close. MEV/front-running resistance is the core value prop, not a buzzword.

### 4. Presentation (clear docs + working demo) — 20%  → **PARTIAL → PASS on code**
- README has framing + architecture diagram; `docs/ADDRESSES.md`, `DEMO.md`, `WHITEPAPER.md`
  exist; app runs with one command and a polished, animated UI with live data.
- **Remaining (NON-CODE):** record the video and deploy a public URL (see §D).

---

## C. Bonus tracks

| Bonus ($200 each, stackable) | Status | Notes |
|---|---|---|
| **Best Walrus integration** | **Strong PASS candidate** | Walrus is load-bearing for confidentiality + the settlement archive trail, not storage-for-storage's-sake. |
| **Best use of Tatum tools** | **Strong PASS candidate** | Uses **both** Tatum Sui RPC (all on-chain traffic) **and** the Tatum Data API (live pricing) — RPC + Data, server-side, key-safe. |
| Social share tagging @Tatum_io @WalrusFoundation @SuiNetwork | **NON-CODE** | Bonus visibility. Thread is written in `TWITTER_ROADMAP.md` — just post it. |

---

## D. Outstanding actions (none are code blockers)

1. **NON-CODE** — Record the 2–3 min video (`DEMO_READY.md §4`).
2. **NON-CODE** — Deploy the web app (Vercel) with `TATUM_API_KEY` set; add the URL to README.
3. **NON-CODE** — Post the X/LinkedIn thread tagging the three orgs (bonus).
4. **NON-CODE** — Submit repo + video via the Google Form before **Jun 6, 17:00 UTC**.
5. *(Optional polish, not scored-blocking)* — Link the settlement archive blob on-chain from
   the UI flow (the keeper already does this in `run-keeper.ts`); swap landing `<img>` logos
   for `next/image` to clear the lint advisories.

---

## E. Submission checklist

- [x] Builds clean (`pnpm build`)
- [x] Typecheck clean (all projects)
- [x] Lint clean (advisory-only warnings)
- [x] 31/31 Move tests pass
- [x] Runs with a single command (`pnpm dev`) — and with zero env config
- [x] Tatum Sui RPC wired end-to-end + verified at runtime
- [x] Tatum Data API wired (live price) + verified at runtime
- [x] Walrus used as core functionality (sealed bids + settlement archive)
- [x] No secrets committed (`.env*` gitignored; `.env.example` only) — see "Security" below
- [ ] Demo video recorded & uploaded *(NON-CODE)*
- [ ] Public deploy URL in README *(NON-CODE)*
- [ ] Social post tagging the 3 orgs *(NON-CODE)*
- [ ] Google Form submitted *(NON-CODE)*

### Security spot-check (done this pass)
- `.gitignore` ignores `.env`, `.env.local`, `.env.*.local`, `*.key`; only `.env.example`
  files are tracked. No real keys in the repo.
- `TATUM_API_KEY` is **server-side only** — read in `/api/rpc` and `/api/rates`; never
  shipped to the browser (no `NEXT_PUBLIC_` prefix).
- The baked-in `useVeilConfig` defaults are all **public** values (a deployed package id,
  public Walrus HTTP endpoints, Mysten's published Seal key-server object ids) — not secrets.
- No SQL surface (no database); inputs on `/create` and `/participate` are validated
  (NaN/negative/balance checks) before building transactions.
