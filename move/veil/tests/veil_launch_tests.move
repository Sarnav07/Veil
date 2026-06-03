#[test_only]
module veil::veil_launch_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts};
use veil::veil_launch::{Self, Sale};

const STATE_SETTLED: u8 = 2;
const DEPOSIT: u64 = 1_000_000;

// The token being sold.
public struct TOKEN has drop, store {}

// How a bidder builds the on-chain commitment; settle recomputes this to verify.
fun commit_of(price: u64, qty: u64, nonce: vector<u8>): vector<u8> {
    let mut preimage = std::bcs::to_bytes(&price);
    vector::append(&mut preimage, std::bcs::to_bytes(&qty));
    vector::append(&mut preimage, nonce);
    std::hash::sha2_256(preimage)
}

fun deposit_coin(sc: &mut ts::Scenario): Coin<SUI> {
    coin::mint_for_testing<SUI>(DEPOSIT, ts::ctx(sc))
}

fun open_sale(sc: &mut ts::Scenario, supply: u64) {
    let ctx = ts::ctx(sc);
    let clk = clock::create_for_testing(ctx);
    let tokens = coin::mint_for_testing<TOKEN>(supply, ctx);
    veil_launch::create<TOKEN>(tokens, 5_000, DEPOSIT, &clk, ctx);
    clock::destroy_for_testing(clk);
}

fun bid(sc: &mut ts::Scenario, who: address, blob: vector<u8>, commitment: vector<u8>) {
    ts::next_tx(sc, who);
    let mut sale = ts::take_shared<Sale<TOKEN>>(sc);
    let coin = deposit_coin(sc);
    let ctx = ts::ctx(sc);
    let clk = clock::create_for_testing(ctx);
    veil_launch::submit_bid(&mut sale, coin, blob, commitment, &clk, ctx);
    clock::destroy_for_testing(clk);
    ts::return_shared(sale);
}

#[test]
fun undersubscribed_fills_everyone_at_lowest() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;
    let bob = @0xb0b;

    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);
    // alice: 10 units @ price 12; bob: 10 units @ price 8. Demand 20 < supply 100.
    bid(&mut sc, alice, b"blobA", commit_of(12, 10, b"na"));
    bid(&mut sc, bob, b"blobB", commit_of(8, 10, b"nb"));

    ts::next_tx(&mut sc, seller);
    {
        let mut sale = ts::take_shared<Sale<TOKEN>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_launch::close(&mut sale, &clk);
        veil_launch::settle(
            &mut sale,
            vector[12, 8],
            vector[10, 10],
            vector[b"na", b"nb"],
            ctx,
        );
        assert!(veil_launch::state(&sale) == STATE_SETTLED, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(sale);
    };

    // clearing price 8: alice pays 80 for 10, bob pays 80 for 10; seller gets 160 +
    // 80 unsold tokens. Each refunded DEPOSIT - 80.
    ts::next_tx(&mut sc, seller);
    {
        let proceeds = ts::take_from_address<Coin<SUI>>(&sc, seller);
        assert!(coin::value(&proceeds) == 160, 1);
        coin::burn_for_testing(proceeds);
        let unsold = ts::take_from_address<Coin<TOKEN>>(&sc, seller);
        assert!(coin::value(&unsold) == 80, 2);
        coin::burn_for_testing(unsold);

        let a_tok = ts::take_from_address<Coin<TOKEN>>(&sc, alice);
        assert!(coin::value(&a_tok) == 10, 3);
        coin::burn_for_testing(a_tok);
        let a_ref = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&a_ref) == DEPOSIT - 80, 4);
        coin::burn_for_testing(a_ref);

        let b_tok = ts::take_from_address<Coin<TOKEN>>(&sc, bob);
        assert!(coin::value(&b_tok) == 10, 5);
        coin::burn_for_testing(b_tok);
        let b_ref = ts::take_from_address<Coin<SUI>>(&sc, bob);
        assert!(coin::value(&b_ref) == DEPOSIT - 80, 6);
        coin::burn_for_testing(b_ref);
    };

    ts::end(sc);
}

