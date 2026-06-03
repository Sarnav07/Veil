#[test_only]
module veil::version_tests;

use veil::version;

#[test]
fun version_is_one() {
    assert!(version::version() == 1, 0);
}
