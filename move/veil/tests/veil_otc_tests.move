#[test_only]
module veil::veil_otc_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts};
use veil::veil_otc::{Self, Rfq};

const STATE_SETTLED: u8 = 2;
const DEPOSIT: u64 = 2_000;

/// A minimal fungible asset used as the sold token.
public struct Token has store {}

fun make_token(ctx: &mut TxContext): Coin<Token> {
    coin::mint_for_testing<Token>(1, ctx)
}

fun deposit_coin(scenario: &mut ts::Scenario): Coin<SUI> {
    coin::mint_for_testing<SUI>(DEPOSIT, ts::ctx(scenario))
}

// Commitment preimage: bcs(price) || nonce — must match the on-chain computation.
fun commit_of(price: u64, nonce: vector<u8>): vector<u8> {
    let mut preimage = std::bcs::to_bytes(&price);
    vector::append(&mut preimage, nonce);
    std::hash::sha2_256(preimage)
}

fun reserve_commit(reserve: u64, nonce: vector<u8>): vector<u8> {
    let mut preimage = std::bcs::to_bytes(&reserve);
    vector::append(&mut preimage, nonce);
    std::hash::sha2_256(preimage)
}

// Best-of-three: Alice 400, Bob 700, Carol 550 — Bob wins at 700.
#[test]
fun best_of_three_wins_at_its_price() {
    let maker = @0xface;
    let alice = @0xa11ce;
    let bob = @0xb0b;
    let carol = @0xca701;

    let reserve_val: u64 = 300;
    let reserve_nonce = b"rnonce";

    let mut sc = ts::begin(maker);

    // Maker opens the RFQ with a hidden reserve.
    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let token = make_token(ctx);
        veil_otc::create<Token>(
            token,
            reserve_commit(reserve_val, reserve_nonce),
            b"reserveBlobId",
            5_000,
            DEPOSIT,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
    };

    // Alice quotes 400.
    ts::next_tx(&mut sc, alice);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let dep = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        veil_otc::submit_quote(&mut rfq, dep, b"blobA", commit_of(400, b"na"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    // Bob quotes 700.
    ts::next_tx(&mut sc, bob);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let dep = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        veil_otc::submit_quote(&mut rfq, dep, b"blobB", commit_of(700, b"nb"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    // Carol quotes 550.
    ts::next_tx(&mut sc, carol);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let dep = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        veil_otc::submit_quote(&mut rfq, dep, b"blobC", commit_of(550, b"nc"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    // Close + settle. On-chain state before settle only exposes deposit/commitment/blobId.
    ts::next_tx(&mut sc, maker);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        assert!(veil_otc::quote_count(&rfq) == 3, 10);
        assert!(veil_otc::deposit(&rfq) == DEPOSIT, 11);
        assert!(veil_otc::quoter(&rfq, 1) == bob, 12);
        assert!(veil_otc::quote_blob_id(&rfq, 1) == b"blobB", 13);
        assert!(veil_otc::quote_commitment(&rfq, 1) == commit_of(700, b"nb"), 14);
        // reserve accessor returns the commitment hash, not the raw value
        assert!(veil_otc::reserve(&rfq) == reserve_commit(reserve_val, reserve_nonce), 15);

        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_otc::close(&mut rfq, &clk);
        veil_otc::settle(
            &mut rfq,
            vector[400, 700, 550],
            vector[b"na", b"nb", b"nc"],
            reserve_val,
            reserve_nonce,
            ctx,
        );
        assert!(veil_otc::state(&rfq) == STATE_SETTLED, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    // Bob wins: maker gets 700, Bob refunded 2000-700=1300 and holds the token.
    ts::next_tx(&mut sc, maker);
    {
        let payment = ts::take_from_address<Coin<SUI>>(&sc, maker);
        assert!(coin::value(&payment) == 700, 1);
        coin::burn_for_testing(payment);

        let alice_refund = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&alice_refund) == DEPOSIT, 2);
        coin::burn_for_testing(alice_refund);

        let carol_refund = ts::take_from_address<Coin<SUI>>(&sc, carol);
        assert!(coin::value(&carol_refund) == DEPOSIT, 3);
        coin::burn_for_testing(carol_refund);

        let bob_refund = ts::take_from_address<Coin<SUI>>(&sc, bob);
        assert!(coin::value(&bob_refund) == DEPOSIT - 700, 4);
        coin::burn_for_testing(bob_refund);

        let token = ts::take_from_address<Coin<Token>>(&sc, bob);
        coin::burn_for_testing(token);
    };

    ts::end(sc);
}

// Reserve not met: all quotes below the floor → asset back to maker, all refunded.
#[test]
fun reserve_not_met_returns_asset_and_refunds_all() {
    let maker = @0xface;
    let alice = @0xa11ce;
    let bob = @0xb0b;

    let reserve_val: u64 = 1_500;
    let reserve_nonce = b"rnonce2";

    let mut sc = ts::begin(maker);

    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let token = make_token(ctx);
        veil_otc::create<Token>(
            token,
            reserve_commit(reserve_val, reserve_nonce),
            b"reserveBlobId",
            5_000,
            DEPOSIT,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
    };

    ts::next_tx(&mut sc, alice);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let dep = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        veil_otc::submit_quote(&mut rfq, dep, b"blobA", commit_of(400, b"na2"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    ts::next_tx(&mut sc, bob);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let dep = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        veil_otc::submit_quote(&mut rfq, dep, b"blobB", commit_of(700, b"nb2"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    ts::next_tx(&mut sc, maker);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_otc::close(&mut rfq, &clk);
        veil_otc::settle(
            &mut rfq,
            vector[400, 700],
            vector[b"na2", b"nb2"],
            reserve_val,
            reserve_nonce,
            ctx,
        );
        assert!(veil_otc::state(&rfq) == STATE_SETTLED, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    ts::next_tx(&mut sc, maker);
    {
        // Maker gets their asset back (no SUI payment when reserve not met).
        let token = ts::take_from_address<Coin<Token>>(&sc, maker);
        coin::burn_for_testing(token);

        let alice_refund = ts::take_from_address<Coin<SUI>>(&sc, alice);
        assert!(coin::value(&alice_refund) == DEPOSIT, 1);
        coin::burn_for_testing(alice_refund);

        let bob_refund = ts::take_from_address<Coin<SUI>>(&sc, bob);
        assert!(coin::value(&bob_refund) == DEPOSIT, 2);
        coin::burn_for_testing(bob_refund);
    };

    ts::end(sc);
}

// A forged reveal (wrong price, right nonce) must abort.
#[test]
#[expected_failure(abort_code = veil_otc::EBadCommitment)]
fun forged_reveal_aborts() {
    let maker = @0xface;
    let alice = @0xa11ce;

    let reserve_val: u64 = 200;
    let reserve_nonce = b"rn3";

    let mut sc = ts::begin(maker);

    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let token = make_token(ctx);
        veil_otc::create<Token>(
            token,
            reserve_commit(reserve_val, reserve_nonce),
            b"reserveBlobId",
            5_000,
            DEPOSIT,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
    };

    ts::next_tx(&mut sc, alice);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let dep = deposit_coin(&mut sc);
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        veil_otc::submit_quote(&mut rfq, dep, b"blobA", commit_of(300, b"na3"), &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    ts::next_tx(&mut sc, maker);
    {
        let mut rfq = ts::take_shared<Rfq<Token>>(&sc);
        let ctx = ts::ctx(&mut sc);
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);
        veil_otc::close(&mut rfq, &clk);
        // Keeper inflates Alice's quote to 1900 — commitment won't open.
        veil_otc::settle(
            &mut rfq,
            vector[1900],
            vector[b"na3"],
            reserve_val,
            reserve_nonce,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(rfq);
    };

    ts::end(sc);
}

// The reserve commitment is the only thing readable before settle; the raw
// reserve value is not exposed by the public API.
#[test]
fun reserve_stays_hidden_until_settle() {
    let maker = @0xface;

    let reserve_val: u64 = 999;
    let reserve_nonce = b"rn4";

    let mut sc = ts::begin(maker);

    {
        let ctx = ts::ctx(&mut sc);
        let clk = clock::create_for_testing(ctx);
        let token = make_token(ctx);
        veil_otc::create<Token>(
            token,
            reserve_commit(reserve_val, reserve_nonce),
            b"reserveBlobId",
            5_000,
            DEPOSIT,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
    };

    ts::next_tx(&mut sc, maker);
    {
        let rfq = ts::take_shared<Rfq<Token>>(&sc);

        // The accessor returns the commitment hash, not the plain reserve.
        let exposed = veil_otc::reserve(&rfq);
        let expected_commitment = reserve_commit(reserve_val, reserve_nonce);
        assert!(exposed == expected_commitment, 0);

        // A different reserve would produce a different hash — confirming the
        // commitment binds the value.
        let wrong_commitment = reserve_commit(reserve_val + 1, reserve_nonce);
        assert!(exposed != wrong_commitment, 1);

        ts::return_shared(rfq);
    };

    ts::end(sc);
}
