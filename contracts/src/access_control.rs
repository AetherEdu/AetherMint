use soroban_sdk::{contracttype, Address, Env, Vec};

/// Role enum for granular permissions
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    Admin = 0,
    Issuer = 1,
    Instructor = 2,
    Student = 3,
}

impl Role {
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }
}

/// Storage key for per-address role sets
#[contracttype]
pub enum AccessKey {
    Roles(Address), // Vec<u32> of Role::to_u32() values
}

/// Grant a role to an address. Caller must be Admin.
pub fn grant_role(env: &Env, caller: Address, target: Address, role: Role) {
    caller.require_auth();
    require_role(env, &caller, Role::Admin);

    let mut roles = get_roles_raw(env, &target);
    let role_u32 = role.to_u32();
    // Avoid duplicates
    for i in 0..roles.len() {
        if roles.get(i).unwrap() == role_u32 {
            return;
        }
    }
    roles.push_back(role_u32);
    env.storage()
        .instance()
        .set(&AccessKey::Roles(target), &roles);
}

/// Revoke a role from an address. Caller must be Admin.
pub fn revoke_role(env: &Env, caller: Address, target: Address, role: Role) {
    caller.require_auth();
    require_role(env, &caller, Role::Admin);

    let roles = get_roles_raw(env, &target);
    let role_u32 = role.to_u32();
    let mut new_roles: Vec<u32> = Vec::new(env);
    for i in 0..roles.len() {
        let r = roles.get(i).unwrap();
        if r != role_u32 {
            new_roles.push_back(r);
        }
    }
    env.storage()
        .instance()
        .set(&AccessKey::Roles(target), &new_roles);
}

/// Check whether an address has a specific role.
pub fn has_role(env: &Env, addr: &Address, role: Role) -> bool {
    let roles = get_roles_raw(env, addr);
    let role_u32 = role.to_u32();
    for i in 0..roles.len() {
        if roles.get(i).unwrap() == role_u32 {
            return true;
        }
    }
    false
}

/// Panic if address does not have the required role.
pub fn require_role(env: &Env, addr: &Address, role: Role) {
    if !has_role(env, addr, role) {
        match role {
            Role::Admin => panic!("Caller does not have Admin role"),
            Role::Issuer => panic!("Caller does not have Issuer role"),
            Role::Instructor => panic!("Caller does not have Instructor role"),
            Role::Student => panic!("Caller does not have Student role"),
        }
    }
}

/// Bootstrap: assign Admin role during contract initialization (no auth check).
pub fn set_initial_admin(env: &Env, admin: &Address) {
    let mut roles: Vec<u32> = Vec::new(env);
    roles.push_back(Role::Admin.to_u32());
    env.storage()
        .instance()
        .set(&AccessKey::Roles(admin.clone()), &roles);
}

// --- internal helpers ---

fn get_roles_raw(env: &Env, addr: &Address) -> Vec<u32> {
    env.storage()
        .instance()
        .get(&AccessKey::Roles(addr.clone()))
        .unwrap_or_else(|| Vec::new(env))
}
