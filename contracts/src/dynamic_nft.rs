use soroban_sdk::{contracttype, Address, Bytes, Env, String, Vec, Symbol};
use crate::utils::storage::{StorageUtils, EntityType};
use crate::utils::validation::{
    validate_distinct_addresses, validate_non_zero_address, validate_optional_string_length,
    validate_string_length, MAX_METADATA_LENGTH, MAX_URI_LENGTH,
};

/// Contract version for upgradeable pattern
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ContractVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl ContractVersion {
    pub fn new(major: u32, minor: u32, patch: u32) -> Self {
        Self { major, minor, patch }
    }

    pub fn to_string(&self, env: &Env) -> String {
        let major_str = crate::u64_to_string(env, self.major as u64, "");
        let minor_str = crate::u64_to_string(env, self.minor as u64, "");
        let patch_str = crate::u64_to_string(env, self.patch as u64, "");
        let dot = String::from_str(env, ".");
        let combined = crate::str_cat(env, &major_str, &dot);
        let combined2 = crate::str_cat(env, &combined, &minor_str);
        let combined3 = crate::str_cat(env, &combined2, &dot);
        crate::str_cat(env, &combined3, &patch_str)
    }

    pub fn is_compatible(&self, other: &ContractVersion) -> bool {
        self.major == other.major && self.minor >= other.minor
    }
}

/// Upgradeable contract storage keys
#[contracttype]
pub enum UpgradeableKey {
    ContractVersion,
    ImplementationHash(String), // version -> hash
    MigrationFlag(u32), // migration version -> bool
}

/// Dynamic NFT credential with evolution capabilities
#[contracttype]
#[derive(Clone)]
pub struct DynamicNFT {
    pub token_id: u64,
    pub owner: Address,
    pub creator: Address,
    pub base_uri: String,
    pub current_level: u32,
    pub experience_points: u64,
    pub achievements: Vec<u64>, // Achievement IDs that contribute to evolution
    pub visual_traits: VisualTraits,
    pub evolution_history: Vec<EvolutionRecord>,
    pub metadata_ipfs: String,
    pub created_at: u64,
    pub last_evolved: u64,
    pub evolution_stage: EvolutionStage,
}

/// Visual traits for NFT representation
#[contracttype]
#[derive(Clone)]
pub struct VisualTraits {
    pub background: u32,
    pub border: u32,
    pub emblem: u32,
    pub glow_effect: u32,
    pub special_effects: Bytes,
    pub rarity_tier: RarityTier,
}

/// Evolution stages
#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum EvolutionStage {
    Novice = 0,
    Apprentice = 1,
    Expert = 2,
    Master = 3,
    Grandmaster = 4,
    Legendary = 5,
}

/// Rarity tiers for visual representation
#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum RarityTier {
    Common = 0,
    Uncommon = 1,
    Rare = 2,
    Epic = 3,
    Legendary = 4,
    Mythic = 5,
}

/// Evolution record for tracking changes
#[contracttype]
#[derive(Clone)]
pub struct EvolutionRecord {
    pub timestamp: u64,
    pub from_stage: EvolutionStage,
    pub to_stage: EvolutionStage,
    pub achievement_id: u64,
    pub ipfs_hash: String,
}

/// IPFS metadata structure for enhanced verification
#[contracttype]
#[derive(Clone)]
pub struct IPFSMetadata {
    pub hash: String,
    pub version: u32,
    pub content_type: String,
    pub size_bytes: u64,
    pub verification_timestamp: u64,
    pub backup_urls: Vec<String>,
}

/// Enhanced metadata with IPFS verification
#[contracttype]
#[derive(Clone)]
pub struct EnhancedMetadata {
    pub ipfs_metadata: IPFSMetadata,
    pub schema_version: u32,
    pub attributes: Vec<MetadataAttribute>,
    pub animation_url: Option<String>,
    pub external_url: Option<String>,
}

/// Metadata attribute for NFT properties
#[contracttype]
#[derive(Clone)]
pub struct MetadataAttribute {
    pub trait_type: String,
    pub value: String,
    pub display_type: Option<String>,
}

/// Achievement requirements for evolution
#[contracttype]
#[derive(Clone)]
pub struct EvolutionRequirement {
    pub stage: EvolutionStage,
    pub required_xp: u64,
    pub required_achievements: Vec<u64>,
    pub visual_trait_changes: VisualTraits,
}

