# Veil Protocol — Official Demo Script

> **Target:** 2–3 min video. Deadline: **June 6, 17:00 UTC**.
> **Tag in the X post:** `@Tatum_io @WalrusFoundation @SuiNetwork`.

---

## 0. Screen Setup (Before Recording)
- Have your **Slide Deck** full screen and ready to go.
- Have a browser window open to the Veil Web App (connected to Sui Testnet).
- Have your terminal open on the right side, ready to run the keeper script.

---

## Part 1: The Pitch (Slide Presentation) - 45 seconds
*Open full screen on Slide 1.*

### Slide 1: Title & Capabilities
> "Hi, we are building Veil. A fully decentralized dark pool and OTC exchange that brings 100% MEV-resistance and privacy to Sui. We offer institutional OTC trading, fair sealed-bid token launches, and trustless settlement via Walrus and Tatum."

### Slide 2: The Problem
> "DeFi hasn't solved three critical issues: Public mempools allow MEV extraction. Traditional dark pools rely on centralized servers. And transparent blockchains make fair token launches almost impossible without market manipulation."

### Slide 3: The Architecture
> "Here is how Veil solves this, top to bottom. We route traffic through Tatum's RPC gateways. Bids are encrypted using Mysten Seal time-locks. And everything is settled completely on-chain using Sui smart contracts, with our immutable settlement data anchored directly to the Walrus Protocol."

### Slide 4: No Backend. No Trust.
> "To prove this, we don't use a centralized backend. Every dark pool runs through our smart contract, and every encrypted bid is stored directly on decentralized infrastructure. Let me show you how it works live."

---

## Part 2: The Live Demo (Browser & Terminal) - 1.5 minutes
*Switch screen to the split-view: Browser on the left, Terminal on the right.*

### Step 1: The DApp & Token Launches
> "Welcome to the Veil DApp. As you can see, we have a live SUI/USD price feed streaming from Tatum. Veil supports two powerful modules: Token Launches for fair public distributions, and OTC Dark Pools for institutional liquidations. Today, we'll demonstrate an OTC trade."

### Step 2: Create the OTC Pool
*Fill out the OTC creation form.*
> "I am listing a private block of SUI. I'll set a hidden reserve floor. This reserve price is encrypted locally, stored on Walrus, and cannot be seen by anyone—not even the blockchain—until settlement."
*Click submit and approve the wallet transaction.*

### Step 3: Submit a Sealed Bid
*Submit a bid on the participate page.*
> "Now, a buyer submits an encrypted bid. The bid is secured by Mysten Seal time-locks and the ciphertext is pushed to Walrus. No one knows the bid amount, completely eliminating front-running."

### Step 4: The Keeper Settlement (Terminal)
*Switch to the terminal. Run the keeper script.*
> "Once the auction expires, anyone can run the decentralized keeper to settle it. Watch the terminal logs:"
*Point to the logs as they appear on screen:*
> "First, it fetches the encrypted reserve from Walrus and unseals it using Mysten Seal shares."
> "Next, it pulls the real-time SUI price from the Tatum Data API for an accurate mark-to-market valuation."
> "Finally, it builds a single atomic transaction that executes the settlement on-chain."

### Step 5: The Immutable Proof (Browser)
*The browser should redirect to the Results page.*
> "Back in the UI, we can see the auction cleared perfectly. But most importantly, look at the 'Verified on Walrus' section at the bottom."
*Highlight the Blob ID and the raw JSON on the screen.*
> "The keeper archived the entire settlement log as an immutable JSON payload on Walrus, and etched that exact Blob ID permanently into the Sui Blockchain. You can click it to view the raw data. It is a completely verifiable, decentralized audit trail."

---

## Part 3: The Grand Finale Pitch - 15 seconds
*Look at the camera / speak confidently to close the video.*
> "Veil proves that we can have confidential, front-run-resistant trading without sacrificing decentralization. This architecture is revolutionary and ready for public mainnet deployment to protect everyday traders and institutions alike. Thank you."