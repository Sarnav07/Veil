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
