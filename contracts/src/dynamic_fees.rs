#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, symbol_short, U256};

/// Dynamic fee calculation based on network conditions, user behavior, and platform incentives
#[contracttype]
#[derive(Clone)]
pub struct DynamicFeeConfig {
    pub base_fee: u64,                    // Base fee in stroops (1 stroop = 0.000001 XLM)
    pub network_multiplier: u32,          // Network load multiplier (percentage)
    pub volatility_factor: u32,           // Price volatility factor (percentage)
    pub congestion_threshold: u64,        // Transactions per block threshold
    pub smoothing_factor: u32,            // Fee smoothing factor (percentage)
    pub max_fee_increase: u32,           // Maximum fee increase per block (percentage)
    pub min_fee_decrease: u32,           // Minimum fee decrease per block (percentage)
}

/// User behavior metrics for fee adjustments
#[contracttype]
#[derive(Clone)]
pub struct UserBehaviorMetrics {
    pub user: Address,
    pub transaction_count: u64,          // Total transactions
    pub successful_transactions: u64,    // Successful transactions
    pub failed_transactions: u64,         // Failed transactions
    pub average_transaction_value: u64,   // Average value in stroops
    pub last_activity_timestamp: u64,     // Last activity timestamp
    pub reputation_score: u64,           // User reputation (0-1000)
    pub abuse_score: u64,                 // Abuse detection score (0-1000)
    pub streak_days: u32,                 // Consecutive days of good behavior
}

/// Fee discount tiers based on reputation and behavior
#[contracttype]
#[derive(Clone)]
pub struct FeeDiscountTier {
    pub tier_id: u8,
    pub min_reputation: u64,
    pub discount_percentage: u32,
    pub requirements: String,            // JSON string of requirements
}

/// Incentive rewards for good behavior
#[contracttype]
#[derive(Clone)]
pub struct IncentiveReward {
    pub reward_id: u64,
    pub user: Address,
    pub reward_type: RewardType,
    pub amount: u64,
    pub reason: String,
    pub timestamp: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum RewardType {
    FeeDiscount,
    Cashback,
    ReputationBoost,
    ExclusiveAccess,
}

/// Network condition metrics
#[contracttype]
#[derive(Clone)]
pub struct NetworkMetrics {
    pub current_block_time: u64,
    pub transactions_per_block: u64,
    pub average_fee: u64,
    pub network_utilization: u32,        // Percentage
    pub congestion_level: CongestionLevel,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum CongestionLevel {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}

/// Fee calculation result with breakdown
#[contracttype]
#[derive(Clone)]
pub struct FeeCalculation {
    pub base_fee: u64,
    pub network_adjustment: u64,
    pub user_discount: u64,
    pub incentive_discount: u64,
    pub abuse_premium: u64,
    pub final_fee: u64,
    pub calculation_timestamp: u64,
    pub breakdown: String,               // JSON string of detailed breakdown
}

/// Anti-abuse detection metrics
#[contracttype]
#[derive(Clone)]
pub struct AbuseDetection {
    pub user: Address,
    pub rapid_transactions: u32,          // Transactions in short time window
    pub unusual_patterns: bool,          // Flag for unusual behavior
    pub suspicious_amounts: bool,        // Flag for suspicious transaction amounts
    pub blocked_until: u64,             // Timestamp until which user is blocked
    pub violation_count: u32,            // Total violations
}

/// Storage keys for fee system
#[contracttype]
pub enum FeeKey {
    Config,
    NetworkMetrics,
    UserMetrics(Address),
    DiscountTier(u8),
    Reward(u64),
    AbuseDetection(Address),
    FeeHistory(Address),
    NetworkHistory(u64),
    TotalRewards,
    RewardCount,
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct DynamicFeeContract;

#[contractimpl]
impl DynamicFeeContract {
    /// Initialize the dynamic fee system
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&FeeKey::Config) {
            panic!("Fee system already initialized");
        }
        
