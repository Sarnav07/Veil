/// Pure sealed-bid clearing logic, kept separate from the auction object so it
/// can be unit-tested in isolation. Operates purely on a list of bid amounts.
module veil::settlement;

/// Clearing rules.
const FIRST_PRICE: u8 = 0;
const SECOND_PRICE: u8 = 1;

const EEmptyBids: u64 = 1;
const EUnknownPricing: u64 = 2;

public fun first_price(): u8 { FIRST_PRICE }

public fun second_price(): u8 { SECOND_PRICE }

/// Returns `(winner_index, price)` for `amounts` under the given `pricing` rule.
///
/// - First-price: the winner pays their own (highest) bid.
/// - Second-price (Vickrey): the winner pays the highest *other* bid; with a
///   single bidder this clears at 0 (no reserve in v1).
/// Ties are won by the earliest (lowest-index) bid. Aborts on empty input.
public fun clear(amounts: &vector<u64>, pricing: u8): (u64, u64) {
    let n = vector::length(amounts);
    assert!(n > 0, EEmptyBids);
    assert!(pricing == FIRST_PRICE || pricing == SECOND_PRICE, EUnknownPricing);

    let mut win_i = 0;
    let mut win_v = *vector::borrow(amounts, 0);
    let mut i = 1;
    while (i < n) {
        let v = *vector::borrow(amounts, i);
        if (v > win_v) {
            win_v = v;
            win_i = i;
        };
        i = i + 1;
    };

    if (pricing == FIRST_PRICE) {
        return (win_i, win_v)
    };

    // second-price: the highest amount excluding the winning index
    let mut second = 0;
    let mut j = 0;
    while (j < n) {
        if (j != win_i) {
            let v = *vector::borrow(amounts, j);
            if (v > second) {
                second = v;
            };
        };
        j = j + 1;
    };
    (win_i, second)
}
