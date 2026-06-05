# Veil — A Confidential Sealed-Bid Trading Primitive on Sui

**Version 1.0 · Sui Testnet · Tatum × Walrus Hackathon 2026**

---

## Abstract

Public blockchains expose every order before it executes. For auctions and trading this is
ruinous: bids can be front-run, launches sniped by the fastest bot rather than the fairest
bid, and large blocks cannot trade without telegraphing the move and crushing the price.

Veil is a sealed-bid primitive on Sui that hides a bid's **value**, **existence**, and
(at the economic layer) **price intent** until the auction closes, while still settling
fully on-chain and fully verifiably. It composes three technologies — **Mysten Seal** for
time-lock encryption, **Walrus** for decentralized blob storage, and **Sui Move** for
commitment-bound settlement — and routes all chain access through the **Tatum** Sui RPC
gateway and Data API. From this one engine Veil ships three products: a single-item sealed
auction, a fair uniform-price token launch, and an OTC dark pool with a hidden reserve.

---

## 1. Design Goals

1. **Pre-settlement confidentiality.** Nothing on-chain may reveal a bid's value while the
   auction is live — not to other bidders, not to the seller, not to the keeper.
2. **Post-settlement integrity.** Once revealed, every bid must be provably the one that was
   committed. A keeper must be unable to forge, drop, or alter a value.
3. **Fund conservation.** On every code path, coins in equal coins out: winners pay exactly
   the clearing price, losers are refunded in full, the seller collects the remainder.
4. **Fair clearing.** Launch winners pay one uniform price, removing the speed advantage that
   drives MEV. OTC makers protect a floor without revealing it.
5. **Trust-minimized liveness.** The keeper is a liveness role, not a safety role: the
   commitment scheme means it can only ever settle to the truth.

---

## 2. Cryptographic Architecture

Veil's confidentiality comes from separating *what the chain stores* from *what the bid
actually is*. Three layers cooperate.

### 2.1 Time-Lock Encryption — Seal

When a user submits a bid, it is encrypted **client-side** with Mysten Seal, a Threshold
Identity-Based Encryption (IBE) scheme. The decryption identity is derived from the auction's
close time (`timeLockId(closeMs)` in `packages/sdk/src/seal.ts`), and the on-chain policy
`seal_policy::seal_approve` gates key release: the Seal key servers will only assemble the
decryption key once the chain confirms `current_time ≥ closeTime`. This is a cryptographic
time-lock — not a UI convention. Until the auction is genuinely over, the ciphertext is
undecryptable even by the bidder. A threshold of key servers (configurable; the SDK defaults
to two testnet servers) must cooperate, so no single server can unlock a bid early.

### 2.2 Decentralized Storage — Walrus

Ciphertext blobs are too large and too expensive to live on-chain. Veil stores each encrypted
bid, quote, and the maker's hidden reserve on **Walrus**, receiving a compact `blobId`
(`WalrusClient.store` / `.read` in `packages/sdk/src/walrus.ts`, with retry). Walrus is not an
afterthought here — sealed bidding is only possible *because* the ciphertext can live off-chain
on durable, decentralized storage while the chain keeps just a pointer. After settlement, a
JSON audit record is encoded and pushed back to Walrus, and its blob ID is linked on-chain via
`add_archive`, giving an immutable trade history that never bloats chain state.

### 2.3 On-Chain Commitments — Sui Move

The transaction that places a bid carries only two things: the Walrus `blobId` and a SHA-256
**commitment** over the plaintext. The commitment domains differ per product so each reveal is
bound to exactly its claimed shape:

| Product | Commitment preimage |
|---------|---------------------|
| Auction | `bcs(amount) ‖ nonce` |
| Launch | `bcs(price) ‖ bcs(qty) ‖ nonce` |
| OTC quote | `bcs(price) ‖ nonce` |
| OTC reserve | `bcs(reserve) ‖ nonce` |

The off-chain encoders (`bid.ts`, `launch.ts`, `otc.ts`) serialize bytes that are
**byte-for-byte identical** to Move's `std::bcs::to_bytes` followed by `std::hash::sha2_256`,
so a commitment computed in the browser verifies inside the contract without translation. The
random `nonce` ensures two equal bids still produce distinct blobs and commitments, and makes
the hidden reserve non-brute-forceable. While the auction runs, the chain holds only hashes
and pointers — the demand curve is invisible.

---

## 3. The Settlement Flow

When the close time is reached, the object transitions `BIDDING/QUOTING → REVEALING`. An
off-chain **keeper** (`scripts/src/run-keeper.ts`) then drives settlement:

1. **Fetch** — read the on-chain object, extract each bid's `blobId`, download every
   ciphertext from Walrus.
2. **Unseal** — create a Seal `SessionKey`, and for each blob request decryption from the
   threshold network. Key release succeeds only because the close time has passed, satisfying
   `seal_approve`.
3. **Shape** — decode each plaintext into reveal arrays (`prices`, `quantities`, `nonces`),
   and for OTC, unseal the maker's reserve blob.
