/// Uniform-price sealed token sale. A seller offers a fixed supply of `T`; each
/// bidder escrows a uniform SUI deposit and an on-chain commitment, with the real
/// (price, quantity) living only in the bid's Seal-encrypted Walrus blob. After the
/// close the keeper reveals every bid and `settle` verifies each against its
/// commitment, clears the whole sale at one uniform price (the lowest accepted),
/// and allocates pro-rata at the margin — so nothing on-chain leaks a bid until it's
/// over.
module veil::veil_launch;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use veil::settlement;

const STATE_BIDDING: u8 = 0;
const STATE_REVEALING: u8 = 1;
const STATE_SETTLED: u8 = 2;

const EWrongState: u64 = 1;
const EBiddingClosed: u64 = 2;
const EBiddingStillOpen: u64 = 3;
const EBadCloseTime: u64 = 4;
const EWrongDeposit: u64 = 5;
const ERevealMismatch: u64 = 6;
const EBidAboveDeposit: u64 = 7;
const EBadCommitment: u64 = 8;

public struct Bid has store {
    bidder: address,
    deposit: Balance<SUI>,
    blob_id: vector<u8>,
    // sha2_256(bcs(price) || bcs(qty) || nonce); the reveal at settlement must match.
    commitment: vector<u8>,
}

public struct Sale<phantom T: store> has key {
    id: UID,
    seller: address,
    supply: Balance<T>,
    state: u8,
    close_ms: u64,
    deposit: u64,
    bids: vector<Bid>,
    archive_blob_id: Option<vector<u8>>,
}

public struct SaleCreated has copy, drop {
    sale: ID,
    seller: address,
    close_ms: u64,
    supply: u64,
    deposit: u64,
}

public struct BidSubmitted has copy, drop {
    sale: ID,
    bidder: address,
}

public struct SaleSettled has copy, drop {
    sale: ID,
    clearing_price: u64,
    sold: u64,
    bid_count: u64,
}

public struct ArchiveLinked has copy, drop {
    sale: ID,
    blob_id: vector<u8>,
}

