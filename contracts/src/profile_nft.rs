/// Profile NFT Module
///
/// Allows users to mint an NFT that represents their on-chain user profile.
/// Stores metadata (name, bio, skills, avatar URL, etc.) immutably on-chain.
/// Only the profile owner can mint or update their NFT.
use crate::utils::pause::PauseUtils;
use crate::utils::storage::StorageUtils;
use crate::utils::validation::{
    validate_non_zero_address, validate_string_length,
    MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, MAX_URI_LENGTH,
};
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Vec};

/// Maximum number of skills per profile NFT
pub const MAX_SKILLS: u32 = 20;
/// Maximum length of a single skill tag
pub const MAX_SKILL_LENGTH: u32 = 50;

/// Profile NFT representing a user's on-chain identity
#[contracttype]
#[derive(Clone)]
pub struct ProfileNFT {
    /// Unique token identifier
    pub token_id: u64,
    /// Owner of this profile NFT (also the profile owner)
    pub owner: Address,
    /// Display name
    pub name: String,
    /// Short bio / description
    pub bio: String,
    /// Avatar / profile picture URL (IPFS preferred)
    pub avatar_url: String,
    /// Professional skills / tags
    pub skills: Vec<String>,
    /// External website or social link
    pub website: Option<String>,
    /// Timestamp of initial mint
    pub minted_at: u64,
    /// Timestamp of last metadata update
    pub updated_at: u64,
    /// Whether the profile has been verified by an admin
    pub verified: bool,
    /// Version of the metadata schema
    pub schema_version: u32,
}

/// Storage keys for the profile NFT system
#[contracttype]
pub enum ProfileNFTKey {
    /// Token data by ID
    Token(u64),
    /// Owner → token ID mapping (one NFT per address)
    OwnerToken(Address),
    /// Global token counter
    TokenCount,
    /// Token ID → owner reverse lookup
    TokenOwner(u64),
}

// ── Public API ──────────────────────────────────────────────────────────────

/// Mint a new profile NFT for the caller.
///
/// Only one profile NFT can exist per address. If the caller already has one,
/// this will panic.
pub fn mint_profile_nft(
    env: &Env,
    owner: Address,
    name: String,
    bio: String,
    avatar_url: String,
    skills: Vec<String>,
    website: Option<String>,
) -> u64 {
    PauseUtils::require_not_paused(env);
    owner.require_auth();

    // Validate inputs
    validate_non_zero_address(env, &owner);
    validate_string_length(env, &name, MAX_TITLE_LENGTH);
    validate_string_length(env, &bio, MAX_DESCRIPTION_LENGTH);
    validate_string_length(env, &avatar_url, MAX_URI_LENGTH);
    validate_skills(env, &skills);

    if let Some(ref w) = website {
        validate_string_length(env, w, MAX_URI_LENGTH);
    }

    // Enforce one NFT per address
    if env
        .storage()
        .persistent()
        .has(&ProfileNFTKey::OwnerToken(owner.clone()))
    {
        panic!("Profile NFT already exists for this address. Use update instead.");
    }

    let token_id = StorageUtils::get_next_id(env, crate::utils::storage::EntityType::Credential);
    let timestamp = env.ledger().timestamp();

    let nft = ProfileNFT {
        token_id,
        owner: owner.clone(),
        name,
        bio,
        avatar_url,
        skills,
        website,
        minted_at: timestamp,
        updated_at: timestamp,
        verified: false,
        schema_version: 1,
    };

    // Persist token
    env.storage()
        .persistent()
        .set(&ProfileNFTKey::Token(token_id), &nft);
    // Owner → token mapping
    env.storage()
        .persistent()
        .set(&ProfileNFTKey::OwnerToken(owner.clone()), &token_id);
    // Token → owner reverse lookup
    env.storage()
        .persistent()
        .set(&ProfileNFTKey::TokenOwner(token_id), &owner);
    // Token count
    env.storage()
        .instance()
        .set(&ProfileNFTKey::TokenCount, &token_id);

    // Emit mint event
    env.events().publish(
        (symbol_short!("profile"), symbol_short!("minted")),
        (token_id, owner, timestamp),
    );

    token_id
}

/// Update the metadata of an existing profile NFT.
///
/// Caller must be the current owner of the NFT.
pub fn update_profile_nft(
    env: &Env,
    owner: Address,
    name: String,
    bio: String,
    avatar_url: String,
    skills: Vec<String>,
    website: Option<String>,
) -> bool {
    PauseUtils::require_not_paused(env);
    owner.require_auth();

    validate_string_length(env, &name, MAX_TITLE_LENGTH);
    validate_string_length(env, &bio, MAX_DESCRIPTION_LENGTH);
    validate_string_length(env, &avatar_url, MAX_URI_LENGTH);
    validate_skills(env, &skills);

    if let Some(ref w) = website {
        validate_string_length(env, w, MAX_URI_LENGTH);
    }

    let token_id = get_token_id_for_owner(env, owner.clone())
        .unwrap_or_else(|| panic!("No profile NFT found for this address. Mint one first."));

    let mut nft = get_profile_nft(env, token_id);

    let timestamp = env.ledger().timestamp();
    nft.name = name;
    nft.bio = bio;
    nft.avatar_url = avatar_url;
    nft.skills = skills;
    nft.website = website;
    nft.updated_at = timestamp;

    env.storage()
        .persistent()
        .set(&ProfileNFTKey::Token(token_id), &nft);

    env.events().publish(
        (symbol_short!("profile"), symbol_short!("updated")),
        (token_id, owner, timestamp),
    );

    true
}

