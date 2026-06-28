//! # Utilities Module
//!
//! Shared storage, validation, and pause utilities used across all contract
//! modules.
//!
//! ## Sub-modules
//!
//! | Module | Purpose |
//! |---|---|
//! | [`storage`] | ID generation, versioning, packed types, migration records |
//! | [`validation`] | Input validation helpers (string length, addresses, durations) |
//! | [`pause`] | Circuit-breaker pattern for emergency contract pausing |

pub mod storage;
pub mod validation;
pub mod pause;

#[cfg(test)]
mod storage_test;