4. **Settle** — submit one Programmable Transaction Block that `close()`s (if still open) and
   `settle()`s atomically.
5. **Verify on-chain** — `settle` re-hashes every revealed tuple and asserts it equals the
   stored commitment (`EBadCommitment` on mismatch) *before any funds move*. A lying keeper
   simply aborts the transaction.
6. **Mark-to-market** — the keeper queries the **Tatum Data API** for live SUI/USD and prints
   the clearing price in fiat (`TatumClient.getExchangeRate`).
7. **Archive** — encode the settlement record, store it on Walrus, and call `add_archive` to
   anchor the blob ID on-chain (emitting `ArchiveLinked`).

Because the frontend's `SuiClientProvider` points at `/api/rpc`, *every* read in steps that
run through the dApp — and all transaction execution — is proxied through the **Tatum Sui RPC
gateway** server-side, with the API key never exposed to the browser, and a public-fullnode
fallback if Tatum is unreachable.

---

## 4. Smart-Contract Engine

All financial logic lives in `move/veil/sources/` and is covered by 31 unit tests.

### 4.1 `settlement.move` — pure clearing
A stateless, separately-testable engine over arrays of bid values:
- `clear(amounts, pricing)` returns `(winner_index, price)` for single-winner auctions under
  **first-price** (winner pays their own bid) or **second-price / Vickrey** (winner pays the
  highest *other* bid). Ties go to the earliest bid.
- `uniform_clear(prices, quantities, supply)` walks the demand curve from the highest price
  down to the marginal **clearing price** (the lowest price that still receives allocation).
  Bids strictly above fill in full; bids exactly at the margin split the remainder **pro-rata
  by demand**, with the floor keeping the total within supply. All multiplications use
  overflow-safe `u128` arithmetic.

### 4.2 `auction.move` — single-item sealed auction
Holds a generic `Option<T>` item (`T: key + store`), a fixed SUI deposit per bidder, and the
commitment list. `submit_bid` rejects late bids and wrong deposits; `settle` opens every
commitment, clears via `settlement::clear`, pays the seller the clearing price from the
winner's deposit, refunds the winner's surplus and all losers in full, and transfers the item.
Empty auctions return the item to the seller.

### 4.3 `veil_launch.move` — fair token launch
Holds a `Balance<T>` supply. Each bid commits `(price, qty)`; `settle` checks
`price·qty ≤ deposit` (u128), opens every commitment, then `uniform_clear`s the whole sale at a
single marginal price. Every winner pays the **same** clearing price per unit — eliminating the
fastest-bot advantage entirely — receives its allocation, and is refunded the rest; the seller
takes the proceeds and any unsold supply.

### 4.4 `veil_otc.move` — sealed-quote RFQ dark pool
A maker offers a fixed quantity and commits a **hidden reserve** (`reserve_commitment`).
Dealers escrow a uniform deposit and submit sealed quotes. At `settle`, the contract first
verifies the reserve preimage, opens every quote, and awards the asset to the highest quote
**at or above** the reserve (first-price), paying the maker. If the reserve isn't met, the
maker keeps the asset and all dealers are refunded — and the floor was never revealed on-chain.

### 4.5 `seal_policy.move` — the time-lock gate
Implements `seal_approve`, the on-chain predicate the Seal key servers consult before releasing
decryption keys: it confirms the auction's close time has passed, enforcing the time-lock.

---

## 5. Why It Resists MEV and Front-Running

- **No mempool signal.** A pending `submit_bid` carries only a hash and a blob pointer; there
  is nothing to sandwich.
- **No early reveal.** Seal's threshold time-lock makes the ciphertext undecryptable before
  close, so no observer — including the keeper — can act on a bid's value.
- **No speed advantage at clearing.** Uniform-price launch settlement means latency buys you
  nothing; only an honest, competitive bid wins allocation.
- **No reserve leakage.** The OTC floor is a salted commitment, so counterparties cannot
  reverse-engineer and squeeze the maker.
- **No keeper discretion.** Commitment re-hashing inside `settle` means the keeper's only valid
  move is the truthful one.

---

## 6. Limitations & Future Work

- **Keeper liveness.** Settlement currently relies on a keeper to reveal and submit; a
  decentralized keeper set or incentive layer would remove the single operator.
- **OTC reserve custody.** The maker's reserve is recoverable by the keeper at settle via Seal;
  a fully permissionless reserve reveal is future work.
- **Bid-set scale.** Clearing uses insertion sort and linear scans appropriate for the sealed,
  modest bid counts of block trades and launches; very large sales would want a different
  clearing path.

---

## 7. Conclusion

Veil shows that high-stakes on-chain trading need not be transparent and adversarial. By
pushing ciphertext to Walrus, time-locking it with Seal, binding it with on-chain commitments,
and settling through Tatum-routed Sui transactions, Veil delivers auctions, launches, and OTC
block trades that are simultaneously **private before settlement** and **fully verifiable
after it** — trustless and confidential at once.