        // Set initial configuration
        let config = DynamicFeeConfig {
            base_fee: 1000u64,              // 0.001 XLM base fee
            network_multiplier: 100u32,      // 100% (no change)
            volatility_factor: 50u32,        // 50% volatility factor
            congestion_threshold: 100u64,     // 100 transactions per block
            smoothing_factor: 80u32,         // 80% smoothing
            max_fee_increase: 200u32,        // Max 200% increase per block
            min_fee_decrease: 50u32,         // Min 50% decrease per block
        };
        
        env.storage().instance().set(&FeeKey::Config, &config);
        env.storage().instance().set(&FeeKey::TotalRewards, &0u64);
        env.storage().instance().set(&FeeKey::RewardCount, &0u64);
        
        // Initialize discount tiers
        Self::initialize_discount_tiers(&env);
    }

    /// Calculate dynamic fee for a transaction
    pub fn calculate_fee(
        env: Env,
        user: Address,
        transaction_value: u64,
        transaction_type: String,
    ) -> FeeCalculation {
        let config: DynamicFeeConfig = env.storage().instance()
            .get(&FeeKey::Config)
            .unwrap_or_else(|| panic!("Fee config not found"));
        
        let network_metrics = Self::get_current_network_metrics(&env);
        let user_metrics = Self::get_or_create_user_metrics(&env, user.clone());
        
        // Start with base fee
        let mut base_fee = config.base_fee;
        
        // Adjust for network conditions
        let network_adjustment = Self::calculate_network_adjustment(&config, &network_metrics);
        let mut adjusted_fee = base_fee * network_adjustment / 100u64;
        
        // Apply user behavior discounts
        let user_discount = Self::calculate_user_discount(&env, &user_metrics);
        adjusted_fee = adjusted_fee * (100u64 - user_discount) / 100u64;
        
        // Apply incentive discounts
        let incentive_discount = Self::calculate_incentive_discount(&env, &user, &transaction_type);
        adjusted_fee = adjusted_fee * (100u64 - incentive_discount) / 100u64;
        
        // Apply abuse premium if needed
        let abuse_premium = Self::calculate_abuse_premium(&env, &user);
        adjusted_fee += abuse_premium;
        
        // Apply fee smoothing
        let smoothed_fee = Self::apply_fee_smoothing(&config, adjusted_fee, base_fee);
        
        let final_fee = smoothed_fee;
        
        let calculation = FeeCalculation {
            base_fee,
            network_adjustment: adjusted_fee - base_fee,
            user_discount: base_fee * user_discount / 100u64,
            incentive_discount: base_fee * incentive_discount / 100u64,
            abuse_premium,
            final_fee,
            calculation_timestamp: env.ledger().timestamp(),
            breakdown: Self::create_fee_breakdown(&config, &network_metrics, &user_metrics),
        };
        
        // Store fee history
        Self::store_fee_history(&env, user.clone(), calculation.clone());
        
        calculation
    }

    /// Update network metrics
    pub fn update_network_metrics(env: Env, metrics: NetworkMetrics) {
        env.storage().instance().set(&FeeKey::NetworkMetrics, &metrics);
        
        // Store in history for analysis
        let timestamp = env.ledger().timestamp();
        env.storage().instance().set(&FeeKey::NetworkHistory(timestamp), &metrics);
    }

    /// Update user behavior metrics
    pub fn update_user_metrics(
        env: Env,
        user: Address,
        success: bool,
        transaction_value: u64,
    ) {
        let mut metrics = Self::get_or_create_user_metrics(&env, user.clone());
        
        metrics.transaction_count += 1;
        if success {
            metrics.successful_transactions += 1;
            metrics.streak_days += 1;
        } else {
            metrics.failed_transactions += 1;
            metrics.streak_days = 0;
        }
        
        // Update average transaction value
        let total_value = metrics.average_transaction_value * (metrics.transaction_count - 1) + transaction_value;
        metrics.average_transaction_value = total_value / metrics.transaction_count;
        
        metrics.last_activity_timestamp = env.ledger().timestamp();
        
        // Update reputation score
        metrics.reputation_score = Self::calculate_reputation_score(&metrics);
        
        // Check for abuse patterns
        Self::check_abuse_patterns(&env, &user, &metrics);
        
        env.storage().instance().set(&FeeKey::UserMetrics(user), &metrics);
    }

