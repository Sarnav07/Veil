/// Sealed-bid auction. A bid escrows a fixed deposit and an on-chain commitment;
/// the amount itself lives only in the bid's Seal-encrypted Walrus blob. After the
/// close time the keeper reveals every bid and `settle` verifies each against its
/// commitment before clearing, so nothing on-chain leaks a bid until it's over.
module veil::auction;

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

public struct Bid has store {
    bidder: address,
    deposit: Balance<SUI>,
    blob_id: vector<u8>,
    // sha2_256(bcs(amount) || nonce); the reveal at settlement must match this.
    commitment: vector<u8>,
}

public struct Auction<T: key + store> has key {
    id: UID,
    seller: address,
    item: Option<T>,
    pricing: u8,
    state: u8,
    close_ms: u64,
    deposit: u64,
    bids: vector<Bid>,
}

public struct AuctionCreated has copy, drop {
    auction: ID,
    seller: address,
    close_ms: u64,
    pricing: u8,
    deposit: u64,
}

public struct BidSubmitted has copy, drop {
    auction: ID,
    bidder: address,
}

public struct AuctionSettled has copy, drop {
    auction: ID,
    winner: address,
    price: u64,
    bid_count: u64,
}

public fun new<T: key + store>(
    item: T,
    pricing: u8,
    close_ms: u64,
    deposit: u64,
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
        deposit,
        bids: vector[],
    };
    event::emit(AuctionCreated {
        auction: object::id(&auction),
        seller: auction.seller,
        close_ms,
        pricing,
        deposit,
    });
    auction
}

public fun create<T: key + store>(
    item: T,
    pricing: u8,
    close_ms: u64,
    deposit: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::share_object(new(item, pricing, close_ms, deposit, clock, ctx));
}

/// Place a sealed bid: escrow exactly the auction's deposit and record the
/// commitment + Walrus blobId. The bid amount stays hidden in the blob.
public fun submit_bid<T: key + store>(
    auction: &mut Auction<T>,
    deposit: Coin<SUI>,
    blob_id: vector<u8>,
    commitment: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(auction.state == STATE_BIDDING, EWrongState);
    assert!(clock.timestamp_ms() < auction.close_ms, EBiddingClosed);
    assert!(coin::value(&deposit) == auction.deposit, EWrongDeposit);

    let bidder = ctx.sender();
    vector::push_back(&mut auction.bids, Bid {
        bidder,
        deposit: coin::into_balance(deposit),
        blob_id,
        commitment,
    });
    event::emit(BidSubmitted { auction: object::id(auction), bidder });
}

public fun close<T: key + store>(auction: &mut Auction<T>, clock: &Clock) {
    assert!(auction.state == STATE_BIDDING, EWrongState);
    assert!(clock.timestamp_ms() >= auction.close_ms, EBiddingStillOpen);
    auction.state = STATE_REVEALING;
}

/// Settle a closed auction from the keeper's revealed bids. `amounts[i]`/`nonces[i]`
/// must open the commitment of bid `i`; the winner pays the clearing price from
/// its deposit, everyone else is fully refunded, and the item goes to the winner.
public fun settle<T: key + store>(
    auction: &mut Auction<T>,
    mut amounts: vector<u64>,
    mut nonces: vector<vector<u8>>,
    ctx: &mut TxContext,
) {
    assert!(auction.state == STATE_REVEALING, EWrongState);
    let mut n = vector::length(&auction.bids);
    assert!(vector::length(&amounts) == n && vector::length(&nonces) == n, ERevealMismatch);

    let auction_id = object::id(auction);

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

    // Open every commitment before touching funds.
    let mut i = 0;
    while (i < n) {
        let amount = *vector::borrow(&amounts, i);
        let mut preimage = std::bcs::to_bytes(&amount);
        vector::append(&mut preimage, *vector::borrow(&nonces, i));
        
        // 🚨 FIX: Zero-Cost Cheater protection via complete disqualification
        if (std::hash::sha2_256(preimage) != vector::borrow(&auction.bids, i).commitment || amount > auction.deposit) {
            vector::remove(&mut amounts, i);
            vector::remove(&mut nonces, i);
            let Bid { bidder, deposit, blob_id: _, commitment: _ } = vector::remove(&mut auction.bids, i);
            send_or_destroy(deposit, bidder, ctx);
            n = n - 1;
        } else {
            i = i + 1;
        };
    };

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

    let (winner_index, price) = settlement::clear(&amounts, auction.pricing);

    // 🚨 FIX: Zero-Cost Cheater protection. An auction must clear strictly above 0.
    if (price == 0) {
        let mut k = n;
        while (k > 0) {
            k = k - 1;
            let Bid { bidder, deposit, blob_id: _, commitment: _ } = vector::pop_back(&mut auction.bids);
            send_or_destroy(deposit, bidder, ctx);
        };
        let item = option::extract(&mut auction.item);
        transfer::public_transfer(item, auction.seller);
        auction.state = STATE_SETTLED;
        event::emit(AuctionSettled { auction: auction_id, winner: auction.seller, price: 0, bid_count: n });
        return
    };
    let winner = vector::borrow(&auction.bids, winner_index).bidder;

    let mut k = n;
    while (k > 0) {
        k = k - 1;
        let Bid { bidder, deposit, blob_id: _, commitment: _ } = vector::pop_back(&mut auction.bids);
        if (k == winner_index) {
            let mut funds = deposit;
            let payment = balance::split(&mut funds, price);
            send_or_destroy(payment, auction.seller, ctx);
            send_or_destroy(funds, bidder, ctx);
        } else {
            send_or_destroy(deposit, bidder, ctx);
        };
    };

    let item = option::extract(&mut auction.item);
    transfer::public_transfer(item, winner);
    auction.state = STATE_SETTLED;
    event::emit(AuctionSettled { auction: auction_id, winner, price, bid_count: n });
}

fun send_or_destroy(funds: Balance<SUI>, to: address, ctx: &mut TxContext) {
    if (balance::value(&funds) > 0) {
        transfer::public_transfer(coin::from_balance(funds, ctx), to);
    } else {
        balance::destroy_zero(funds);
    };
}

public fun state<T: key + store>(auction: &Auction<T>): u8 { auction.state }

public fun bid_count<T: key + store>(auction: &Auction<T>): u64 {
    vector::length(&auction.bids)
}

public fun close_ms<T: key + store>(auction: &Auction<T>): u64 { auction.close_ms }

public fun deposit<T: key + store>(auction: &Auction<T>): u64 { auction.deposit }

public fun bidder<T: key + store>(auction: &Auction<T>, index: u64): address {
    vector::borrow(&auction.bids, index).bidder
}

public fun bid_blob_id<T: key + store>(auction: &Auction<T>, index: u64): vector<u8> {
    vector::borrow(&auction.bids, index).blob_id
}

public fun bid_commitment<T: key + store>(auction: &Auction<T>, index: u64): vector<u8> {
    vector::borrow(&auction.bids, index).commitment
}