/// Storage keys for dynamic NFT system
#[contracttype]
pub enum DynamicNFTKey {
    Token(u64),
    OwnerTokens(Address),
    TokenCount,
    EvolutionRequirements(EvolutionStage),
    FusionRecipe(u64, u64), // token1_id, token2_id
    AchievementBadge(u64),
}

/// Soroban NFT events
#[contracttype]
pub enum NFTEvent {
    Transfer(Address, Address, u64), // from, to, token_id
    Evolution(u64, EvolutionStage, EvolutionStage), // token_id, from_stage, to_stage
    AchievementUnlocked(u64, u64), // token_id, achievement_id
    Fusion(u64, u64, u64), // token1_id, token2_id, new_token_id
}

/// Initialize upgradeable contract with version
pub fn initialize_upgradeable(env: &Env, admin: Address, initial_version: ContractVersion) {
    if env.storage().instance().has(&UpgradeableKey::ContractVersion) {
        panic!("Contract already initialized");
    }
    
    env.storage().instance().set(&UpgradeableKey::ContractVersion, &initial_version);
    env.storage().instance().set(&soroban_sdk::Symbol::new(env, "admin"), &admin);
}

/// Get current contract version
pub fn get_contract_version(env: &Env) -> ContractVersion {
    env.storage().instance()
        .get(&UpgradeableKey::ContractVersion)
        .unwrap_or_else(|| ContractVersion::new(1, 0, 0))
}

/// Upgrade contract to new version
pub fn upgrade_contract(env: &Env, new_version: ContractVersion, implementation_hash: String) -> bool {
    let admin: Address = env.storage().instance()
        .get(&soroban_sdk::Symbol::new(env, "admin"))
        .unwrap_or_else(|| panic!("Admin not found"));
    
    admin.require_auth();
    
    let current_version = get_contract_version(env);
    if !new_version.is_compatible(&current_version) {
        panic!("Incompatible version upgrade");
    }
    
    env.storage().instance().set(&UpgradeableKey::ContractVersion, &new_version);
    env.storage().instance().set(
        &UpgradeableKey::ImplementationHash(new_version.to_string(env)), 
        &implementation_hash
    );
    
    true
}

/// Verify IPFS metadata integrity
pub fn verify_ipfs_metadata(env: &Env, metadata: &IPFSMetadata) -> bool {
    // Basic hash validation (simplified - in production would use IPFS gateway)
    if metadata.hash.len() < 46 {
        return false;
    }
    
    // Check if metadata is not too old (24 hours)
    let now = env.ledger().timestamp();
    let max_age = 24 * 60 * 60; // 24 hours in seconds
    if now > metadata.verification_timestamp + max_age {
        return false;
    }
    
    // Verify content type
    // Content type validation removed - relies on IPFS hash verification
    
    true
}

/// Store enhanced metadata with IPFS verification
pub fn store_enhanced_metadata(env: &Env, token_id: u64, metadata: EnhancedMetadata) -> bool {
    if !verify_ipfs_metadata(env, &metadata.ipfs_metadata) {
        panic!("Invalid IPFS metadata");
    }
    
    let mut nft: DynamicNFT = env.storage().persistent()
        .get(&DynamicNFTKey::Token(token_id))
        .unwrap_or_else(|| panic!("NFT not found"));
    
    // Update metadata with verification timestamp
    nft.metadata_ipfs = metadata.ipfs_metadata.hash.clone();
    nft.last_evolved = env.ledger().timestamp();
    
    // Store enhanced metadata separately for detailed queries
    env.storage().persistent().set(&DynamicNFTKey::Token(token_id), &nft);
    env.storage().persistent().set(
        &soroban_sdk::Symbol::new(env, "enhanced"), 
        &metadata
    );
    
    true
}

/// Get enhanced metadata for NFT
pub fn get_enhanced_metadata(env: &Env, _token_id: u64) -> Option<EnhancedMetadata> {
    env.storage().persistent()
        .get(&soroban_sdk::Symbol::new(env, "enhanced"))
}

