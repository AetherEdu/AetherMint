use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
pub struct UserProgress {
    pub user: Address,
    pub course_id: String,
    pub lessons_completed: u32,
    pub total_lessons: u32,
    pub is_completed: bool,
    pub last_updated: u64,
}

#[contracttype]
pub enum ProgressKey {
    UserProgress(Address, String),
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct CourseProgressContract;

#[contractimpl]
impl CourseProgressContract {
    pub fn record_progress(
        env: Env,
        user: Address,
        course_id: String,
        lessons_completed: u32,
        total_lessons: u32,
    ) {
        user.require_auth();

        let is_completed = lessons_completed >= total_lessons;

        let progress = UserProgress {
            user: user.clone(),
            course_id: course_id.clone(),
            lessons_completed,
            total_lessons,
            is_completed,
            last_updated: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&ProgressKey::UserProgress(user, course_id), &progress);
    }

    pub fn get_progress(env: Env, user: Address, course_id: String) -> Option<UserProgress> {
        env.storage()
            .persistent()
            .get(&ProgressKey::UserProgress(user, course_id))
    }
}
