# VEIL

> Confidential sealed-bid trading on Sui. Bids no one can see, size, or trace — until the auction closes.

VEIL is a sealed-bid auction **primitive** built on Sui Move, with bids encrypted via
**[Seal](https://seal.mystenlabs.com/)** (threshold IBE + time-lock), stored on
**[Walrus](https://www.walrus.xyz/)**, and reached through **[Tatum](https://tatum.io/)** Sui RPC/Data
APIs. Two apps ride on the same engine:

- **VEIL-Launch** — anti-snipe fair token launches.
- **VEIL-OTC** — a private dark pool for large trades.

Built for the **Tatum x Walrus** hackathon (track: *DeFi + Data*).

## Why it is private

Each bid is encrypted to an identity derived from `auctionId ‖ closeTime` and stored as a Walrus blob;
only the `blobId` and a commitment ever touch the chain. Seal's time-lock releases decryption keys
**at close**, so until then the bid satisfies the strong-hiding triple from
[IACR 2025/2127](https://eprint.iacr.org/2025/2127): value, existence, and identity are all hidden.
The construction follows the batched threshold-IBE line — Agarwal–Fernando–Pinkas, *Efficiently-
Thresholdizable Batched IBE* ([CRYPTO 2025](https://eprint.iacr.org/2024/1575)) — which Seal realizes.

## Repository layout

```
move/veil/        Sui Move package (auction primitive, Seal policy, settlement)
scripts/          M0 dependency spikes (Tatum RPC, Walrus, Seal)
apps/web/         Next.js frontend (@mysten/dapp-kit)
docs/             DEMO.md (visual scope + storyboard)
IMPLEMENTATION_PLAN.md   milestones, git workflow, roadmap
```

## Quickstart (M0)

Prerequisites: Node ≥ 20, pnpm 9, the [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install),
and a free [Tatum API key](https://dashboard.tatum.io).

```bash
pnpm install
cp .env.example .env          # then fill in TATUM_API_KEY and SUI_PRIVATE_KEY

pnpm spike:tatum              # verify Sui RPC reachability via the Tatum gateway
pnpm spike:walrus            # store + read a blob on Walrus testnet
pnpm spike:seal              # connect to Seal key servers + encrypt a secret

sui move test --path move/veil   # Move package builds + tests pass
pnpm --filter @veil/web dev      # frontend with Sui wallet connect
```

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the full milestone plan and
[`docs/DEMO.md`](./docs/DEMO.md) for the demo storyboard.

## License

MIT — see [LICENSE](./LICENSE).