    /// Get current fee for a user
    pub fn get_current_fee(env: Env, user: Address, transaction_value: u64) -> u64 {
        let calculation = Self::calculate_fee(env, user, transaction_value, "standard".into_val(env));
        calculation.final_fee
    }

    /// Get user's current discount tier
    pub fn get_user_discount_tier(env: Env, user: Address) -> FeeDiscountTier {
        let metrics = Self::get_or_create_user_metrics(&env, user);
        
        // Find appropriate discount tier
        for tier_id in 1..=5u8 {
            if let Some(tier) = env.storage().instance().get::<_, FeeDiscountTier>(&FeeKey::DiscountTier(tier_id)) {
                if metrics.reputation_score >= tier.min_reputation {
                    return tier;
                }
            }
        }
        
        // Return default tier (no discount)
        FeeDiscountTier {
            tier_id: 0,
            min_reputation: 0,
            discount_percentage: 0,
            requirements: "No requirements".into_val(env),
        }
    }

    /// Issue incentive reward
    pub fn issue_reward(
        env: Env,
        admin: Address,
        user: Address,
        reward_type: RewardType,
        amount: u64,
        reason: String,
        duration_seconds: u64,
    ) -> u64 {
        let config: DynamicFeeConfig = env.storage().instance()
            .get(&FeeKey::Config)
            .unwrap_or_else(|| panic!("Fee config not found"));
        
        // Simple admin check (in production, use proper auth)
        let current_admin: Address = env.storage().instance()
            .get(&FeeKey::Config)
            .map(|_| Address::from_string(&env, "admin".into_val(env)))
            .unwrap_or_else(|| panic!("Admin not found"));
        
        if admin != current_admin {
            panic!("Only admin can issue rewards");
        }
        
        let reward_count: u64 = env.storage().instance()
            .get(&FeeKey::RewardCount)
            .unwrap_or(0);
        let reward_id = reward_count + 1;
        
        let reward = IncentiveReward {
            reward_id,
            user: user.clone(),
            reward_type,
            amount,
            reason,
            timestamp: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + duration_seconds,
        };
        
        env.storage().instance().set(&FeeKey::Reward(reward_id), &reward);
        env.storage().instance().set(&FeeKey::RewardCount, &reward_id);
        
        // Update user reputation for positive rewards
        if matches!(reward_type, RewardType::ReputationBoost) {
            Self::boost_user_reputation(&env, user, amount);
        }
        
        reward_id
    }

    /// Get fee transparency report
    pub fn get_fee_report(env: Env, user: Address) -> String {
        let metrics = Self::get_or_create_user_metrics(&env, user.clone());
        let current_tier = Self::get_user_discount_tier(env, user);
        let network_metrics = Self::get_current_network_metrics(&env);
        
        format!(
            "Fee Report for User: {:?}\n\
             Reputation Score: {}\n\
             Current Discount Tier: {} ({}% discount)\n\
             Total Transactions: {}\n\
             Success Rate: {:.2}%\n\
             Network Congestion: {:?}\n\
             Current Base Fee: {} stroops\n\
             Estimated Fee: {} stroops",
            user,
            metrics.reputation_score,
            current_tier.tier_id,
            current_tier.discount_percentage,
            metrics.transaction_count,
            (metrics.successful_transactions as f64 / metrics.transaction_count as f64) * 100.0,
            network_metrics.congestion_level,
            1000u64, // Base fee
            Self::estimate_current_fee(&env, user)
        )
    }

    // ===== Private Helper Functions =====

    fn initialize_discount_tiers(env: &Env) {
        let tiers = vec![
            FeeDiscountTier {
                tier_id: 1,
                min_reputation: 100,
                discount_percentage: 5,
                requirements: "Basic reputation requirements".into_val(env),
            },
            FeeDiscountTier {
                tier_id: 2,
                min_reputation: 250,
                discount_percentage: 10,
                requirements: "Good standing, 50+ transactions".into_val(env),
            },
            FeeDiscountTier {
                tier_id: 3,
                min_reputation: 500,
                discount_percentage: 20,
                requirements: "Excellent reputation, 100+ transactions".into_val(env),
            },
            FeeDiscountTier {
                tier_id: 4,
                min_reputation: 750,
                discount_percentage: 35,
                requirements: "Outstanding reputation, 200+ transactions".into_val(env),
            },
            FeeDiscountTier {
                tier_id: 5,
                min_reputation: 900,
                discount_percentage: 50,
                requirements: "Elite status, 500+ transactions, 1+ year activity".into_val(env),
            },
        ];
        
        for tier in tiers {
            env.storage().instance().set(&FeeKey::DiscountTier(tier.tier_id), &tier);
        }
    }

