//! Shared input-validation guards for contract entry points.
//!
//! Centralizes the checks that every public function should run on its inputs
//! *before* touching storage: string bounds, numeric bounds, duration sanity,
//! and address sanity. Validators fail with a typed [`ValidationError`] via
//! `panic_with_error!`, so callers get a descriptive, stable error code instead
//! of an opaque `panic!` string — cheaper to debug and to assert against in
//! tests.
//!
//! ### A note on "zero address" validation
//! Stellar/Soroban has no null/zero `Address` the way EVM chains do — an
//! `Address` is only ever constructed from a valid strkey or contract id, so it
//! cannot be uninitialized. The closest analogue is the all-zero ed25519
//! account, which acts as an unspendable burn address; [`validate_non_zero_address`]
//! rejects it so credentials/NFTs can't be issued into a black hole. The more
//! common real-world mistake — passing the same address where two distinct ones
//! are required — is covered by [`validate_distinct_addresses`].

use soroban_sdk::{contracterror, panic_with_error, Address, Env, String};

/// Maximum length (in bytes) for short titles/names.
pub const MAX_TITLE_LENGTH: u32 = 200;
/// Maximum length (in bytes) for free-form descriptions.
pub const MAX_DESCRIPTION_LENGTH: u32 = 2000;
/// Maximum length (in bytes) for short identifiers (course ids, institution names).
pub const MAX_SHORT_TEXT_LENGTH: u32 = 100;
/// Maximum length (in bytes) for URIs and content hashes (ipfs hashes, base URIs).
pub const MAX_URI_LENGTH: u32 = 512;
/// Maximum length (in bytes) for metadata blobs.
pub const MAX_METADATA_LENGTH: u32 = 2000;

/// Upper bound for time durations, in seconds (~100 years). Prevents absurd
/// values and guards against overflow when added to a ledger timestamp.
pub const MAX_DURATION_SECONDS: u64 = 100 * 365 * 24 * 60 * 60;

/// The all-zero ed25519 account ("burn" address) in strkey form.
const ZERO_ADDRESS_STRKEY: &str = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/// Typed validation failures shared across all contract modules.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ValidationError {
    /// A required string field was empty.
    EmptyString = 1,
    /// A string field exceeded its maximum allowed length.
    StringTooLong = 2,
    /// A numeric field was zero where a positive value is required.
    ValueZero = 3,
    /// A numeric field exceeded its maximum allowed value.
    ValueTooLarge = 4,
    /// A numeric field fell outside its allowed `[min, max]` range.
    ValueOutOfRange = 5,
    /// Two addresses were equal where distinct addresses are required.
    DuplicateAddress = 6,
    /// An address equal to the zero/burn account was supplied.
    ZeroAddress = 7,
}

/// Require a non-empty string.
pub fn validate_string_non_empty(env: &Env, value: &String) {
    if value.len() == 0 {
        panic_with_error!(env, ValidationError::EmptyString);
    }
}

/// Require a non-empty string no longer than `max_len` bytes.
pub fn validate_string_length(env: &Env, value: &String, max_len: u32) {
    if value.len() == 0 {
        panic_with_error!(env, ValidationError::EmptyString);
    }
    if value.len() > max_len {
        panic_with_error!(env, ValidationError::StringTooLong);
    }
}

/// Require a string no longer than `max_len` bytes (empty allowed).
pub fn validate_optional_string_length(env: &Env, value: &String, max_len: u32) {
    if value.len() > max_len {
        panic_with_error!(env, ValidationError::StringTooLong);
    }
}

/// Require a strictly positive `u64`.
pub fn validate_positive_u64(env: &Env, value: u64) {
    if value == 0 {
        panic_with_error!(env, ValidationError::ValueZero);
    }
}

/// Require `value <= max`.
pub fn validate_u64_max(env: &Env, value: u64, max: u64) {
    if value > max {
        panic_with_error!(env, ValidationError::ValueTooLarge);
    }
}

/// Require `min <= value <= max`.
pub fn validate_u64_in_range(env: &Env, value: u64, min: u64, max: u64) {
    if value < min || value > max {
        panic_with_error!(env, ValidationError::ValueOutOfRange);
    }
}

/// Require a duration that is positive and within [`MAX_DURATION_SECONDS`].
pub fn validate_duration(env: &Env, duration_seconds: u64) {
    if duration_seconds == 0 {
        panic_with_error!(env, ValidationError::ValueZero);
    }
    if duration_seconds > MAX_DURATION_SECONDS {
        panic_with_error!(env, ValidationError::ValueTooLarge);
    }
}

/// Require two addresses to be different (e.g. `from != to`, fused tokens).
pub fn validate_distinct_addresses(env: &Env, a: &Address, b: &Address) {
    if a == b {
        panic_with_error!(env, ValidationError::DuplicateAddress);
    }
}

/// Reject the all-zero ed25519 burn account. See the module-level note on why
/// this is the only meaningful "zero address" in Soroban.
pub fn validate_non_zero_address(env: &Env, address: &Address) {
    let zero = Address::from_string(&String::from_str(env, ZERO_ADDRESS_STRKEY));
    if address == &zero {
        panic_with_error!(env, ValidationError::ZeroAddress);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn string_length_accepts_within_bounds() {
        let env = Env::default();
        validate_string_length(&env, &String::from_str(&env, "ok"), 10);
        validate_optional_string_length(&env, &String::from_str(&env, ""), 10);
    }

    #[test]
    #[should_panic]
    fn string_length_rejects_empty() {
        let env = Env::default();
        validate_string_length(&env, &String::from_str(&env, ""), 10);
    }

    #[test]
    #[should_panic]
    fn string_length_rejects_too_long() {
        let env = Env::default();
        validate_string_length(&env, &String::from_str(&env, "abcdef"), 3);
    }

    #[test]
    fn positive_u64_accepts_positive() {
        let env = Env::default();
        validate_positive_u64(&env, 1);
    }

    #[test]
    #[should_panic]
    fn positive_u64_rejects_zero() {
        let env = Env::default();
        validate_positive_u64(&env, 0);
    }

    #[test]
    fn duration_accepts_valid() {
        let env = Env::default();
        validate_duration(&env, 3600);
    }

    #[test]
    #[should_panic]
    fn duration_rejects_zero() {
        let env = Env::default();
        validate_duration(&env, 0);
    }

    #[test]
    #[should_panic]
    fn duration_rejects_too_large() {
        let env = Env::default();
        validate_duration(&env, MAX_DURATION_SECONDS + 1);
    }

    #[test]
    fn range_checks() {
        let env = Env::default();
        validate_u64_max(&env, 5, 10);
        validate_u64_in_range(&env, 5, 1, 10);
    }

    #[test]
    #[should_panic]
    fn range_rejects_out_of_range() {
        let env = Env::default();
        validate_u64_in_range(&env, 11, 1, 10);
    }

    #[test]
    fn distinct_addresses_ok_when_different() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        validate_distinct_addresses(&env, &a, &b);
    }

    #[test]
    #[should_panic]
    fn distinct_addresses_rejects_equal() {
        let env = Env::default();
        let a = Address::generate(&env);
        validate_distinct_addresses(&env, &a, &a);
    }

    #[test]
    fn non_zero_address_accepts_normal_address() {
        let env = Env::default();
        let a = Address::generate(&env);
        validate_non_zero_address(&env, &a);
    }

    #[test]
    #[should_panic]
    fn non_zero_address_rejects_zero() {
        let env = Env::default();
        let zero = Address::from_string(&String::from_str(&env, ZERO_ADDRESS_STRKEY));
        validate_non_zero_address(&env, &zero);
    }
}
