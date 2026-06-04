/// Sealed-quote RFQ dark pool. A maker offers a fixed quantity of asset T to
/// sell and sets a hidden reserve price. Dealers submit sealed quotes escrowing
/// a uniform deposit. After close, every quote is revealed and verified; the
/// highest quote at or above the reserve wins, pays the maker, and receives the
/// asset. If the reserve is not met the maker keeps the asset and all dealers
/// are refunded. Nothing on-chain exposes the reserve or any quote price before
/// settlement — the reserve is stored only as a hash commitment.
module veil::veil_otc;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use veil::settlement;

const STATE_QUOTING: u8 = 0;
const STATE_REVEALING: u8 = 1;
const STATE_SETTLED: u8 = 2;

const EWrongState: u64 = 1;
const EQuotingClosed: u64 = 2;
const EQuotingStillOpen: u64 = 3;
const EBadCloseTime: u64 = 4;
const EWrongDeposit: u64 = 5;
const ERevealMismatch: u64 = 6;
const EQuoteAboveDeposit: u64 = 7;
const EBadCommitment: u64 = 8;

public struct Quote has store {
    quoter: address,
    deposit: Balance<SUI>,
    blob_id: vector<u8>,
    // sha2_256(bcs(price) || nonce); the reveal at settlement must match this.
    commitment: vector<u8>,
}

/// The reserve is stored as sha2_256(bcs(reserve) || nonce) so it cannot be
/// read from chain state before settle. The maker reveals the preimage in settle.
public struct Rfq<phantom T: store> has key {
    id: UID,
    maker: address,
    asset: Option<Coin<T>>,
    // sha2_256(bcs(reserve) || reserve_nonce)
    reserve_commitment: vector<u8>,
    state: u8,
    close_ms: u64,
    deposit: u64,
    quotes: vector<Quote>,
    reserve_blob_id: vector<u8>,
    archive_blob_id: Option<vector<u8>>,
}

public struct RfqCreated has copy, drop {
    rfq: ID,
    maker: address,
    close_ms: u64,
    deposit: u64,
}

public struct QuoteSubmitted has copy, drop {
    rfq: ID,
    quoter: address,
}

public struct RfqSettled has copy, drop {
    rfq: ID,
    // maker address when no winner (reserve not met)
    winner: address,
    price: u64,
    quote_count: u64,
    reserve_met: bool,
}

public struct ArchiveLinked has copy, drop {
    rfq: ID,
    blob_id: vector<u8>,
}

