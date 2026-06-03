#[test_only]
module veil::settlement_tests;

use veil::settlement;

#[test]
fun first_price_picks_max() {
    let amounts = vector[10u64, 30, 20];
    let (i, price) = settlement::clear(&amounts, settlement::first_price());
    assert!(i == 1, 0);
    assert!(price == 30, 1);
}

#[test]
fun second_price_pays_runner_up() {
    let amounts = vector[10u64, 30, 20];
    let (i, price) = settlement::clear(&amounts, settlement::second_price());
    assert!(i == 1, 0);
    assert!(price == 20, 1);
}

#[test]
fun ties_go_to_earliest_bidder() {
    let amounts = vector[30u64, 30, 10];
    let (i, price) = settlement::clear(&amounts, settlement::first_price());
    assert!(i == 0, 0);
    assert!(price == 30, 1);
}

#[test]
fun single_bid_second_price_clears_at_zero() {
    let amounts = vector[42u64];
    let (i, price) = settlement::clear(&amounts, settlement::second_price());
    assert!(i == 0, 0);
    assert!(price == 0, 1);
}

#[test]
#[expected_failure]
fun empty_bids_aborts() {
    let amounts = vector<u64>[];
    let (_i, _price) = settlement::clear(&amounts, settlement::first_price());
}

fun sum(v: &vector<u64>): u64 {
    let mut s = 0;
    let mut i = 0;
    while (i < vector::length(v)) { s = s + *vector::borrow(v, i); i = i + 1; };
    s
}

#[test]
fun uniform_undersubscribed_fills_all_at_lowest() {
    // demand 30 < supply 100: everyone wins, price is the lowest bid.
    let prices = vector[10u64, 8, 12];
    let qtys = vector[10u64, 10, 10];
    let (price, alloc) = settlement::uniform_clear(&prices, &qtys, 100);
    assert!(price == 8, 0);
    assert!(alloc == vector[10u64, 10, 10], 1);
}

#[test]
fun uniform_exactly_filled() {
    // demand 100 == supply 100: full fill, clearing at the marginal bid's price.
    let prices = vector[10u64, 7, 9];
    let qtys = vector[40u64, 30, 30];
    let (price, alloc) = settlement::uniform_clear(&prices, &qtys, 100);
    assert!(price == 7, 0);
    assert!(alloc == vector[40u64, 30, 30], 1);
    assert!(sum(&alloc) == 100, 2);
}

#[test]
fun uniform_oversubscribed_prorata_at_margin() {
    // supply 100. Bid 0 @20 fills 60. Bids 1 and 2 both @10 want 60+60=120 for the
    // remaining 40, so each gets floor(60*40/120)=20; bid 3 @5 is below clearing.
    let prices = vector[20u64, 10, 10, 5];
    let qtys = vector[60u64, 60, 60, 50];
    let (price, alloc) = settlement::uniform_clear(&prices, &qtys, 100);
    assert!(price == 10, 0);
    assert!(alloc == vector[60u64, 20, 20, 0], 1);
    assert!(sum(&alloc) <= 100, 2);
}

#[test]
fun uniform_prorata_floors_within_supply() {
    // 3 equal bids want 7 each for a supply of 10: floor(7*10/21)=3 apiece, 9 sold,
    // one unit left unallocated. Allocations must never exceed supply.
    let prices = vector[5u64, 5, 5];
    let qtys = vector[7u64, 7, 7];
    let (price, alloc) = settlement::uniform_clear(&prices, &qtys, 10);
    assert!(price == 5, 0);
    assert!(alloc == vector[3u64, 3, 3], 1);
    assert!(sum(&alloc) <= 10, 2);
}

#[test]
fun uniform_empty_clears_at_zero() {
    let prices = vector<u64>[];
    let qtys = vector<u64>[];
    let (price, alloc) = settlement::uniform_clear(&prices, &qtys, 100);
    assert!(price == 0, 0);
    assert!(vector::length(&alloc) == 0, 1);
}

#[test]
fun uniform_zero_supply_allocates_nothing() {
    let prices = vector[10u64, 20];
    let qtys = vector[5u64, 5];
    let (price, alloc) = settlement::uniform_clear(&prices, &qtys, 0);
    assert!(price == 0, 0);
    assert!(alloc == vector[0u64, 0], 1);
}

#[test]
#[expected_failure(abort_code = settlement::ELengthMismatch)]
fun uniform_length_mismatch_aborts() {
    let prices = vector[10u64, 20];
    let qtys = vector[5u64];
    let (_p, _a) = settlement::uniform_clear(&prices, &qtys, 100);
}