#[test]
fun exactly_filled() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;
    let bob = @0xb0b;

    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);
    // alice: 60 @ 20; bob: 40 @ 15. Demand 100 == supply 100, clears at 15.
    bid(&mut sc, alice, b"blobA", commit_of(20, 60, b"na"));
    bid(&mut sc, bob, b"blobB", commit_of(15, 40, b"nb"));

    ts::next_tx(&mut sc, seller);
    {
        let mut sale = ts::take_shared<Sale<TOKEN>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_launch::close(&mut sale, &clk);
        veil_launch::settle(
            &mut sale,
            vector[20, 15],
            vector[60, 40],
            vector[b"na", b"nb"],
            ctx,
        );
        assert!(veil_launch::supply_remaining(&sale) == 0, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(sale);
    };

    // clearing 15: alice pays 900 for 60, bob pays 600 for 40; seller gets 1500, no
    // unsold tokens.
    ts::next_tx(&mut sc, seller);
    {
        let proceeds = ts::take_from_address<Coin<SUI>>(&sc, seller);
        assert!(coin::value(&proceeds) == 1_500, 1);
        coin::burn_for_testing(proceeds);
        assert!(!ts::has_most_recent_for_address<Coin<TOKEN>>(seller), 2);

        let a_tok = ts::take_from_address<Coin<TOKEN>>(&sc, alice);
        assert!(coin::value(&a_tok) == 60, 3);
        coin::burn_for_testing(a_tok);
        let a_ref = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&a_ref) == DEPOSIT - 900, 4);
        coin::burn_for_testing(a_ref);

        let b_tok = ts::take_from_address<Coin<TOKEN>>(&sc, bob);
        assert!(coin::value(&b_tok) == 40, 5);
        coin::burn_for_testing(b_tok);
        let b_ref = ts::take_from_address<Coin<SUI>>(&sc, bob);
        assert!(coin::value(&b_ref) == DEPOSIT - 600, 6);
        coin::burn_for_testing(b_ref);
    };

    ts::end(sc);
}

#[test]
fun oversubscribed_prorata_at_margin() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;
    let bob = @0xb0b;
    let carol = @0xca401;

    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);
    // alice 60 @ 20 fills first. bob and carol each 60 @ 10 split the remaining 40
    // pro-rata: floor(60*40/120) = 20 each. Clears at 10.
    bid(&mut sc, alice, b"blobA", commit_of(20, 60, b"na"));
    bid(&mut sc, bob, b"blobB", commit_of(10, 60, b"nb"));
    bid(&mut sc, carol, b"blobC", commit_of(10, 60, b"nc"));

    ts::next_tx(&mut sc, seller);
    {
        let mut sale = ts::take_shared<Sale<TOKEN>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_launch::close(&mut sale, &clk);
        veil_launch::settle(
            &mut sale,
            vector[20, 10, 10],
            vector[60, 60, 60],
            vector[b"na", b"nb", b"nc"],
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(sale);
    };

    // alice gets 60 @ 10 = 600; bob and carol each 20 @ 10 = 200. Seller gets 1000,
    // sold 100 so no unsold tokens.
    ts::next_tx(&mut sc, seller);
    {
        let proceeds = ts::take_from_address<Coin<SUI>>(&sc, seller);
        assert!(coin::value(&proceeds) == 1_000, 1);
        coin::burn_for_testing(proceeds);
        assert!(!ts::has_most_recent_for_address<Coin<TOKEN>>(seller), 2);

        let a_tok = ts::take_from_address<Coin<TOKEN>>(&sc, alice);
        assert!(coin::value(&a_tok) == 60, 3);
        coin::burn_for_testing(a_tok);
        let a_ref = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&a_ref) == DEPOSIT - 600, 4);
        coin::burn_for_testing(a_ref);

        let b_tok = ts::take_from_address<Coin<TOKEN>>(&sc, bob);
        assert!(coin::value(&b_tok) == 20, 5);
        coin::burn_for_testing(b_tok);
        let b_ref = ts::take_from_address<Coin<SUI>>(&sc, bob);
        assert!(coin::value(&b_ref) == DEPOSIT - 200, 6);
        coin::burn_for_testing(b_ref);

        let c_tok = ts::take_from_address<Coin<TOKEN>>(&sc, carol);
        assert!(coin::value(&c_tok) == 20, 7);
        coin::burn_for_testing(c_tok);
        let c_ref = ts::take_from_address<Coin<SUI>>(&sc, carol);
        assert!(coin::value(&c_ref) == DEPOSIT - 200, 8);
        coin::burn_for_testing(c_ref);
    };

    ts::end(sc);
}