/// Build an Rfq without sharing it. `reserve` and `reserve_nonce` are hashed
/// together so the true floor price cannot be read from chain state.
public fun new<T: store>(
    asset: Coin<T>,
    reserve_commitment: vector<u8>,
    reserve_blob_id: vector<u8>,
    close_ms: u64,
    deposit: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Rfq<T> {
    assert!(close_ms > clock.timestamp_ms(), EBadCloseTime);
    let rfq = Rfq {
        id: object::new(ctx),
        maker: ctx.sender(),
        asset: option::some(asset),
        reserve_commitment,
        state: STATE_QUOTING,
        close_ms,
        deposit,
        quotes: vector[],
        reserve_blob_id,
        archive_blob_id: option::none(),
    };
    event::emit(RfqCreated {
        rfq: object::id(&rfq),
        maker: rfq.maker,
        close_ms,
        deposit,
    });
    rfq
}

/// Create and share an Rfq in one call.
public fun create<T: store>(
    asset: Coin<T>,
    reserve_commitment: vector<u8>,
    reserve_blob_id: vector<u8>,
    close_ms: u64,
    deposit: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::share_object(new(asset, reserve_commitment, reserve_blob_id, close_ms, deposit, clock, ctx));
}

/// Submit a sealed quote: escrow exactly the required deposit and record the
/// commitment + Walrus blob id. The quoted price stays hidden in the encrypted blob.
public fun submit_quote<T: store>(
    rfq: &mut Rfq<T>,
    deposit: Coin<SUI>,
    blob_id: vector<u8>,
    commitment: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(rfq.state == STATE_QUOTING, EWrongState);
    assert!(clock.timestamp_ms() < rfq.close_ms, EQuotingClosed);
    assert!(coin::value(&deposit) == rfq.deposit, EWrongDeposit);

    let quoter = ctx.sender();
    vector::push_back(&mut rfq.quotes, Quote {
        quoter,
        deposit: coin::into_balance(deposit),
        blob_id,
        commitment,
    });
    event::emit(QuoteSubmitted { rfq: object::id(rfq), quoter });
}

public fun close<T: store>(rfq: &mut Rfq<T>, clock: &Clock) {
    assert!(rfq.state == STATE_QUOTING, EWrongState);
    assert!(clock.timestamp_ms() >= rfq.close_ms, EQuotingStillOpen);
    rfq.state = STATE_REVEALING;
}

/// Settle a closed RFQ. `prices[i]`/`nonces[i]` must open quote `i`'s
/// commitment. `reserve` and `reserve_nonce` must open the maker's reserve
/// commitment. The highest quote at or above `reserve` wins first-price; if the
/// reserve is not met the asset returns to the maker and all deposits refund.
public fun settle<T: store>(
    rfq: &mut Rfq<T>,
    prices: vector<u64>,
    nonces: vector<vector<u8>>,
    reserve: u64,
    reserve_nonce: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(rfq.state == STATE_REVEALING, EWrongState);
    let n = vector::length(&rfq.quotes);
    assert!(vector::length(&prices) == n && vector::length(&nonces) == n, ERevealMismatch);

    // Verify the reserve commitment before touching anything else.
    let mut reserve_preimage = std::bcs::to_bytes(&reserve);
    vector::append(&mut reserve_preimage, reserve_nonce);
    assert!(
        std::hash::sha2_256(reserve_preimage) == rfq.reserve_commitment,
        EBadCommitment,
    );

    let rfq_id = object::id(rfq);

    if (n == 0) {
        let asset = option::extract(&mut rfq.asset);
        transfer::public_transfer(asset, rfq.maker);
        rfq.state = STATE_SETTLED;
        event::emit(RfqSettled {
            rfq: rfq_id,
            winner: rfq.maker,
            price: 0,
            quote_count: 0,
            reserve_met: false,
        });
        return
    };

    // Open every quote commitment before touching funds.
    let mut i = 0;
    while (i < n) {
        let price = *vector::borrow(&prices, i);
        assert!(price <= rfq.deposit, EQuoteAboveDeposit);
        let mut preimage = std::bcs::to_bytes(&price);
        vector::append(&mut preimage, *vector::borrow(&nonces, i));
        assert!(
            std::hash::sha2_256(preimage) == vector::borrow(&rfq.quotes, i).commitment,
            EBadCommitment,
        );
        i = i + 1;
    };

    // Highest quote wins (first-price = highest index at tie → earliest bid wins).
    let (winner_index, winning_price) = settlement::clear(&prices, settlement::first_price());
    let reserve_met = winning_price >= reserve;

    let maker = rfq.maker;
    let mut k = n;
    if (reserve_met) {
        let winner = vector::borrow(&rfq.quotes, winner_index).quoter;
        while (k > 0) {
            k = k - 1;
            let Quote { quoter, deposit, blob_id: _, commitment: _ } = vector::pop_back(&mut rfq.quotes);
            if (k == winner_index) {
                let mut funds = deposit;
                let payment = balance::split(&mut funds, winning_price);
                send_or_destroy(payment, maker, ctx);
                send_or_destroy(funds, quoter, ctx);
            } else {
                send_or_destroy(deposit, quoter, ctx);
            };
        };
        let asset = option::extract(&mut rfq.asset);
        transfer::public_transfer(asset, winner);
        rfq.state = STATE_SETTLED;
        event::emit(RfqSettled {
            rfq: rfq_id,
            winner,
            price: winning_price,
            quote_count: n,
            reserve_met: true,
        });
    } else {
        // Reserve not met: refund all dealers and return asset to maker.
        while (k > 0) {
            k = k - 1;
            let Quote { quoter, deposit, blob_id: _, commitment: _ } = vector::pop_back(&mut rfq.quotes);
            send_or_destroy(deposit, quoter, ctx);
        };
        let asset = option::extract(&mut rfq.asset);
        transfer::public_transfer(asset, maker);
        rfq.state = STATE_SETTLED;
        event::emit(RfqSettled {
            rfq: rfq_id,
            winner: maker,
            price: 0,
            quote_count: n,
            reserve_met: false,
        });
    };
}

fun send_or_destroy(funds: Balance<SUI>, to: address, ctx: &mut TxContext) {
    if (balance::value(&funds) > 0) {
        transfer::public_transfer(coin::from_balance(funds, ctx), to);
    } else {
        balance::destroy_zero(funds);
    };
}

/// Allows the keeper to attach the Walrus blob ID containing the settlement archive.
/// This acts as a decentralized audit trail pointing back to the encrypted inputs and outcomes.
public fun add_archive<T: store>(rfq: &mut Rfq<T>, blob_id: vector<u8>) {
    assert!(rfq.state == STATE_SETTLED, EWrongState);
    assert!(option::is_none(&rfq.archive_blob_id), EWrongState); // can only be set once
    option::fill(&mut rfq.archive_blob_id, blob_id);
    event::emit(ArchiveLinked { rfq: object::id(rfq), blob_id });
}

public fun state<T: store>(rfq: &Rfq<T>): u8 { rfq.state }

public fun quote_count<T: store>(rfq: &Rfq<T>): u64 {
    vector::length(&rfq.quotes)
}

public fun close_ms<T: store>(rfq: &Rfq<T>): u64 { rfq.close_ms }

public fun deposit<T: store>(rfq: &Rfq<T>): u64 { rfq.deposit }

/// Returns the reserve commitment hash — the true reserve stays hidden until settle.
public fun reserve<T: store>(rfq: &Rfq<T>): vector<u8> { rfq.reserve_commitment }

public fun quoter<T: store>(rfq: &Rfq<T>, index: u64): address {
    vector::borrow(&rfq.quotes, index).quoter
}

public fun quote_blob_id<T: store>(rfq: &Rfq<T>, index: u64): vector<u8> {
    vector::borrow(&rfq.quotes, index).blob_id
}

public fun quote_commitment<T: store>(rfq: &Rfq<T>, index: u64): vector<u8> {
    vector::borrow(&rfq.quotes, index).commitment
}