    fn get_current_network_metrics(env: &Env) -> NetworkMetrics {
        env.storage().instance()
            .get(&FeeKey::NetworkMetrics)
            .unwrap_or_else(|| NetworkMetrics {
                current_block_time: 5000, // 5 seconds
                transactions_per_block: 10,
                average_fee: 1000,
                network_utilization: 30,
                congestion_level: CongestionLevel::Low,
                timestamp: env.ledger().timestamp(),
            })
    }

    fn get_or_create_user_metrics(env: &Env, user: Address) -> UserBehaviorMetrics {
        env.storage().instance()
            .get(&FeeKey::UserMetrics(user.clone()))
            .unwrap_or_else(|| UserBehaviorMetrics {
                user: user.clone(),
                transaction_count: 0,
                successful_transactions: 0,
                failed_transactions: 0,
                average_transaction_value: 0,
                last_activity_timestamp: 0,
                reputation_score: 100, // Start with neutral reputation
                abuse_score: 0,
                streak_days: 0,
            })
    }

    fn calculate_network_adjustment(config: &DynamicFeeConfig, metrics: &NetworkMetrics) -> u64 {
        let base_multiplier = match metrics.congestion_level {
            CongestionLevel::Low => 100u64,
            CongestionLevel::Medium => 150u64,
            CongestionLevel::High => 200u64,
            CongestionLevel::Critical => 300u64,
        };
        
        // Apply network utilization factor
        let utilization_factor = 100u64 + (metrics.network_utilization as u64 - 50) / 2;
        
        base_multiplier * utilization_factor / 100u64
    }

    fn calculate_user_discount(env: &Env, metrics: &UserBehaviorMetrics) -> u64 {
        let tier = Self::get_user_discount_tier(env.clone(), metrics.user.clone());
        
        let mut discount = tier.discount_percentage as u64;
        
        // Additional discounts for good behavior streaks
        if metrics.streak_days >= 30 {
            discount += 5;
        } else if metrics.streak_days >= 7 {
            discount += 2;
        }
        
        // High success rate bonus
        if metrics.transaction_count > 0 {
            let success_rate = metrics.successful_transactions * 100 / metrics.transaction_count;
            if success_rate >= 95 {
                discount += 3;
            } else if success_rate >= 90 {
                discount += 1;
            }
        }
        
        discount.min(50) // Cap at 50% discount
    }

    fn calculate_incentive_discount(env: &Env, user: &Address, transaction_type: &String) -> u64 {
        // Check for active rewards
        let current_time = env.ledger().timestamp();
        let reward_count: u64 = env.storage().instance()
            .get(&FeeKey::RewardCount)
            .unwrap_or(0);
        
        let mut total_discount = 0u64;
        
        for reward_id in 1..=reward_count {
            if let Some(reward) = env.storage().instance().get::<_, IncentiveReward>(&FeeKey::Reward(reward_id)) {
                if reward.user == *user && reward.expires_at > current_time {
                    match reward.reward_type {
                        RewardType::FeeDiscount => {
                            total_discount += reward.amount;
                        }
                        _ => {}
                    }
                }
            }
        }
        
        total_discount.min(25) // Cap incentive discount at 25%
    }

    fn calculate_abuse_premium(env: &Env, user: &Address) -> u64 {
        if let Some(abuse) = env.storage().instance().get::<_, AbuseDetection>(&FeeKey::AbuseDetection(user.clone())) {
            let current_time = env.ledger().timestamp();
            
            if abuse.blocked_until > current_time {
                return 10000; // Very high premium if blocked
            }
            
            // Premium based on abuse score
            match abuse.abuse_score {
                0..=100 => 0,
                101..=300 => 500,
                301..=500 => 2000,
                501..=700 => 5000,
                _ => 10000,
            }
        } else {
            0
        }
    }

