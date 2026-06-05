# Veil Protocol v1 — Implementation Plan

> **A decentralized, sealed-bid auction network and OTC Dark Pool. Built on Sui. Data encrypted via Walrus. Powered by Tatum.**

This document breaks Veil Protocol into **fine-grained, independently buildable modules**. Each module is scoped to specific files, has explicit inputs/outputs, and includes a ready-to-use prompt for a standalone coding agent. Modules are organized into **layers** — build bottom-up.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Module Dependency Graph](#3-module-dependency-graph)
4. [Layer 0 — Project Foundation](#4-layer-0--project-foundation)
5. [Layer 1 — Smart Contracts](#5-layer-1--smart-contracts)
6. [Layer 2 — Cryptography Layer](#6-layer-2--cryptography-layer)
7. [Layer 3 — Storage Layer](#7-layer-3--storage-layer)
8. [Layer 4 — Data Layer](#8-layer-4--data-layer)
9. [Layer 5 — Frontend Hooks](#9-layer-5--frontend-hooks)
10. [Layer 6 — User Interface](#10-layer-6--user-interface)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND EXPLORER                        │
│   Launch Auction · Submit Encrypted Bid · Live Network Feed     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST / RPC
┌──────────────────────────────▼──────────────────────────────────┐
│                      VEIL PROTOCOL SDK                          │
│     Encryption · Hashing · Walrus Publishing · Sui Client       │
└───┬──────────────┬───────────────┬──────────────┬───────────────┘
    │              │               │              │
┌───▼───┐    ┌─────▼─────┐   ┌────▼────┐   ┌────▼────┐
│Seal   │    │  Walrus   │   │  Tatum  │   │  Sui    │
│Crypto │    │  Storage  │   │  Data   │   │  Network│
│Engine │    │  Layer    │   │  APIs   │   │  Layer  │
└───┬───┘    └─────┬──────┘   └────┬─────┘   └─────────┘
    │              │               │
    │    ┌─────────▼───────────┐   │
    │    │ SUI SMART CONTRACTS │   │
    │    │ veil_launch         │   │
    │    │ veil_otc            │   │
    │    └──┬──────┬───────┬───┘   │
    │       │      │       │       │
┌───▼───┐ ┌▼──────▼┐ ┌────▼───┐ ┌─▼──────────┐
│Token  │ │  Sui   │ │Walrus  │ │  Seal      │
│Deposit│ │  Coin  │ │Blob ID │ │  SHA-256   │
└───────┘ └────────┘ └────────┘ └────────────┘
```

### Protocol Flow
- **Sellers** deploy an auction/OTC request, defining the deposit, asset, and closing time.
- **Buyers** submit an encrypted bid (using Seal encryption).
- The raw encrypted bid is stored immutably on **Walrus Decentralized Storage**.
- Only the cryptographic commitment (SHA-256 hash) and the Walrus Blob ID are submitted to **Sui Mainnet**, preserving absolute privacy and MEV resistance.
- **Tatum APIs** provide real-time fiat exchange rates for seamless UX.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (Node.js 20+) |
| Package Manager | pnpm workspaces |
| Smart Contracts | Sui Move |
| Chain | Sui Testnet / Mainnet |
| Storage | Walrus Network |
| Data | Tatum RPC & Data APIs |
| Frontend | Next.js 14, TailwindCSS, Framer Motion |
| Blockchain Interaction | @mysten/dapp-kit, @mysten/sui.js |

---

## 3. Module Dependency Graph

```
LAYER 0:  M-01 (Next.js Scaffold) ── M-02 (Tailwind Design System)
              │
LAYER 1:  M-03 (Sui Move Launch Contract) ── M-04 (Sui Move OTC Contract)
              │
LAYER 2:  M-05 (Seal Encryption SDK)
              │
LAYER 3:  M-06 (Walrus Publisher) ── M-07 (Walrus Reader)
              │
LAYER 4:  M-08 (Tatum API Route) ── M-09 (Rate Polling Hook)
              │
LAYER 5:  M-10 (useActiveListings) ── M-11 (useAuctionState) ── M-12 (useSubmitBid)
              │
LAYER 6:  M-13 (Dashboard UI) ── M-14 (Create Auction UI) ── M-15 (Participate UI)
```

---

## 4. Layer 1 — Smart Contracts

### M-03: Token Launch Contract
**Files:** `contracts/sources/veil_launch.move`

**Description:** Sui Move module defining the state machine for a sealed-bid token launch.
**Key Functions:**
- `create_sale`: Initializes the auction object.
- `submit_bid`: Accepts a bidder's deposit, Walrus Blob ID, and SHA-256 hash.
- `reveal`: Closes the auction and decrypts bids.

**Coding Agent Prompt:**
```
Write a Sui Move smart contract for a sealed-bid token launch.
The contract must define a `Sale` object that holds a generic `Coin<T>` deposit.
Implement a `submit_bid` function that records a bidder's `archive_blob_id` (Option<vector<u8>>)
and `commitment` (vector<u8>). Ensure bids cannot be submitted after `close_ms`.
```

---

## 5. Layer 3 — Storage Layer

### M-06: Walrus Publisher
**Files:** `apps/web/lib/walrus.ts`

**Description:** SDK wrapper to publish encrypted blobs to the Walrus network.

**Coding Agent Prompt:**
```
Create a TypeScript utility for publishing blobs to the Walrus network.
Implement a `publishToWalrus` function that takes a JSON object, serializes it, 
and PUTs it to a configured Walrus publisher endpoint. It must return the newly created `blobId`.
```

---

## 6. Layer 4 — Data Layer

### M-08: Tatum API Route
**Files:** `apps/web/app/api/rates/route.ts`

**Description:** Next.js Route Handler that fetches real-time fiat exchange rates from Tatum's Data API.

**Coding Agent Prompt:**
```
Create a Next.js App Router API endpoint at `/api/rates`.
Use fetch to hit the Tatum API: `https://api.tatum.io/v3/tatum/rate/SUI?basePair=USD`.
Include the `x-api-key` header from the environment variables.
Return the parsed rate as a JSON response.
```

---

## 7. Layer 5 — Frontend Hooks

### M-12: Bid Submission Hook
**Files:** `apps/web/hooks/useSubmitBid.ts`

**Description:** Combines Cryptography, Storage, and Blockchain execution. Encrypts the user's bid, publishes to Walrus, and builds the Sui programmable transaction block (PTB).

**Coding Agent Prompt:**
```
Create a React hook `useSubmitBid`.
It must expose a function `submitLaunchBid` that takes a bid amount, encrypts it using Seal,
publishes the encrypted payload via `publishToWalrus`, generates the SHA-256 hash,
and constructs a Sui TransactionBlock calling `veil_launch::submit_bid`.
```