#[test]
fun chain_hides_amounts_until_settle() {
    // Anti-snipe: a bot watching the chain sees only {deposit, commitment, blobId}.
    // There is no accessor exposing price or quantity, so it cannot outbid before the
    // reveal. We assert the surface and that two different bids of equal deposit are
    // indistinguishable by anything but their opaque commitment.
    let seller = @0x5e11e7;
    let alice = @0xa11ce;
    let bob = @0xb0b;

    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);
    bid(&mut sc, alice, b"blobA", commit_of(12, 10, b"na"));
    bid(&mut sc, bob, b"blobB", commit_of(999, 50, b"nb"));

    ts::next_tx(&mut sc, seller);
    {
        let sale = ts::take_shared<Sale<TOKEN>>(&sc);
        assert!(veil_launch::bid_count(&sale) == 2, 0);
        // every bid escrowed the same deposit regardless of its hidden size
        assert!(veil_launch::deposit(&sale) == DEPOSIT, 1);
        assert!(veil_launch::bidder(&sale, 0) == alice, 2);
        assert!(veil_launch::bidder(&sale, 1) == bob, 3);
        assert!(veil_launch::bid_blob_id(&sale, 1) == b"blobB", 4);
        // the only on-chain trace of a bid's value is its preimage-resistant hash
        assert!(veil_launch::bid_commitment(&sale, 0) == commit_of(12, 10, b"na"), 5);
        assert!(veil_launch::bid_commitment(&sale, 1) == commit_of(999, 50, b"nb"), 6);
        // commitments differ but reveal nothing about the ordering of the bids
        assert!(
            veil_launch::bid_commitment(&sale, 0) != veil_launch::bid_commitment(&sale, 1),
            7,
        );
        ts::return_shared(sale);
    };

    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = veil_launch::EBadCommitment)]
fun settle_rejects_forged_reveal() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;

    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);
    bid(&mut sc, alice, b"blobA", commit_of(12, 10, b"na"));

    ts::next_tx(&mut sc, seller);
    {
        let mut sale = ts::take_shared<Sale<TOKEN>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_launch::close(&mut sale, &clk);
        // keeper tries to inflate alice's quantity to 90 — commitment won't open
        veil_launch::settle(&mut sale, vector[12], vector[90], vector[b"na"], ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(sale);
    };

    ts::end(sc);
}

#[test]
fun no_bids_returns_supply_to_seller() {
    let seller = @0x5e11e7;
    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);

    ts::next_tx(&mut sc, seller);
    {
        let mut sale = ts::take_shared<Sale<TOKEN>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_launch::close(&mut sale, &clk);
        veil_launch::settle(&mut sale, vector[], vector[], vector[], ctx);
        assert!(veil_launch::state(&sale) == STATE_SETTLED, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(sale);
    };

    ts::next_tx(&mut sc, seller);
    {
        let unsold = ts::take_from_address<Coin<TOKEN>>(&sc, seller);
        assert!(coin::value(&unsold) == 100, 1);
        coin::burn_for_testing(unsold);
    };

    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = veil_launch::EBidAboveDeposit)]
fun settle_rejects_bid_over_deposit() {
    let seller = @0x5e11e7;
    let alice = @0xa11ce;

    let mut sc = ts::begin(seller);
    open_sale(&mut sc, 100);
    // price*qty = 2_000_000 > DEPOSIT (1_000_000): can't be afforded by the escrow.
    bid(&mut sc, alice, b"blobA", commit_of(20_000, 100, b"na"));

    ts::next_tx(&mut sc, seller);
    {
        let mut sale = ts::take_shared<Sale<TOKEN>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_launch::close(&mut sale, &clk);
        veil_launch::settle(&mut sale, vector[20_000], vector[100], vector[b"na"], ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(sale);
    };

    ts::end(sc);
}