    fn apply_fee_smoothing(config: &DynamicFeeConfig, new_fee: u64, base_fee: u64) -> u64 {
        let max_increase = base_fee * config.max_fee_increase as u64 / 100u64;
        let min_decrease = base_fee * config.min_fee_decrease as u64 / 100u64;
        
        if new_fee > base_fee + max_increase {
            base_fee + max_increase
        } else if new_fee < base_fee - min_decrease {
            base_fee - min_decrease
        } else {
            new_fee
        }
    }

    fn calculate_reputation_score(metrics: &UserBehaviorMetrics) -> u64 {
        let mut score = 100u64; // Base score
        
        // Success rate component
        if metrics.transaction_count > 0 {
            let success_rate = metrics.successful_transactions * 100 / metrics.transaction_count;
            score += success_rate;
        }
        
        // Transaction volume component
        score += (metrics.transaction_count / 10).min(200);
        
        // Streak bonus
        score += (metrics.streak_days * 2).min(100);
        
        // Abuse penalty
        score -= metrics.abuse_score / 10;
        
        score.min(1000).max(0)
    }

    fn check_abuse_patterns(env: &Env, user: &Address, metrics: &UserBehaviorMetrics) {
        let current_time = env.ledger().timestamp();
        let mut abuse = env.storage().instance()
            .get(&FeeKey::AbuseDetection(user.clone()))
            .unwrap_or_else(|| AbuseDetection {
                user: user.clone(),
                rapid_transactions: 0,
                unusual_patterns: false,
                suspicious_amounts: false,
                blocked_until: 0,
                violation_count: 0,
            });
        
        // Check for rapid transactions (more than 10 in 5 minutes)
        if current_time - metrics.last_activity_timestamp < 300 {
            abuse.rapid_transactions += 1;
            if abuse.rapid_transactions > 10 {
                abuse.abuse_score += 50;
                abuse.violation_count += 1;
            }
        } else {
            abuse.rapid_transactions = 0;
        }
        
        // Check for unusual patterns (high failure rate)
        if metrics.transaction_count > 0 {
            let failure_rate = metrics.failed_transactions * 100 / metrics.transaction_count;
            if failure_rate > 50 {
                abuse.unusual_patterns = true;
                abuse.abuse_score += 30;
            }
        }
        
        // Block user if abuse score is too high
        if abuse.abuse_score > 800 {
            abuse.blocked_until = current_time + 3600; // Block for 1 hour
        }
        
        env.storage().instance().set(&FeeKey::AbuseDetection(user.clone()), &abuse);
    }

    fn store_fee_history(env: &Env, user: Address, calculation: FeeCalculation) {
        let key = FeeKey::FeeHistory(user);
        let mut history: Vec<FeeCalculation> = env.storage().instance()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        
        history.push_back(calculation);
        
        // Keep only last 100 entries
        if history.len() > 100 {
            history.remove(0);
        }
        
        env.storage().instance().set(&key, &history);
    }

    fn create_fee_breakdown(
        config: &DynamicFeeConfig,
        network_metrics: &NetworkMetrics,
        user_metrics: &UserBehaviorMetrics,
    ) -> String {
        format!(
            "Network Level: {:?}, Utilization: {}%, User Reputation: {}, Success Rate: {:.2}%",
            network_metrics.congestion_level,
            network_metrics.network_utilization,
            user_metrics.reputation_score,
            if user_metrics.transaction_count > 0 {
                (user_metrics.successful_transactions as f64 / user_metrics.transaction_count as f64) * 100.0
            } else {
                0.0
            }
        )
    }

    fn boost_user_reputation(env: &Env, user: Address, boost_amount: u64) {
        let mut metrics = Self::get_or_create_user_metrics(env, user.clone());
        metrics.reputation_score = (metrics.reputation_score + boost_amount).min(1000);
        env.storage().instance().set(&FeeKey::UserMetrics(user), &metrics);
    }

    fn estimate_current_fee(env: &Env, user: Address) -> u64 {
        let calculation = Self::calculate_fee(env.clone(), user, 1000, "standard".into_val(env));
        calculation.final_fee
    }
}
