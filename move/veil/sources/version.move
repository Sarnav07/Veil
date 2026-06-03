/// Package version marker for the VEIL Move package.
///
/// Intentionally minimal for M0: this exists so the package compiles, tests,
/// and publishes end-to-end before the auction primitive, Seal access policy,
/// and settlement modules land in M1+.
module veil::version;

/// Current on-chain package version. Bump on each published upgrade.
const VERSION: u64 = 1;

/// Returns the package version.
public fun version(): u64 {
    VERSION
}
