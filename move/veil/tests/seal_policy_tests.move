#[test_only]
module veil::seal_policy_tests;

use sui::clock;
use veil::seal_policy;

#[test]
fun unlocks_at_close_time() {
    let mut ctx = tx_context::dummy();
    let mut clk = clock::create_for_testing(&mut ctx);
    clock::set_for_testing(&mut clk, 1_000);
    seal_policy::assert_unlocked(seal_policy::time_lock_id(1_000), &clk);
    clock::destroy_for_testing(clk);
}

#[test]
#[expected_failure(abort_code = seal_policy::ETooEarly)]
fun stays_locked_before_close() {
    let mut ctx = tx_context::dummy();
    let mut clk = clock::create_for_testing(&mut ctx);
    clock::set_for_testing(&mut clk, 999);
    seal_policy::assert_unlocked(seal_policy::time_lock_id(1_000), &clk);
    clock::destroy_for_testing(clk);
}