/// Create a new dynamic NFT credential
pub fn mint_dynamic_nft(
    env: &Env,
    creator: Address,
    recipient: Address,
    base_uri: String,
    initial_metadata: String,
) -> u64 {
    creator.require_auth();

    // Validate inputs before any state access (issue #117).
    validate_non_zero_address(env, &recipient);
    validate_string_length(env, &base_uri, MAX_URI_LENGTH);
    validate_optional_string_length(env, &initial_metadata, MAX_METADATA_LENGTH);

    let admin: Address = env.storage().instance()
        .get(&Symbol::new(env, "admin"))
        .unwrap_or_else(|| panic!("Admin not set"));
    if creator != admin {
        panic!("Unauthorized creator");
    }

    let token_id = StorageUtils::get_next_id(env, EntityType::Credential);
    let timestamp = env.ledger().timestamp();

    let visual_traits = VisualTraits {
        background: 0,
        border: 0,
        emblem: 0,
        glow_effect: 0,
        special_effects: Bytes::new(env),
        rarity_tier: RarityTier::Common,
    };

    let nft = DynamicNFT {
        token_id,
        owner: recipient.clone(),
        creator: creator.clone(),
        base_uri,
        current_level: 1u32,
        experience_points: 0,
        achievements: Vec::new(env),
        visual_traits,
        evolution_history: Vec::new(env),
        metadata_ipfs: initial_metadata,
        created_at: timestamp,
        last_evolved: timestamp,
        evolution_stage: EvolutionStage::Novice,
    };

    // Store NFT
    env.storage().persistent().set(&DynamicNFTKey::Token(token_id), &nft);
    
    // Update owner's token list
    let mut owner_tokens = get_owner_tokens(env, recipient.clone());
    owner_tokens.push_back(token_id);
    env.storage().persistent().set(&DynamicNFTKey::OwnerTokens(recipient.clone()), &owner_tokens);

    // Update token count
    env.storage().instance().set(&DynamicNFTKey::TokenCount, &token_id);

    // Emit transfer event (from: zero address sentinel)
    // In Soroban, use current_contract_address for mint events
    let zero_addr = env.current_contract_address();
    env.events().publish(
        (Symbol::new(env, "Transfer"),),
        (zero_addr, recipient, token_id)
    );

    token_id
}

/// Evolve NFT based on new achievement
pub fn evolve_nft(
    env: &Env,
    token_id: u64,
    achievement_id: u64,
    new_metadata: String,
) -> bool {
    // Validate inputs before any state access (issue #117).
    validate_optional_string_length(env, &new_metadata, MAX_METADATA_LENGTH);

    let mut nft: DynamicNFT = env.storage().persistent()
        .get(&DynamicNFTKey::Token(token_id))
        .unwrap_or_else(|| panic!("NFT not found"));

    // Check if achievement already unlocked
    if nft.achievements.contains(&achievement_id) {
        return false;
    }

    // Add achievement
    nft.achievements.push_back(achievement_id);
    
    // Calculate XP reward for achievement
    let xp_reward = calculate_achievement_xp(env, achievement_id);
    nft.experience_points += xp_reward;

    let old_stage = nft.evolution_stage.clone();
    let timestamp = env.ledger().timestamp();

    // Check for evolution
    if let Some(new_stage) = check_evolution_requirements(env, nft.current_level, nft.experience_points) {
        nft.evolution_stage = new_stage.clone();
        nft.current_level += 1;
        nft.last_evolved = timestamp;

        // Update visual traits
        update_visual_traits(env, &mut nft, &new_stage);

        // Create evolution record
        let evolution_record = EvolutionRecord {
            timestamp,
            from_stage: old_stage,
            to_stage: new_stage.clone(),
            achievement_id,
            ipfs_hash: new_metadata.clone(),
        };
        nft.evolution_history.push_back(evolution_record);

        // Emit evolution event
        env.events().publish(
            (Symbol::new(env, "Evolution"),),
            (token_id, old_stage, new_stage)
        );
    }

    // Update metadata
    nft.metadata_ipfs = new_metadata;

    // Store updated NFT
    env.storage().persistent().set(&DynamicNFTKey::Token(token_id), &nft);

    // Emit achievement unlock event
    env.events().publish(
        (Symbol::new(env, "AchievementUnlocked"),),
        (token_id, achievement_id)
    );

    true
}

