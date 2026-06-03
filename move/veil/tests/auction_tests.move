#[test_only]
module veil::auction_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts};
use veil::auction::{Self, Auction};
use veil::settlement;

const STATE_SETTLED: u8 = 2;
const DEPOSIT: u64 = 1_000;

public struct Lot has key, store {
    id: UID,
}

// How a bidder builds the on-chain commitment; settle recomputes this to verify.
fun commit_of(amount: u64, nonce: vector<u8>): vector<u8> {
    let mut preimage = std::bcs::to_bytes(&amount);
    vector::append(&mut preimage, nonce);
    std::hash::sha2_256(preimage)
}

fun deposit_coin(scenario: &mut ts::Scenario): Coin<SUI> {
    coin::mint_for_testing<SUI>(DEPOSIT, ts::ctx(scenario))
}

#[test]
fun commitment_matches_sdk() {
    // sha2_256(bcs(100u64) || b"veil") as computed by @veil/sdk — the two sides
    // must agree or a bidder's commitment would never open at settlement.
    let expected = x"d6d9d78d86e0cd7a157b872adbbaa401d071a8357dd72b4b8b4ecdd74f7970fc";
    assert!(commit_of(100, b"veil") == expected, 0);
}

#[test]
fun first_price_two_bidders() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;
    let bob = @0xb0b;

    let mut sc = ts::begin(seller);

    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let lot = Lot { id: object::new(ctx) };
        auction::create<Lot>(lot, settlement::first_price(), 5_000, DEPOSIT, &clk, ctx);
        clock::destroy_for_testing(clk);
    };

    // alice bids 100 (hidden); only the deposit + commitment are on-chain
    ts::next_tx(&mut sc, alice);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let coin = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        auction::submit_bid(&mut a, coin, b"blobA", commit_of(100, b"nonce-alice"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    // bob bids 250 (the eventual winner)
    ts::next_tx(&mut sc, bob);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let coin = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        auction::submit_bid(&mut a, coin, b"blobB", commit_of(250, b"nonce-bob"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    // close + reveal + settle at t = 5000
    ts::next_tx(&mut sc, seller);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        // the chain exposes only deposit + commitment + blobId — no amounts
        assert!(auction::bid_count(&a) == 2, 10);
        assert!(auction::deposit(&a) == DEPOSIT, 11);
        assert!(auction::bidder(&a, 1) == bob, 12);
        assert!(auction::bid_blob_id(&a, 1) == b"blobB", 13);
        assert!(auction::bid_commitment(&a, 1) == commit_of(250, b"nonce-bob"), 14);

        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        auction::close(&mut a, &clk);
        auction::settle(&mut a, vector[100, 250], vector[b"nonce-alice", b"nonce-bob"], ctx);
        assert!(auction::state(&a) == STATE_SETTLED, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    // first-price: seller gets 250, bob refunded 1000-250, alice refunded 1000, bob holds the lot
    ts::next_tx(&mut sc, seller);
    {
        let paid = ts::take_from_address<Coin<SUI>>(&sc, seller);
        assert!(coin::value(&paid) == 250, 1);
        coin::burn_for_testing(paid);

        let alice_refund = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&alice_refund) == DEPOSIT, 2);
        coin::burn_for_testing(alice_refund);

        let bob_refund = ts::take_from_address<Coin<SUI>>(&sc, bob);
        assert!(coin::value(&bob_refund) == DEPOSIT - 250, 3);
        coin::burn_for_testing(bob_refund);

        let Lot { id } = ts::take_from_address<Lot>(&sc, bob);
        object::delete(id);
    };

    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = auction::EBadCommitment)]
fun settle_rejects_forged_reveal() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;

    let mut sc = ts::begin(seller);
    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let lot = Lot { id: object::new(ctx) };
        auction::create<Lot>(lot, settlement::first_price(), 5_000, DEPOSIT, &clk, ctx);
        clock::destroy_for_testing(clk);
    };

    ts::next_tx(&mut sc, alice);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let coin = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        auction::submit_bid(&mut a, coin, b"blobA", commit_of(100, b"nonce-alice"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    ts::next_tx(&mut sc, seller);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        auction::close(&mut a, &clk);
        // keeper tries to inflate alice's bid to 900 — commitment won't open
        auction::settle(&mut a, vector[900], vector[b"nonce-alice"], ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    ts::end(sc);
}

#[test]
fun no_bids_returns_item_to_seller() {
    let seller = @0x5e11e7;
    let mut sc = ts::begin(seller);

    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let lot = Lot { id: object::new(ctx) };
        auction::create<Lot>(lot, settlement::second_price(), 5_000, DEPOSIT, &clk, ctx);
        clock::destroy_for_testing(clk);
    };

    ts::next_tx(&mut sc, seller);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        auction::close(&mut a, &clk);
        auction::settle(&mut a, vector[], vector[], ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    ts::next_tx(&mut sc, seller);
    {
        let Lot { id } = ts::take_from_address<Lot>(&sc, seller);
        object::delete(id);
    };

    ts::end(sc);
}
