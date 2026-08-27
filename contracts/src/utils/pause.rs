// This module emits events via the legacy `env.events().publish` API
// (deprecated in soroban-sdk 26). Scoped here rather than crate-wide until it
// is migrated to the `#[contractevent]` macro.
#![allow(deprecated)]

use crate::utils::storage::StorageKey;
use soroban_sdk::{contracttype, symbol_short, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausedEvent {
    pub actor: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnpausedEvent {
    pub actor: Address,
    pub timestamp: u64,
}

/// Implementation of the Circuit Breaker (Pause/Unpause) pattern.
pub struct PauseUtils;

impl PauseUtils {
    /// Check if the contract is currently paused.
    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&StorageKey::Paused)
            .unwrap_or(false)
    }

    /// Panic if the contract is paused.
    pub fn require_not_paused(env: &Env) {
        if Self::is_paused(env) {
            panic!("Contract is paused");
        }
    }

    /// Pause the contract. Only callable by admin.
    pub fn pause(env: &Env, admin: Address, stored_admin: Address) {
        admin.require_auth();

        if admin != stored_admin {
            panic!("Only admin can pause");
        }

        env.storage().instance().set(&StorageKey::Paused, &true);

        env.events().publish(
            (symbol_short!("pause"), symbol_short!("paused")),
            PausedEvent {
                actor: admin,
                timestamp: env.ledger().timestamp(),
            },
        );
    }

    /// Unpause the contract. Only callable by admin.
    pub fn unpause(env: &Env, admin: Address, stored_admin: Address) {
        admin.require_auth();

        if admin != stored_admin {
            panic!("Only admin can unpause");
        }

        env.storage().instance().set(&StorageKey::Paused, &false);

        env.events().publish(
            (symbol_short!("pause"), symbol_short!("unpaused")),
            UnpausedEvent {
                actor: admin,
                timestamp: env.ledger().timestamp(),
            },
        );
    }
}