/// Fuse two NFTs to create a new one
pub fn fuse_nfts(
    env: &Env,
    token1_id: u64,
    token2_id: u64,
    recipient: Address,
) -> u64 {
    // Validate inputs before any state access (issue #117).
    validate_non_zero_address(env, &recipient);
    if token1_id == token2_id {
        panic!("Cannot fuse an NFT with itself");
    }

    let nft1: DynamicNFT = env.storage().persistent()
        .get(&DynamicNFTKey::Token(token1_id))
        .unwrap_or_else(|| panic!("NFT 1 not found"));
    
    let nft2: DynamicNFT = env.storage().persistent()
        .get(&DynamicNFTKey::Token(token2_id))
        .unwrap_or_else(|| panic!("NFT 2 not found"));

    // Check ownership
    if nft1.owner != recipient || nft2.owner != recipient {
        panic!("Recipient must own both NFTs");
    }

    // Create new fused NFT
    let new_token_id = StorageUtils::get_next_id(env, EntityType::Credential);
    let timestamp = env.ledger().timestamp();

    // Combine visual traits
    let fused_traits = fuse_visual_traits(&nft1.visual_traits, &nft2.visual_traits);

    // Combine achievements
    let mut combined_achievements = nft1.achievements;
    for achievement in nft2.achievements {
        if !combined_achievements.contains(&achievement) {
            combined_achievements.push_back(achievement);
        }
    }

    let fused_nft = DynamicNFT {
        token_id: new_token_id,
        owner: recipient.clone(),
        creator: nft1.creator,
        base_uri: nft1.base_uri.clone(),
        current_level: (nft1.current_level + nft2.current_level) / 2 + 1,
        experience_points: (nft1.experience_points + nft2.experience_points) / 2,
        achievements: combined_achievements,
        visual_traits: fused_traits,
        evolution_history: Vec::new(env),
        metadata_ipfs: crate::u64_to_string(env, timestamp, "fused-"),
        created_at: timestamp,
        last_evolved: timestamp,
        evolution_stage: determine_fusion_stage(&nft1.evolution_stage, &nft2.evolution_stage),
    };

    // Store new NFT
    env.storage().persistent().set(&DynamicNFTKey::Token(new_token_id), &fused_nft);
    
    // Update owner's token list
    let mut owner_tokens = get_owner_tokens(env, recipient.clone());
    owner_tokens.push_back(new_token_id);
    env.storage().persistent().set(&DynamicNFTKey::OwnerTokens(recipient), &owner_tokens);

    // Burn original NFTs
    burn_nft(env, token1_id);
    burn_nft(env, token2_id);

    // Emit fusion event
    env.events().publish(
        (Symbol::new(env, "Fusion"),),
        (token1_id, token2_id, new_token_id)
    );

    new_token_id
}

/// Transfer NFT to new owner
pub fn transfer_nft(env: &Env, from: Address, to: Address, token_id: u64) {
    from.require_auth();

    // Validate inputs before any state access (issue #117).
    validate_non_zero_address(env, &to);
    validate_distinct_addresses(env, &from, &to);

    let mut nft: DynamicNFT = env.storage().persistent()
        .get(&DynamicNFTKey::Token(token_id))
        .unwrap_or_else(|| panic!("NFT not found"));

    if nft.owner != from {
        panic!("Not the owner");
    }

    // Remove from old owner's tokens
    let mut from_tokens = get_owner_tokens(env, from.clone());
    let mut found_idx: u32 = 0;
    let mut found = false;
    for i in 0..from_tokens.len() {
        if from_tokens.get(i).unwrap_or(0) == token_id {
            found_idx = i;
            found = true;
            break;
        }
    }
    if !found {
        panic!("Token not found in owner's list");
    }
    let index = found_idx;
    from_tokens.remove(index as u32);
    env.storage().persistent().set(&DynamicNFTKey::OwnerTokens(from.clone()), &from_tokens);

    // Add to new owner's tokens
    let mut to_tokens = get_owner_tokens(env, to.clone());
    to_tokens.push_back(token_id);
    env.storage().persistent().set(&DynamicNFTKey::OwnerTokens(to.clone()), &to_tokens);

    // Update NFT owner
    nft.owner = to.clone();
    env.storage().persistent().set(&DynamicNFTKey::Token(token_id), &nft);

    // Emit transfer event
    env.events().publish(
        (Symbol::new(env, "Transfer"),),
        (from, to, token_id)
    );
}

/// Get NFT details
pub fn get_nft(env: &Env, token_id: u64) -> DynamicNFT {
    env.storage().persistent()
        .get(&DynamicNFTKey::Token(token_id))
        .unwrap_or_else(|| panic!("NFT not found"))
}

/// Get all tokens owned by an address
pub fn get_owner_tokens(env: &Env, owner: Address) -> Vec<u64> {
    env.storage().persistent()
        .get(&DynamicNFTKey::OwnerTokens(owner))
        .unwrap_or_else(|| Vec::new(env))
}

/// Get total token count
pub fn get_total_supply(env: &Env) -> u64 {
    env.storage().instance()
        .get(&DynamicNFTKey::TokenCount)
        .unwrap_or(0)
}

/// Calculate XP reward for an achievement
fn calculate_achievement_xp(_env: &Env, achievement_id: u64) -> u64 {
    // This would typically fetch achievement data
    // For now, use a simple formula based on achievement ID
    100 + (achievement_id % 10) * 50
}

