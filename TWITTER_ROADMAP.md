# Veil Protocol — X (Twitter) Roadmap

Everything below is ready to copy-paste. Built for the **Tatum × Walrus on Sui**
hackathon push. Submission deadline: **June 6, 17:00 UTC**. Always tag
**@Tatum_io @WalrusFoundation @SuiNetwork** on the big posts (it's a bonus criterion).

---

## 1. Account setup

**Handle:** `@veilprotocol` (fallbacks: `@veil_protocol`, `@veilonsui`)

**Display name:** `Veil Protocol`

**Bio:**
> Sealed-bid auctions & OTC dark pools on @SuiNetwork. Bids encrypted with Seal, stored on @WalrusFoundation, settled on-chain. Zero front-running. Built for the @Tatum_io × Walrus hackathon.

**Pinned tweet:** (use "The demo post" in §6 once the video is live; until then, pin tweet 1/ of the launch thread.)

**Banner direction:**
- Pure black background (`#000`) matching the app. A faint scan-line / grid motif in the
  app's accent green (`#3ae86d`) bleeding in from the left edge.
- Wordmark "VEIL PROTOCOL" centered-left, with the tagline "Any bid. Any size. Fully
  on-chain." in a serif italic underneath.
- Bottom-right: small Sui + Walrus + Tatum logos in muted white.

**Profile image direction:**
- The hexagon mark (same as the navbar `Hexagon` icon) in accent green on black, slight
  outer glow. Keep it legible at 48px.

---

## 2. Content pillars

**Pillar 1 — The problem (MEV / front-running).** Why open order books leak alpha and how
sealed bids fix it.
> Example: Every time you place a visible bid on-chain, you're showing your hand to bots that can reorder, copy, or front-run you. Auctions shouldn't work like a poker game where everyone sees your cards. That's the thing we're fixing.

**Pillar 2 — How the tech works (Seal + Walrus + Sui + Tatum).** Plain-English breakdowns of
the cryptography and the stack.
> Example: A Veil bid never touches the chain in plaintext. It's encrypted with @WalrusFoundation-stored Seal ciphertext; only a hash commitment + deposit go on-chain via @Tatum_io RPC. After close, the contract re-hashes every revealed bid to prove nobody swapped theirs. Trustless by construction.

**Pillar 3 — Build in public.** Honest progress, bugs, decisions, screenshots. (See §5.)
> Example: Spent two hours today chasing a "module not found" that turned out to be a stale install, not a code bug. Classic. Green build now. Onward.

**Pillar 4 — Use cases.** Token launches without snipers, OTC blocks without slippage, DAO
treasury sales.
> Example: A DAO wants to sell 2M tokens without tanking its own price. Public order? Front-run to death. A Veil OTC dark pool: buyers submit sealed quotes, a hidden reserve floor protects the DAO, best price clears. No leak, no slippage games.

---

## 3. Pre-launch announcement thread (post in full, numbered)

**1/**
> We built Veil Protocol: sealed-bid auctions and OTC dark pools on @SuiNetwork where nobody — not bots, not validators, not us — can see a bid until the auction closes.
>
> Here's why that matters, and how it works. 🧵

**2/**
> Every open auction on-chain has the same flaw: your bid is public the second you submit it.
>
> Bots reorder around you. Snipers copy you. Whales fade you. The "fair market price" was never fair.

**3/**
> Veil seals the bid itself.
>
> You encrypt your bid client-side. The ciphertext goes to @WalrusFoundation. Only a hash commitment + your deposit hit the chain. The order book is mathematically blank until close.

**4/**
> We use Mysten **Seal** for time-lock encryption: bids literally cannot be decrypted before the auction's close time. Not "shouldn't" — *can't*.
>
> When it closes, every bid is revealed at once and the contract re-hashes each one to prove it wasn't swapped.

**5/**
> Two products on the same primitive:
>
> 🟢 **Token Launch** — sell into a sealed multi-unit auction. No snipers, uniform clearing price.
> 🟣 **OTC Dark Pool** — sealed quotes against a *hidden* reserve floor. Move size without leaking it.

**6/**
> The stack:
> • @SuiNetwork — Move contracts, on-chain settlement (31/31 tests green)
> • @WalrusFoundation — encrypted bid storage + settlement archive
> • Mysten Seal — time-lock encryption
> • @Tatum_io — all Sui RPC + live SUI/USD data
>
> Built for the #Tatum × #Walrus hackathon.

**7/**
> Bids in, sealed. Auction closes. Bids revealed, verified, settled on-chain. The full result is archived back to Walrus so anyone can audit it later.
>
> Zero front-running. Best price wins. Fully on-chain.

**8/**
> Demo + code below. We'd love your feedback. 👇
> [link to demo video] · [link to GitHub]
>
> @Tatum_io @WalrusFoundation @SuiNetwork

---

## 4. The "build in public" tweets (5, authentic, post throughout)

**BIP-1**
> Decision of the day: do we store bids encrypted on Walrus, or just hash them on-chain?
> Hash-only is cheaper but then the bid is gone — you can't reveal it later. Walrus it is. The ciphertext lives off-chain, the commitment lives on-chain. Best of both.

**BIP-2**
> Today's bug: `next build` exploding with "Cannot find module 'tailwindcss'". Spent way too long suspecting my webpack config. It was a stale `pnpm install`. The deps were declared, just not on disk. Always check the boring explanation first.

**BIP-3**
> Got the Tatum RPC proxy working end-to-end. Every on-chain read in the dApp now goes through Tatum's Sui gateway with the key staying server-side. `sui_getChainIdentifier` came back `4c78adac` — that's testnet saying hi. Small thing, felt great.

**BIP-4**
> Subtle one: our SDK used NodeNext imports (`./bid.js`) so tsc was happy, but Next's bundler wouldn't resolve `.js`→`.ts` for the workspace package. Fix was a one-line `extensionAlias` in next.config. Two toolchains, one source of truth. Shipping it.

**BIP-5**
> Made the activity feed actually stream — a new sealed bid slides in every few seconds. It's partly for the demo, but watching encrypted bids tick in live finally made the whole thing *feel* like a network instead of a static page.

---

## 5. The demo post (the single most important tweet)

> You can't front-run what you can't see.
>
> Veil Protocol: sealed-bid auctions on @SuiNetwork. Every bid is encrypted with Seal, stored on @WalrusFoundation, and only a hash hits the chain until the auction closes. No snipers. No MEV. Best price wins.
>
> 90 seconds 👇 [VIDEO]
>
> @Tatum_io @WalrusFoundation @SuiNetwork

*(Attach the demo video natively — native video outperforms a link. First frame should be
the hero with the live activity feed already moving. Pin this once it's up.)*

---

## 6. Engagement tweets (3, designed to start replies)

**ENG-1 (hot take / poll)**
> Unpopular opinion: on-chain order books are a privacy disaster and we just got used to it.
>
> Should bids be public by default, or sealed by default?
> 🔓 Public (transparency)
> 🔒 Sealed (no front-running)

**ENG-2 (question to builders)**
> Sui builders: what's the most underrated primitive on @SuiNetwork right now?
>
> I'll start — Seal time-lock encryption. The fact that you can make data *undecryptable until a future time* on-chain quietly unlocks a whole category of apps. What's yours?

**ENG-3 (relatable / reply bait)**
> Every hackathon, hour 1: "we'll keep the scope tiny."
> Every hackathon, hour 40: encrypted bids, an OTC dark pool, a keeper, and a live data feed.
>
> What did your "tiny" hackathon scope turn into?

---

## 7. Posting schedule (today → submission)

> Adjust to your timezone; keep the two tagged orgs on the launch thread + demo post.
> Deadline is **Jun 6, 17:00 UTC** — the demo post should be live well before that.

### June 5 (today) — set the stage
- **Morning:** Profile setup (handle, bio, banner, pfp). Post **BIP-3** (Tatum proxy win).
- **Midday:** Post **ENG-2** (builders question) to warm up the timeline.
- **Afternoon:** Post **BIP-1** (Walrus vs hash decision).
- **Evening:** Post **BIP-5** (live feed) with a screen-capture GIF of the streaming feed.

### June 6 (submission day) — launch
- **Early (T-8h to deadline):** Post the full **launch thread (§3)**, tagging
  @Tatum_io @WalrusFoundation @SuiNetwork. Pin tweet 1/.
- **Mid-morning:** Record + upload the demo video. Post the **demo post (§5)** with native
  video. Re-pin it.
- **~2h before deadline:** Post **ENG-1** (sealed vs public poll) to drive late engagement,
  quote-tweeting the demo post.
- **Before 17:00 UTC:** Submit repo + video via the Google Form. Post **BIP-2** or **BIP-4**
  as a light "we shipped" closer, quoting the demo.
- **After submission:** Reply to anyone who engaged; quote-tweet @Tatum_io / @WalrusFoundation
  / @SuiNetwork posts with your demo where relevant.

### Optional post-submission (if results June 7+)
- Thank-you post + lessons learned (Pillar 3). If you place or win a bonus track, quote the
  announcement with the demo. Keep the momentum — the account is now a real project, not a
  hackathon entry.
