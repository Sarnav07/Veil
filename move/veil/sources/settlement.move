/// Pure sealed-bid clearing logic, kept separate from the auction object so it
/// can be unit-tested in isolation. Operates purely on a list of bid amounts.
module veil::settlement;

/// Clearing rules.
const FIRST_PRICE: u8 = 0;
const SECOND_PRICE: u8 = 1;

const EEmptyBids: u64 = 1;
const EUnknownPricing: u64 = 2;
const ELengthMismatch: u64 = 3;

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

/// Uniform-price multi-unit clearing. `prices[i]`/`quantities[i]` are bid `i`'s
/// per-unit price and demanded quantity; `supply` is the total on offer. Bids fill
/// from the highest price down until supply runs out, so everyone pays the same
/// `clearing_price` — the lowest price that still gets any allocation. Bids strictly
/// above it fill in full, bids at exactly it split the leftover supply pro-rata, and
/// bids below it get nothing. Returns `(clearing_price, allocations)` with the
/// allocations summing to at most `supply` (the marginal split floors, so a few units
/// may go unsold). An empty sale or zero supply clears at price 0 with no allocation.
public fun uniform_clear(
    prices: &vector<u64>,
    quantities: &vector<u64>,
    supply: u64,
): (u64, vector<u64>) {
    let n = vector::length(prices);
    assert!(vector::length(quantities) == n, ELengthMismatch);

    let mut alloc = vector[];
    let mut i = 0;
    while (i < n) { vector::push_back(&mut alloc, 0); i = i + 1; };
    if (n == 0 || supply == 0) {
        return (0, alloc)
    };

    // Bid indices sorted by price descending, ties broken toward the earlier bid.
    let order = sort_by_price_desc(prices);

    // Walk the demand curve down to find the marginal price: the price at which
    // cumulative demand first reaches (or passes) supply.
    let mut filled = 0;
    let mut clearing_price = *vector::borrow(prices, *vector::borrow(&order, 0));
    let mut p = 0;
    while (p < n) {
        let idx = *vector::borrow(&order, p);
        clearing_price = *vector::borrow(prices, idx);
        filled = filled + *vector::borrow(quantities, idx);
        if (filled >= supply) break;
        p = p + 1;
    };

    // Everything priced strictly above the clearing price fills in full.
    let mut remaining = supply;
    let mut q = 0;
    while (q < n) {
        let idx = *vector::borrow(&order, q);
        let price = *vector::borrow(prices, idx);
        if (price == clearing_price) break;
        let want = *vector::borrow(quantities, idx);
        let take = if (want <= remaining) want else remaining;
        *vector::borrow_mut(&mut alloc, idx) = take;
        remaining = remaining - take;
        q = q + 1;
    };

    // The bids exactly at the clearing price share what's left, pro-rata by demand.
    if (remaining > 0) {
        let mut marginal_demand = 0;
        let mut a = 0;
        while (a < n) {
            if (*vector::borrow(prices, a) == clearing_price) {
                marginal_demand = marginal_demand + *vector::borrow(quantities, a);
            };
            a = a + 1;
        };
        if (marginal_demand <= remaining) {
            // No contention: the marginal tier is fully covered.
            let mut b = 0;
            while (b < n) {
                if (*vector::borrow(prices, b) == clearing_price) {
                    *vector::borrow_mut(&mut alloc, b) = *vector::borrow(quantities, b);
                };
                b = b + 1;
            };
        } else {
            let mut b = 0;
            while (b < n) {
                if (*vector::borrow(prices, b) == clearing_price) {
                    let want = *vector::borrow(quantities, b);
                    // floor(want * remaining / marginal_demand); the floor keeps the
                    // total within supply at the cost of a few unsold units.
                    let share = ((want as u128) * (remaining as u128)
                        / (marginal_demand as u128)) as u64;
                    *vector::borrow_mut(&mut alloc, b) = share;
                };
                b = b + 1;
            };
        };
    };

    (clearing_price, alloc)
}

/// Indices of `prices` sorted by price descending; equal prices keep their original
/// order (earlier bid first). Insertion sort — bid counts here are small.
fun sort_by_price_desc(prices: &vector<u64>): vector<u64> {
    let n = vector::length(prices);
    let mut order = vector[];
    let mut i = 0;
    while (i < n) { vector::push_back(&mut order, i); i = i + 1; };

    let mut a = 1;
    while (a < n) {
        let idx = *vector::borrow(&order, a);
        let key = *vector::borrow(prices, idx);
        let mut b = a;
        // shift higher-or-equal-priced earlier entries are already ahead; move `idx`
        // left only past strictly lower-priced ones to preserve tie order.
        while (b > 0 && *vector::borrow(prices, *vector::borrow(&order, b - 1)) < key) {
            let prev = *vector::borrow(&order, b - 1);
            *vector::borrow_mut(&mut order, b) = prev;
            b = b - 1;
        };
        *vector::borrow_mut(&mut order, b) = idx;
        a = a + 1;
    };
    order
}
