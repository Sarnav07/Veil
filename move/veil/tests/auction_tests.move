#[test_only]
module veil::auction_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts};
use veil::auction::{Self, Auction};
use veil::settlement;

const STATE_SETTLED: u8 = 2;

public struct Lot has key, store {
    id: UID,
}

#[test]
fun first_price_two_bidders() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;
    let bob = @0xb0b;

    let mut sc = ts::begin(seller);

    // tx1: seller creates + shares an auction closing at t = 1000ms
    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let lot = Lot { id: object::new(ctx) };
        auction::create<Lot>(lot, settlement::first_price(), 1000, &clk, ctx);
        clock::destroy_for_testing(clk);
    };

    // tx2: alice bids 100
    ts::next_tx(&mut sc, alice);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let c = coin::mint_for_testing<SUI>(100, ctx);
        auction::submit_bid(&mut a, c, b"blobA", b"cmtA", &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    // tx3: bob bids 250 (the eventual winner)
    ts::next_tx(&mut sc, bob);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let c = coin::mint_for_testing<SUI>(250, ctx);
        auction::submit_bid(&mut a, c, b"blobB", b"cmtB", &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    // tx4: close + settle at t = 1000
    ts::next_tx(&mut sc, seller);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        // read path: bids (and their Walrus blobIds) are queryable on-chain
        assert!(auction::bid_count(&a) == 2, 10);
        assert!(auction::bidder(&a, 1) == bob, 11);
        assert!(auction::bid_amount(&a, 1) == 250, 12);
        assert!(auction::bid_blob_id(&a, 1) == b"blobB", 13);
        assert!(auction::bid_commitment(&a, 1) == b"cmtB", 14);

        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 1000);
        auction::close(&mut a, &clk);
        auction::settle(&mut a, ctx);
        assert!(auction::state(&a) == STATE_SETTLED, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(a);
    };

    // tx5: verify payouts — seller paid 250, alice refunded 100, bob holds the lot
    ts::next_tx(&mut sc, seller);
    {
        let paid = ts::take_from_address<Coin<SUI>>(&sc, seller);
        assert!(coin::value(&paid) == 250, 1);
        coin::burn_for_testing(paid);

        let refund = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&refund) == 100, 2);
        coin::burn_for_testing(refund);

        let Lot { id } = ts::take_from_address<Lot>(&sc, bob);
        object::delete(id);
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
        auction::create<Lot>(lot, settlement::second_price(), 1000, &clk, ctx);
        clock::destroy_for_testing(clk);
    };

    ts::next_tx(&mut sc, seller);
    {
        let mut a = ts::take_shared<Auction<Lot>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 1000);
        auction::close(&mut a, &clk);
        auction::settle(&mut a, ctx);
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
