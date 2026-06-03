# VEIL — Visual Scope & Demo Storyboard

> Scope for the frontend and the 2–3 min demo video. **Demo-minimal, cinematic where it counts.** The job of the UI is to make one invisible thing *visible*: a bid that exists on-chain but reveals nothing until the gavel falls.

---

## 1. Design direction

- **Tone:** dark, terminal-meets-vault. The product is about secrecy → the UI should feel like a sealed vault that opens on a timer, not a generic DeFi dashboard.
- **Signature interaction:** the **"What the chain sees" reveal** — the moment a judge realizes the on-chain bid is just a blob.
- **Motion = meaning:** encryption, blob upload, and the timed reveal each get a deliberate animation. Nothing else animates (so these read).
- **Palette:** near-black base; one accent for "sealed" (cold cyan), one for "revealed" (warm amber). Sealed→revealed = cyan→amber transition is the visual through-line.
- Built with the `frontend-design` skill so it avoids the generic AI-dashboard look.

---

## 2. Visual representation of each concept (the core of this scope)

| Backend concept | How it is shown on screen |
|---|---|
| **Bid value (plaintext)** | Visible only in the local "you" card, behind a lock glyph; never leaves the client in clear |
| **Seal encryption** | "Sealing…" animation — plaintext characters scramble into ciphertext; a wax-seal / lock closes |
| **Walrus blob** | A blob chip showing the truncated `blobId` (`0x9f…a2`) with a Walrus mark; click → opens the blob on a Walrus aggregator URL |
| **Sui on-chain state** | A "What the chain sees" panel rendering the *actual* object fields: `blobId`, `commitment`, `closeTime` — and conspicuously **no amount, no bidder** |
| **Tatum RPC** | A small "via Tatum" badge on every network action + a live status dot (green = gateway reachable) |
| **The hiding triple** | Three pills under the panel: `Value ✓ hidden` · `Existence ✓ hidden` · `Identity ✓ hidden`, each tied to what is/isn't visible on-chain |
| **closeTime / time-lock** | A countdown ring around the auction; while running = sealed (cyan); at zero = breaks open (amber) |
| **Keeper decryption** | "Unsealing…" sweep across all bid blobs; each blob flips from `••••` to its revealed value |
| **Clearing + winner** | Result card: clearing price, winner (now revealed), allocation/refunds; losing bids shown as "were never on-chain" |
| **Encrypted trade archive** | A "Vault archive" row → a Walrus `blobId` for the sealed record of the cleared auction |
| **Sniper bot (adversary)** | A second "🤖 Sniper" tab/pane reading the same chain data, perpetually showing `???` until reveal |

---

## 3. Screens (the only four we build)

**S1 — Auctions / Launches list**
- Cards: name, asset, countdown ring, #bids (count only), state badge (Sealed / Revealing / Settled).
- CTA: Create · Enter.

**S2 — Place sealed bid**
- Input amount → `[ Seal & Submit ]`.
- Inline pipeline visualization: `Encrypt (Seal) → Upload (Walrus) → Submit (Sui via Tatum)`, each step lighting up with its artifact (ciphertext → blobId → tx digest).

**S3 — "What the chain sees" (the star)**
```
┌────────────── YOU (local) ───────────┐   ┌──────── WHAT THE CHAIN SEES ────────┐
│  Bid:  120.0 SUI            🔒         │   │  auctionId: 0x4c…91                  │
│  Bidder: 0xYOU                        │   │  blobId:    0x9f…a2   ⧉ (Walrus)     │
│  status: sealed                       │   │  commitment:0x77…de                  │
└───────────────────────────────────────┘   │  amount:    —   bidder: —            │
                                             │  closeTime: 00:42 ⏳                 │
  Value ✓ hidden   Existence ✓ hidden        └─────────────────────────────────────┘
  Identity ✓ hidden        🤖 Sniper sees: ???        via Tatum ●
```

**S4 — Reveal / Result**
- Countdown hits 0 → "Unsealing…" → bids flip to values → clearing price + winner + allocation/refunds.
- "Vault archive: 0x… (Walrus)" link to the sealed record.

---

## 4. Demo storyboard (2–3 min video)

| Time | Beat | Screen | What the viewer sees |
|---|---|---|---|
| 0:00–0:15 | Hook | title | "A trade no one can see, size, or trace — until the gavel falls. On Sui." |
| 0:15–0:40 | Place a bid | S2 | Type 120 SUI → Seal seals it → Walrus blobId flashes → Sui tx via Tatum |
| 0:40–1:15 | **The reveal panel** | S3 | Side-by-side: your real bid vs. chain showing only `blobId`+commitment; the three hiding pills light up; the 🤖 Sniper tab shows `???` |
| 1:15–1:35 | Snipe fails | S3 | Sniper "front-runs" — copies the only on-chain data (a blob) — and gains nothing |
| 1:35–2:05 | Gavel falls | S4 | Countdown → "Unsealing…" → all bids flip to values → clearing price + winner |
| 2:05–2:25 | Archive + apps | S4 + S1 | Sealed record on Walrus; one line: "same engine powers VEIL-Launch & VEIL-OTC" |
| 2:25–2:45 | Close | — | Stack lockup: Sui · Walrus · Seal · Tatum; "the private price-discovery layer for Sui." |

---

## 5. Tech & component inventory

- **Stack:** Next.js + React · `@mysten/dapp-kit` (Sui wallet) · Seal SDK · Walrus client · Tatum Sui RPC/Data API. Tailwind for styling.
- **Components:** `AuctionCard`, `CountdownRing`, `SealPipeline` (encrypt→upload→submit), `ChainSeesPanel` (the star), `HidingPills`, `BlobChip`, `SniperPane`, `RevealSweep`, `ResultCard`, `TatumStatusBadge`.
- **Mock/seed mode:** a demo seed script pre-creates an auction with N sealed bids so the video doesn't wait on real timers; a "fast clock" toggle compresses `closeTime` for recording.

---

## 6. Scope boundaries

**In:** the 4 screens, the privacy panel, the sniper pane, the reveal animation, both-apps mention, Tatum status badge, seed/fast-clock demo mode.
**Out (post-hackathon):** account/history pages, multi-asset management, settings, analytics, mobile layout, theming. Mention as roadmap only.

---

## 7. Judging tie-in

- **Presentation (20%):** the reveal panel + working demo carry this.
- **Creativity (20%):** "a DEX where not even the sequencer sees your order" is *shown*, not told.
- **Walrus + Tatum (30%):** blobId chips + "via Tatum" badge make the integration visible on every action.
