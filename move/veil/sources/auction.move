/// Core sealed-bid auction primitive.
///
/// An auction sells one item (`T`) and accepts SUI bids, each escrowed on
/// submission. After `close_ms` the auction is closed and then settled: the
/// winner is chosen by `settlement::clear`, the seller is paid the clearing
/// price, losing bids are refunded, and the item goes to the winner.
///
/// In M1 a bid's amount equals its escrowed coin value (public). `blob_id` and
/// `commitment` are carried now but unused; M2 stores the bid's Walrus blob and
/// M3 hides the amount behind a Seal time-lock, revealing it only at settlement.
module veil::auction;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use veil::settlement;

// --- lifecycle states ---
const STATE_BIDDING: u8 = 0;
const STATE_REVEALING: u8 = 1;
const STATE_SETTLED: u8 = 2;

// --- errors ---
const EWrongState: u64 = 1;
const EBiddingClosed: u64 = 2;
const EBiddingStillOpen: u64 = 3;
const EZeroBid: u64 = 4;
const EBadCloseTime: u64 = 5;

public struct Bid has store {
    bidder: address,
    amount: u64,
    escrow: Balance<SUI>,
    blob_id: vector<u8>,
    commitment: vector<u8>,
}

public struct Auction<T: key + store> has key {
    id: UID,
    seller: address,
    item: Option<T>,
    pricing: u8,
    state: u8,
    close_ms: u64,
    bids: vector<Bid>,
}

// --- events ---
public struct AuctionCreated has copy, drop {
    auction: ID,
    seller: address,
    close_ms: u64,
    pricing: u8,
}

public struct BidSubmitted has copy, drop {
    auction: ID,
    bidder: address,
    amount: u64,
}

public struct AuctionSettled has copy, drop {
    auction: ID,
    winner: address,
    price: u64,
    bid_count: u64,
}

/// Construct an auction (used directly by tests/composition). Aborts if the
/// close time is not in the future.
public fun new<T: key + store>(
    item: T,
    pricing: u8,
    close_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Auction<T> {
    assert!(close_ms > clock.timestamp_ms(), EBadCloseTime);
    let auction = Auction {
        id: object::new(ctx),
        seller: ctx.sender(),
        item: option::some(item),
        pricing,
        state: STATE_BIDDING,
        close_ms,
        bids: vector[],
    };
    event::emit(AuctionCreated {
        auction: object::id(&auction),
        seller: auction.seller,
        close_ms,
        pricing,
    });
    auction
}

/// Create and share an auction in one call.
public fun create<T: key + store>(
    item: T,
    pricing: u8,
    close_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::share_object(new(item, pricing, close_ms, clock, ctx));
}

/// Submit a bid. The full `payment` is escrowed; its value is the bid amount.
public fun submit_bid<T: key + store>(
    auction: &mut Auction<T>,
    payment: Coin<SUI>,
    blob_id: vector<u8>,
    commitment: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(auction.state == STATE_BIDDING, EWrongState);
    assert!(clock.timestamp_ms() < auction.close_ms, EBiddingClosed);
    let amount = coin::value(&payment);
    assert!(amount > 0, EZeroBid);

    let bidder = ctx.sender();
    vector::push_back(&mut auction.bids, Bid {
        bidder,
        amount,
        escrow: coin::into_balance(payment),
        blob_id,
        commitment,
    });
    event::emit(BidSubmitted { auction: object::id(auction), bidder, amount });
}

/// Close bidding once the close time has passed.
public fun close<T: key + store>(auction: &mut Auction<T>, clock: &Clock) {
    assert!(auction.state == STATE_BIDDING, EWrongState);
    assert!(clock.timestamp_ms() >= auction.close_ms, EBiddingStillOpen);
    auction.state = STATE_REVEALING;
}

/// Settle a closed auction: pay the seller the clearing price, refund losers,
/// and transfer the item to the winner. With no bids, the item returns to the
/// seller.
public fun settle<T: key + store>(auction: &mut Auction<T>, ctx: &mut TxContext) {
    assert!(auction.state == STATE_REVEALING, EWrongState);
    let auction_id = object::id(auction);
    let n = vector::length(&auction.bids);

    if (n == 0) {
        let item = option::extract(&mut auction.item);
        transfer::public_transfer(item, auction.seller);
        auction.state = STATE_SETTLED;
        event::emit(AuctionSettled {
            auction: auction_id,
            winner: auction.seller,
            price: 0,
            bid_count: 0,
        });
        return
    };

    let mut amounts = vector<u64>[];
    let mut i = 0;
    while (i < n) {
        vector::push_back(&mut amounts, vector::borrow(&auction.bids, i).amount);
        i = i + 1;
    };
    let (winner_index, price) = settlement::clear(&amounts, auction.pricing);
    let winner = vector::borrow(&auction.bids, winner_index).bidder;

    // Distribute escrows. Pop from the back so the live index equals `k`.
    let mut k = n;
    while (k > 0) {
        k = k - 1;
        let Bid { bidder, amount: _, escrow, blob_id: _, commitment: _ } =
            vector::pop_back(&mut auction.bids);
        if (k == winner_index) {
            let mut funds = escrow;
            let payment = balance::split(&mut funds, price);
            send_or_destroy(payment, auction.seller, ctx); // clearing price to seller
            send_or_destroy(funds, bidder, ctx); // overpayment back to winner
        } else {
            send_or_destroy(escrow, bidder, ctx); // full refund to loser
        };
    };

    let item = option::extract(&mut auction.item);
    transfer::public_transfer(item, winner);
    auction.state = STATE_SETTLED;
    event::emit(AuctionSettled { auction: auction_id, winner, price, bid_count: n });
}

/// Transfer a balance as a coin, or destroy it if zero (avoids zero-value coin litter).
fun send_or_destroy(funds: Balance<SUI>, to: address, ctx: &mut TxContext) {
    if (balance::value(&funds) > 0) {
        transfer::public_transfer(coin::from_balance(funds, ctx), to);
    } else {
        balance::destroy_zero(funds);
    };
}

// --- read-only accessors (handy for the frontend / tests) ---
public fun state<T: key + store>(auction: &Auction<T>): u8 { auction.state }

public fun bid_count<T: key + store>(auction: &Auction<T>): u64 {
    vector::length(&auction.bids)
}

public fun close_ms<T: key + store>(auction: &Auction<T>): u64 { auction.close_ms }
