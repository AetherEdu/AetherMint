use alloc::format;
use alloc::vec;
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct DynamicFeeConfig {
    pub base_fee: u64,
    pub network_multiplier: u32,
    pub volatility_factor: u32,
    pub congestion_threshold: u64,
    pub smoothing_factor: u32,
    pub max_fee_increase: u32,
    pub min_fee_decrease: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct UserBehaviorMetrics {
    pub user: Address,
    pub transaction_count: u64,
    pub successful_transactions: u64,
    pub failed_transactions: u64,
    pub average_transaction_value: u64,
    pub last_activity_timestamp: u64,
    pub reputation_score: u64,
    pub abuse_score: u64,
    pub streak_days: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct FeeDiscountTier {
    pub tier_id: u32,
    pub min_reputation: u64,
    pub discount_percentage: u32,
    pub requirements: String,
}

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

#[contracttype]
#[derive(Clone)]
pub struct NetworkMetrics {
    pub current_block_time: u64,
    pub transactions_per_block: u64,
    pub average_fee: u64,
    pub network_utilization: u32,
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
    pub breakdown: String,
}

#[contracttype]
#[derive(Clone)]
pub struct AbuseDetection {
    pub user: Address,
    pub rapid_transactions: u32,
    pub unusual_patterns: bool,
    pub suspicious_amounts: bool,
    pub blocked_until: u64,
    pub violation_count: u32,
    pub abuse_score: u64,
}

#[contracttype]
pub enum FeeKey {
    Config,
    NetworkMetrics,
    UserMetrics(Address),
    DiscountTier(u32),
    Reward(u64),
    AbuseDetection(Address),
    FeeHistory(Address),
    NetworkHistory(u64),
    TotalRewards,
    RewardCount,
}

pub fn initialize(env: &Env, admin: &Address) {
    if env.storage().instance().has(&FeeKey::Config) {
        panic!("Fee system already initialized");
    }

    let config = DynamicFeeConfig {
        base_fee: 1000u64,
        network_multiplier: 100u32,
        volatility_factor: 50u32,
        congestion_threshold: 100u64,
        smoothing_factor: 80u32,
        max_fee_increase: 200u32,
        min_fee_decrease: 50u32,
    };

    env.storage().instance().set(&FeeKey::Config, &config);
    env.storage().instance().set(&FeeKey::TotalRewards, &0u64);
    env.storage().instance().set(&FeeKey::RewardCount, &0u64);

    initialize_discount_tiers(env);
}

fn initialize_discount_tiers(env: &Env) {
    let tiers = vec![
        FeeDiscountTier {
            tier_id: 1,
            min_reputation: 100,
            discount_percentage: 5,
            requirements: String::from_str(env, "Basic reputation requirements"),
        },
        FeeDiscountTier {
            tier_id: 2,
            min_reputation: 250,
            discount_percentage: 10,
            requirements: String::from_str(env, "Good standing, 50+ transactions"),
        },
        FeeDiscountTier {
            tier_id: 3,
            min_reputation: 500,
            discount_percentage: 20,
            requirements: String::from_str(env, "Excellent reputation, 100+ transactions"),
        },
        FeeDiscountTier {
            tier_id: 4,
            min_reputation: 750,
            discount_percentage: 35,
            requirements: String::from_str(env, "Outstanding reputation, 200+ transactions"),
        },
        FeeDiscountTier {
            tier_id: 5,
            min_reputation: 900,
            discount_percentage: 50,
            requirements: String::from_str(
                env,
                "Elite status, 500+ transactions, 1+ year activity",
            ),
        },
    ];

    for tier in tiers {
        env.storage()
            .instance()
            .set(&FeeKey::DiscountTier(tier.tier_id), &tier);
    }
}

pub fn get_current_network_metrics(env: &Env) -> NetworkMetrics {
    env.storage()
        .instance()
        .get(&FeeKey::NetworkMetrics)
        .unwrap_or_else(|| NetworkMetrics {
            current_block_time: 5000,
            transactions_per_block: 10,
            average_fee: 1000,
            network_utilization: 30,
            congestion_level: CongestionLevel::Low,
            timestamp: env.ledger().timestamp(),
        })
}

pub fn get_or_create_user_metrics(env: &Env, user: &Address) -> UserBehaviorMetrics {
    env.storage()
        .instance()
        .get(&FeeKey::UserMetrics(user.clone()))
        .unwrap_or_else(|| UserBehaviorMetrics {
            user: user.clone(),
            transaction_count: 0,
            successful_transactions: 0,
            failed_transactions: 0,
            average_transaction_value: 0,
            last_activity_timestamp: 0,
            reputation_score: 100,
            abuse_score: 0,
            streak_days: 0,
        })
}

pub fn get_user_discount_tier(env: &Env, user: &Address) -> FeeDiscountTier {
    let metrics = get_or_create_user_metrics(env, user);

    for tier_id in 1..=5u32 {
        if let Some(tier) = env
            .storage()
            .instance()
            .get::<_, FeeDiscountTier>(&FeeKey::DiscountTier(tier_id))
        {
            if metrics.reputation_score >= tier.min_reputation {
                return tier;
            }
        }
    }

    FeeDiscountTier {
        tier_id: 0,
        min_reputation: 0,
        discount_percentage: 0,
        requirements: String::from_str(env, "No requirements"),
    }
}

fn calculate_user_discount(env: &Env, metrics: &UserBehaviorMetrics) -> u64 {
    let tier = get_user_discount_tier(env, &metrics.user);

    let mut discount = tier.discount_percentage as u64;

    if metrics.streak_days >= 30 {
        discount += 5;
    } else if metrics.streak_days >= 7 {
        discount += 2;
    }

    if metrics.transaction_count > 0 {
        let success_rate = metrics.successful_transactions * 100 / metrics.transaction_count;
        if success_rate >= 95 {
            discount += 3;
        } else if success_rate >= 90 {
            discount += 1;
        }
    }

    discount.min(50)
}

fn calculate_network_adjustment(config: &DynamicFeeConfig, metrics: &NetworkMetrics) -> u64 {
    let base_multiplier = match metrics.congestion_level {
        CongestionLevel::Low => 100u64,
        CongestionLevel::Medium => 150u64,
        CongestionLevel::High => 200u64,
        CongestionLevel::Critical => 300u64,
    };

    let utilization_factor = 100u64 + (metrics.network_utilization as u64 - 50) / 2;

    base_multiplier * utilization_factor / 100u64
}

fn calculate_incentive_discount(env: &Env, user: &Address) -> u64 {
    let current_time = env.ledger().timestamp();
    let reward_count: u64 = env
        .storage()
        .instance()
        .get(&FeeKey::RewardCount)
        .unwrap_or(0);

    let mut total_discount = 0u64;

    for reward_id in 1..=reward_count {
        if let Some(reward) = env
            .storage()
            .instance()
            .get::<_, IncentiveReward>(&FeeKey::Reward(reward_id))
        {
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

    total_discount.min(25)
}

fn calculate_abuse_premium(env: &Env, user: &Address) -> u64 {
    if let Some(abuse) = env
        .storage()
        .instance()
        .get::<_, AbuseDetection>(&FeeKey::AbuseDetection(user.clone()))
    {
        let current_time = env.ledger().timestamp();

        if abuse.blocked_until > current_time {
            return 10000;
        }

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
    let mut score = 100u64;

    if metrics.transaction_count > 0 {
        let success_rate = metrics.successful_transactions * 100 / metrics.transaction_count;
        score += success_rate;
    }

    score += (metrics.transaction_count / 10).min(200);
    score += (metrics.streak_days as u64 * 2).min(100);
    score -= metrics.abuse_score / 10;

    score.min(1000).max(0)
}

fn check_abuse_patterns(env: &Env, user: &Address, metrics: &UserBehaviorMetrics) {
    let current_time = env.ledger().timestamp();
    let mut abuse = env
        .storage()
        .instance()
        .get(&FeeKey::AbuseDetection(user.clone()))
        .unwrap_or_else(|| AbuseDetection {
            user: user.clone(),
            rapid_transactions: 0,
            unusual_patterns: false,
            suspicious_amounts: false,
            blocked_until: 0,
            violation_count: 0,
            abuse_score: 0,
        });

    if current_time - metrics.last_activity_timestamp < 300 {
        abuse.rapid_transactions += 1;
        if abuse.rapid_transactions > 10 {
            abuse.abuse_score += 50;
            abuse.violation_count += 1;
        }
    } else {
        abuse.rapid_transactions = 0;
    }

    if metrics.transaction_count > 0 {
        let failure_rate = metrics.failed_transactions * 100 / metrics.transaction_count;
        if failure_rate > 50 {
            abuse.unusual_patterns = true;
            abuse.abuse_score += 30;
        }
    }

    if abuse.abuse_score > 800 {
        abuse.blocked_until = current_time + 3600;
    }

    env.storage()
        .instance()
        .set(&FeeKey::AbuseDetection(user.clone()), &abuse);
}

fn store_fee_history(env: &Env, user: &Address, calculation: &FeeCalculation) {
    let key = FeeKey::FeeHistory(user.clone());
    let mut history: Vec<FeeCalculation> = env
        .storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    history.push_back(calculation.clone());

    if history.len() > 100 {
        history.remove(0);
    }

    env.storage().instance().set(&key, &history);
}

fn create_fee_breakdown(
    env: &Env,
    _config: &DynamicFeeConfig,
    network_metrics: &NetworkMetrics,
    user_metrics: &UserBehaviorMetrics,
) -> String {
    let success_rate = if user_metrics.transaction_count > 0 {
        user_metrics.successful_transactions * 100 / user_metrics.transaction_count
    } else {
        0
    };
    String::from_str(
        env,
        "Network Level: X, Utilization: Y%, User Reputation: Z, Success Rate: W%",
    )
}

fn boost_user_reputation(env: &Env, user: &Address, boost_amount: u64) {
    let mut metrics = get_or_create_user_metrics(env, user);
    metrics.reputation_score = (metrics.reputation_score + boost_amount).min(1000);
    env.storage()
        .instance()
        .set(&FeeKey::UserMetrics(user.clone()), &metrics);
}

fn estimate_current_fee(env: &Env, user: &Address) -> u64 {
    let calculation = calculate_fee(env.clone(), user.clone(), 1000);
    calculation.final_fee
}

pub fn calculate_fee(env: Env, user: Address, transaction_value: u64) -> FeeCalculation {
    let config: DynamicFeeConfig = env
        .storage()
        .instance()
        .get(&FeeKey::Config)
        .unwrap_or_else(|| panic!("Fee config not found"));

    let network_metrics = get_current_network_metrics(&env);
    let user_metrics = get_or_create_user_metrics(&env, &user);

    let base_fee = config.base_fee;

    let network_adjustment = calculate_network_adjustment(&config, &network_metrics);
    let mut adjusted_fee = base_fee * network_adjustment / 100u64;

    let user_discount = calculate_user_discount(&env, &user_metrics);
    adjusted_fee = adjusted_fee * (100u64 - user_discount) / 100u64;

    let incentive_discount = calculate_incentive_discount(&env, &user);
    adjusted_fee = adjusted_fee * (100u64 - incentive_discount) / 100u64;

    let abuse_premium = calculate_abuse_premium(&env, &user);
    adjusted_fee += abuse_premium;

    let smoothed_fee = apply_fee_smoothing(&config, adjusted_fee, base_fee);

    let final_fee = smoothed_fee;

    let calculation = FeeCalculation {
        base_fee,
        network_adjustment: adjusted_fee - base_fee,
        user_discount: base_fee * user_discount / 100u64,
        incentive_discount: base_fee * incentive_discount / 100u64,
        abuse_premium,
        final_fee,
        calculation_timestamp: env.ledger().timestamp(),
        breakdown: create_fee_breakdown(&env, &config, &network_metrics, &user_metrics),
    };

    store_fee_history(&env, &user, &calculation);

    calculation
}

pub fn update_network_metrics(env: &Env, metrics: &NetworkMetrics) {
    env.storage()
        .instance()
        .set(&FeeKey::NetworkMetrics, metrics);

    let timestamp = env.ledger().timestamp();
    env.storage()
        .instance()
        .set(&FeeKey::NetworkHistory(timestamp), metrics);
}

pub fn update_user_metrics(env: &Env, user: &Address, success: bool, transaction_value: u64) {
    let mut metrics = get_or_create_user_metrics(env, user);

    metrics.transaction_count += 1;
    if success {
        metrics.successful_transactions += 1;
        metrics.streak_days += 1;
    } else {
        metrics.failed_transactions += 1;
        metrics.streak_days = 0;
    }

    let total_value =
        metrics.average_transaction_value * (metrics.transaction_count - 1) + transaction_value;
    metrics.average_transaction_value = total_value / metrics.transaction_count;

    metrics.last_activity_timestamp = env.ledger().timestamp();
    metrics.reputation_score = calculate_reputation_score(&metrics);

    check_abuse_patterns(env, user, &metrics);

    env.storage()
        .instance()
        .set(&FeeKey::UserMetrics(user.clone()), &metrics);
}

pub fn get_current_fee(env: &Env, user: &Address, transaction_value: u64) -> u64 {
    let calculation = calculate_fee(env.clone(), user.clone(), transaction_value);
    calculation.final_fee
}

pub fn issue_reward(
    env: &Env,
    _admin: &Address,
    user: &Address,
    reward_type: RewardType,
    amount: u64,
    reason: &String,
    duration_seconds: u64,
) -> u64 {
    let _config: DynamicFeeConfig = env
        .storage()
        .instance()
        .get(&FeeKey::Config)
        .unwrap_or_else(|| panic!("Fee config not found"));

    let reward_count: u64 = env
        .storage()
        .instance()
        .get(&FeeKey::RewardCount)
        .unwrap_or(0);
    let reward_id = reward_count + 1;

    let is_reputation_boost = matches!(reward_type, RewardType::ReputationBoost);

    let reward = IncentiveReward {
        reward_id,
        user: user.clone(),
        reward_type,
        amount,
        reason: reason.clone(),
        timestamp: env.ledger().timestamp(),
        expires_at: env.ledger().timestamp() + duration_seconds,
    };

    env.storage()
        .instance()
        .set(&FeeKey::Reward(reward_id), &reward);
    env.storage()
        .instance()
        .set(&FeeKey::RewardCount, &reward_id);

    if is_reputation_boost {
        boost_user_reputation(env, user, amount);
    }

    reward_id
}

pub fn calculate_marketplace_fee(env: Env, seller: Address, price: u64) -> u64 {
    let _config: DynamicFeeConfig = env
        .storage()
        .instance()
        .get(&FeeKey::Config)
        .unwrap_or_else(|| DynamicFeeConfig {
            base_fee: 1000,
            network_multiplier: 100,
            volatility_factor: 50,
            congestion_threshold: 100,
            smoothing_factor: 80,
            max_fee_increase: 200,
            min_fee_decrease: 50,
        });

    let user_metrics = get_or_create_user_metrics(&env, &seller);
    let tier = get_user_discount_tier(&env, &seller);

    let base_fee_bps: u64 = 250;
    let discount = tier.discount_percentage as u64;

    let effective_discount = if user_metrics.reputation_score >= 100 {
        discount.min(200)
    } else {
        0
    };

    let adjusted_fee_bps = if effective_discount >= base_fee_bps {
        0
    } else {
        base_fee_bps - effective_discount
    };

    (price as u128 * adjusted_fee_bps as u128 / 10000) as u64
}