public fun new<T: store>(
    supply: Coin<T>,
    close_ms: u64,
    deposit: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Sale<T> {
    assert!(close_ms > clock.timestamp_ms(), EBadCloseTime);
    let sale = Sale {
        id: object::new(ctx),
        seller: ctx.sender(),
        supply: coin::into_balance(supply),
        state: STATE_BIDDING,
        close_ms,
        deposit,
        bids: vector[],
        archive_blob_id: option::none(),
    };
    event::emit(SaleCreated {
        sale: object::id(&sale),
        seller: sale.seller,
        close_ms,
        supply: balance::value(&sale.supply),
        deposit,
    });
    sale
}

public fun create<T: store>(
    supply: Coin<T>,
    close_ms: u64,
    deposit: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::share_object(new(supply, close_ms, deposit, clock, ctx));
}

/// Place a sealed bid: escrow exactly the sale's deposit and record the commitment +
/// Walrus blobId. The (price, quantity) stay hidden in the blob.
public fun submit_bid<T: store>(
    sale: &mut Sale<T>,
    deposit: Coin<SUI>,
    blob_id: vector<u8>,
    commitment: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(sale.state == STATE_BIDDING, EWrongState);
    assert!(clock.timestamp_ms() < sale.close_ms, EBiddingClosed);
    assert!(coin::value(&deposit) == sale.deposit, EWrongDeposit);

    let bidder = ctx.sender();
    vector::push_back(&mut sale.bids, Bid {
        bidder,
        deposit: coin::into_balance(deposit),
        blob_id,
        commitment,
    });
    event::emit(BidSubmitted { sale: object::id(sale), bidder });
}

public fun close<T: store>(sale: &mut Sale<T>, clock: &Clock) {
    assert!(sale.state == STATE_BIDDING, EWrongState);
    assert!(clock.timestamp_ms() >= sale.close_ms, EBiddingStillOpen);
    sale.state = STATE_REVEALING;
}

/// Settle a closed sale from the keeper's revealed bids. `prices[i]`/`quantities[i]`/
/// `nonces[i]` must open the commitment of bid `i`. The sale clears at one uniform
/// price; each winner pays `clearing_price * allocated` from its deposit, receives its
/// tokens, and is refunded the rest. Losers are fully refunded. The seller collects
/// the proceeds and any unsold supply.
public fun settle<T: store>(
    sale: &mut Sale<T>,
    prices: vector<u64>,
    quantities: vector<u64>,
    nonces: vector<vector<u8>>,
    ctx: &mut TxContext,
) {
    assert!(sale.state == STATE_REVEALING, EWrongState);
    let n = vector::length(&sale.bids);
    assert!(
        vector::length(&prices) == n
            && vector::length(&quantities) == n
            && vector::length(&nonces) == n,
        ERevealMismatch,
    );

    let sale_id = object::id(sale);

    if (n == 0) {
        settle_empty(sale, sale_id, ctx);
        return
    };

    // Open every commitment, and check each bid's max spend fits its deposit, before
    // touching any funds.
    let mut i = 0;
    while (i < n) {
        let price = *vector::borrow(&prices, i);
        let qty = *vector::borrow(&quantities, i);
        assert!((price as u128) * (qty as u128) <= (sale.deposit as u128), EBidAboveDeposit);
        let mut preimage = std::bcs::to_bytes(&price);
        vector::append(&mut preimage, std::bcs::to_bytes(&qty));
        vector::append(&mut preimage, *vector::borrow(&nonces, i));
        assert!(
            std::hash::sha2_256(preimage) == vector::borrow(&sale.bids, i).commitment,
            EBadCommitment,
        );
        i = i + 1;
    };

    let supply = balance::value(&sale.supply);
    let (clearing_price, alloc) = settlement::uniform_clear(&prices, &quantities, supply);

    // Pay out each bid in turn, draining `bids` from the back so the popped index
    // lines up with `alloc`.
    let mut proceeds = balance::zero<SUI>();
    let mut sold = 0;
    let mut k = n;
    while (k > 0) {
        k = k - 1;
        let Bid { bidder, deposit, blob_id: _, commitment: _ } = vector::pop_back(&mut sale.bids);
        let allocated = *vector::borrow(&alloc, k);
        let mut funds = deposit;
        if (allocated > 0) {
            let cost = clearing_price * allocated;
            balance::join(&mut proceeds, balance::split(&mut funds, cost));
            let tokens = coin::from_balance(balance::split(&mut sale.supply, allocated), ctx);
            transfer::public_transfer(tokens, bidder);
            sold = sold + allocated;
        };
        send_or_destroy(funds, bidder, ctx);
    };

    // Seller takes the proceeds and whatever supply went unsold.
    send_or_destroy(proceeds, sale.seller, ctx);
    let leftover = balance::withdraw_all(&mut sale.supply);
    send_or_destroy_token(leftover, sale.seller, ctx);

    sale.state = STATE_SETTLED;
    event::emit(SaleSettled { sale: sale_id, clearing_price, sold, bid_count: n });
}

fun settle_empty<T: store>(sale: &mut Sale<T>, sale_id: ID, ctx: &mut TxContext) {
    let leftover = balance::withdraw_all(&mut sale.supply);
    send_or_destroy_token(leftover, sale.seller, ctx);
    sale.state = STATE_SETTLED;
    event::emit(SaleSettled { sale: sale_id, clearing_price: 0, sold: 0, bid_count: 0 });
}

fun send_or_destroy(funds: Balance<SUI>, to: address, ctx: &mut TxContext) {
    if (balance::value(&funds) > 0) {
        transfer::public_transfer(coin::from_balance(funds, ctx), to);
    } else {
        balance::destroy_zero(funds);
    };
}

fun send_or_destroy_token<T: store>(funds: Balance<T>, to: address, ctx: &mut TxContext) {
    if (balance::value(&funds) > 0) {
        transfer::public_transfer(coin::from_balance(funds, ctx), to);
    } else {
        balance::destroy_zero(funds);
    };
}

/// Allows the keeper to attach the Walrus blob ID containing the settlement archive.
/// This acts as a decentralized audit trail pointing back to the encrypted inputs and outcomes.
public fun add_archive<T: store>(sale: &mut Sale<T>, blob_id: vector<u8>) {
    assert!(sale.state == STATE_SETTLED, EWrongState);
    assert!(option::is_none(&sale.archive_blob_id), EWrongState); // can only be set once
    option::fill(&mut sale.archive_blob_id, blob_id);
    event::emit(ArchiveLinked { sale: object::id(sale), blob_id });
}

public fun state<T: store>(sale: &Sale<T>): u8 { sale.state }

public fun bid_count<T: store>(sale: &Sale<T>): u64 {
    vector::length(&sale.bids)
}

public fun close_ms<T: store>(sale: &Sale<T>): u64 { sale.close_ms }

public fun deposit<T: store>(sale: &Sale<T>): u64 { sale.deposit }

public fun supply_remaining<T: store>(sale: &Sale<T>): u64 {
    balance::value(&sale.supply)
}

public fun bidder<T: store>(sale: &Sale<T>, index: u64): address {
    vector::borrow(&sale.bids, index).bidder
}

public fun bid_blob_id<T: store>(sale: &Sale<T>, index: u64): vector<u8> {
    vector::borrow(&sale.bids, index).blob_id
}

public fun bid_commitment<T: store>(sale: &Sale<T>, index: u64): vector<u8> {
    vector::borrow(&sale.bids, index).commitment
}