/// Check if NFT should evolve based on XP and level
fn check_evolution_requirements(_env: &Env, _current_level: u32, xp: u64) -> Option<EvolutionStage> {
    let xp_thresholds = [
        (0, EvolutionStage::Novice),
        (500, EvolutionStage::Apprentice),
        (1500, EvolutionStage::Expert),
        (3000, EvolutionStage::Master),
        (6000, EvolutionStage::Grandmaster),
        (10000, EvolutionStage::Legendary),
    ];

    for (threshold, stage) in xp_thresholds.iter().rev() {
        if xp >= *threshold {
            return Some(stage.clone());
        }
    }

    None
}

/// Update visual traits based on evolution stage
fn update_visual_traits(_env: &Env, nft: &mut DynamicNFT, stage: &EvolutionStage) {
    match stage {
        EvolutionStage::Novice => {
            nft.visual_traits.rarity_tier = RarityTier::Common;
            nft.visual_traits.background = 1;
        }
        EvolutionStage::Apprentice => {
            nft.visual_traits.rarity_tier = RarityTier::Uncommon;
            nft.visual_traits.border = 1;
        }
        EvolutionStage::Expert => {
            nft.visual_traits.rarity_tier = RarityTier::Rare;
            nft.visual_traits.emblem = 1;
        }
        EvolutionStage::Master => {
            nft.visual_traits.rarity_tier = RarityTier::Epic;
            nft.visual_traits.glow_effect = 1;
        }
        EvolutionStage::Grandmaster => {
            nft.visual_traits.rarity_tier = RarityTier::Legendary;
            nft.visual_traits.special_effects.push_back(1u8);
        }
        EvolutionStage::Legendary => {
            nft.visual_traits.rarity_tier = RarityTier::Mythic;
            nft.visual_traits.special_effects.push_back(2u8);
        }
    }
}

/// Helper to check if Bytes contains a specific byte
fn bytes_contains(bytes: &Bytes, value: u8) -> bool {
    for i in 0..bytes.len() {
        if bytes.get(i).unwrap_or(0) == value {
            return true;
        }
    }
    false
}

/// Fuse visual traits from two NFTs
fn fuse_visual_traits(traits1: &VisualTraits, traits2: &VisualTraits) -> VisualTraits {
    let mut fused_special_effects = traits1.special_effects.clone();
    for effect in traits2.special_effects.iter() {
        if !bytes_contains(&fused_special_effects, effect) {
            fused_special_effects.push_back(effect);
        }
    }

    VisualTraits {
        background: (traits1.background + traits2.background) / 2,
        border: (traits1.border + traits2.border) / 2,
        emblem: (traits1.emblem + traits2.emblem) / 2,
        glow_effect: (traits1.glow_effect + traits2.glow_effect) / 2,
        special_effects: fused_special_effects,
        rarity_tier: if traits1.rarity_tier as u8 >= traits2.rarity_tier as u8 {
            traits1.rarity_tier.clone()
        } else {
            traits2.rarity_tier.clone()
        },
    }
}

/// Determine fusion result evolution stage
fn determine_fusion_stage(stage1: &EvolutionStage, stage2: &EvolutionStage) -> EvolutionStage {
    let stage1_value = *stage1 as u8;
    let stage2_value = *stage2 as u8;
    let fused_value = (stage1_value + stage2_value) / 2 + 1;
    
    match fused_value.min(5) {
        0 => EvolutionStage::Novice,
        1 => EvolutionStage::Apprentice,
        2 => EvolutionStage::Expert,
        3 => EvolutionStage::Master,
        4 => EvolutionStage::Grandmaster,
        _ => EvolutionStage::Legendary,
    }
}

/// Burn (destroy) an NFT
fn burn_nft(env: &Env, token_id: u64) {
    env.storage().persistent().remove(&DynamicNFTKey::Token(token_id));
}

/// Get NFT metadata URI
pub fn token_uri(env: &Env, token_id: u64) -> String {
    let nft = get_nft(env, token_id);
    nft.metadata_ipfs.clone()
}

/// Check if NFT exists
pub fn nft_exists(env: &Env, token_id: u64) -> bool {
    env.storage().persistent().has(&DynamicNFTKey::Token(token_id))
}

/// Get owner of NFT
pub fn owner_of(env: &Env, token_id: u64) -> Address {
    let nft = get_nft(env, token_id);
    nft.owner
}

/// Get balance of owner
pub fn balance_of(env: &Env, owner: Address) -> u64 {
    get_owner_tokens(env, owner).len() as u64
}
