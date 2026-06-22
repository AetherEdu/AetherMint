#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct MinimalContract;

#[contractimpl]
impl MinimalContract {
    pub fn hello(env: Env) -> u32 {
        // Minimal working contract to verify build system
        env.ledger().sequence()
    }
}
