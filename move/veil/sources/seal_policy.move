/// Seal access policy. A bid stays encrypted until its auction's close time:
/// Seal key servers only release a decryption key once `seal_approve` passes.
module veil::seal_policy;

use sui::clock::Clock;

const ETooEarly: u64 = 1;

/// The identity a bid is sealed to. Must match the TS `timeLockId`.
public fun time_lock_id(unlock_ms: u64): vector<u8> {
    std::bcs::to_bytes(&unlock_ms)
}

/// Aborts unless the chain clock has reached the time encoded in `id`.
public fun assert_unlocked(id: vector<u8>, clock: &Clock) {
    let mut reader = sui::bcs::new(id);
    assert!(clock.timestamp_ms() >= reader.peel_u64(), ETooEarly);
}

entry fun seal_approve(id: vector<u8>, clock: &Clock) {
    assert_unlocked(id, clock);
}
