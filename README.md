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

```text
move/veil/        Sui Move package (auction primitive, Seal policy, settlement)
packages/sdk/     TypeScript SDK for Seal + Walrus + Tatum integrations and TX building
scripts/          Keeper orchestrator + spikes
apps/web/         Next.js frontend (@mysten/dapp-kit) [WIP]
docs/             DEMO.md (visual scope + storyboard)
```

## Current Status

- **On-chain Contracts**: 100% complete, fully unit-tested (31/31), and deployed to Sui Testnet.
- **Off-chain SDK**: 100% complete. Handles creating transactions, encrypting bids via Seal, and fetching fiat data from Tatum.
- **Keeper Orchestrator**: 100% complete. A fully automated backend loop that pulls encrypted blobs from Walrus, evaluates the Seal release policy on-chain, and settles the trade.
- **Frontend App**: **Work in Progress.**

## Quickstart

Prerequisites: Node ≥ 20, pnpm 9, the [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install),
and a free [Tatum API key](https://dashboard.tatum.io).

```bash
pnpm install
cp .env.example .env          # then fill in TATUM_API_KEY and SUI_PRIVATE_KEY

pnpm typecheck                # verifies everything is typed correctly
pnpm lint                     # lints all packages
sui move test --path move/veil # Move package builds + tests pass
pnpm --filter @veil/web dev   # run the frontend WIP
```

See [`docs/DEMO.md`](./docs/DEMO.md) for the demo storyboard.

## License

MIT — see [LICENSE](./LICENSE).