/// Get a profile NFT by token ID.
pub fn get_profile_nft(env: &Env, token_id: u64) -> ProfileNFT {
    env.storage()
        .persistent()
        .get(&ProfileNFTKey::Token(token_id))
        .unwrap_or_else(|| panic!("Profile NFT not found"))
}

/// Get a profile NFT by owner address.
///
/// Returns `None` if the owner has not minted a profile NFT yet.
pub fn get_profile_nft_by_owner(env: &Env, owner: Address) -> Option<ProfileNFT> {
    if let Some(token_id) = get_token_id_for_owner(env, owner) {
        Some(get_profile_nft(env, token_id))
    } else {
        None
    }
}

/// Get the token ID for an owner, if one exists.
pub fn get_token_id_for_owner(env: &Env, owner: Address) -> Option<u64> {
    env.storage()
        .persistent()
        .get(&ProfileNFTKey::OwnerToken(owner))
}

/// Get the owner address for a token ID.
pub fn owner_of(env: &Env, token_id: u64) -> Address {
    env.storage()
        .persistent()
        .get(&ProfileNFTKey::TokenOwner(token_id))
        .unwrap_or_else(|| panic!("Profile NFT not found"))
}

/// Check whether a profile NFT exists for a given token ID.
pub fn profile_nft_exists(env: &Env, token_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&ProfileNFTKey::Token(token_id))
}

/// Check whether an address already has a profile NFT.
pub fn has_profile_nft(env: &Env, owner: Address) -> bool {
    env.storage()
        .persistent()
        .has(&ProfileNFTKey::OwnerToken(owner))
}

/// Burn (destroy) an existing profile NFT.
///
/// Only the owner can burn their own NFT.
pub fn burn_profile_nft(env: &Env, owner: Address) -> bool {
    PauseUtils::require_not_paused(env);
    owner.require_auth();

    let token_id = get_token_id_for_owner(env, owner.clone())
        .unwrap_or_else(|| panic!("No profile NFT found for this address."));

    env.storage()
        .persistent()
        .remove(&ProfileNFTKey::Token(token_id));
    env.storage()
        .persistent()
        .remove(&ProfileNFTKey::OwnerToken(owner.clone()));
    env.storage()
        .persistent()
        .remove(&ProfileNFTKey::TokenOwner(token_id));

    env.events().publish(
        (symbol_short!("profile"), symbol_short!("burned")),
        (token_id, owner),
    );

    true
}

/// Admin-only: mark a profile NFT as verified.
pub fn verify_profile_nft(env: &Env, admin: Address, token_id: u64) -> bool {
    PauseUtils::require_not_paused(env);
    admin.require_auth();

    let mut nft = get_profile_nft(env, token_id);
    nft.verified = true;
    nft.updated_at = env.ledger().timestamp();

    env.storage()
        .persistent()
        .set(&ProfileNFTKey::Token(token_id), &nft);

    env.events().publish(
        (symbol_short!("profile"), symbol_short!("verified")),
        (token_id, admin),
    );

    true
}

/// Admin-only: revoke verification from a profile NFT.
pub fn unverify_profile_nft(env: &Env, admin: Address, token_id: u64) -> bool {
    PauseUtils::require_not_paused(env);
    admin.require_auth();

    let mut nft = get_profile_nft(env, token_id);
    nft.verified = false;
    nft.updated_at = env.ledger().timestamp();

    env.storage()
        .persistent()
        .set(&ProfileNFTKey::Token(token_id), &nft);

    env.events().publish(
        (symbol_short!("profile"), symbol_short!("unverify")),
        (token_id, admin),
    );

    true
}

/// Get the total number of profile NFTs minted.
pub fn get_total_supply(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&ProfileNFTKey::TokenCount)
        .unwrap_or(0)
}

/// Get a paginated list of all profile NFT token IDs.
pub fn get_all_token_ids(env: &Env, offset: u64, limit: u64) -> Vec<u64> {
    let total = get_total_supply(env);
    let mut ids = Vec::new(env);
    let end = (offset + limit).min(total);

    for i in offset..end {
        let token_id = i + 1; // token IDs start at 1
        if profile_nft_exists(env, token_id) {
            ids.push_back(token_id);
        }
    }

    ids
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Validate a skills list — checks size and individual string lengths.
fn validate_skills(env: &Env, skills: &Vec<String>) {
    if skills.len() > MAX_SKILLS {
        panic!("Too many skills");
    }
    for skill in skills.iter() {
        validate_string_length(env, &skill, MAX_SKILL_LENGTH);
    }
}
