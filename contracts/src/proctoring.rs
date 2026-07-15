//! Proctoring session lifecycle and result verification.
//!
//! This module records the on-chain state for proctored exams so a later
//! credential issuance can be linked back to the verified session. It is kept
//! as a free-function module and surfaced through `AetherMintContract`
//! wrappers in `lib.rs`.

use crate::credential_registry;
use crate::utils::validation::{
    validate_non_zero_address, validate_string_length, MAX_METADATA_LENGTH, MAX_SHORT_TEXT_LENGTH,
};
use crate::DataKey;
use soroban_sdk::{
    contracterror, contracttype, panic_with_error, symbol_short, Address, BytesN, Env, String,
};
use crate::utils::pause::PauseUtils;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ProctoringError {
    SessionNotFound = 1,
    Unauthorized = 2,
    InvalidSessionState = 3,
    ResultAlreadySubmitted = 4,
    ChallengeAlreadyFiled = 5,
    ChallengeNotFound = 6,
    ResolutionAlreadyRecorded = 7,
    CredentialAlreadyLinked = 8,
    CredentialNotEligible = 9,
    AdminNotSet = 10,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProctoringStatus {
    Pending,
    InProgress,
    Completed,
    Challenged,
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ChallengeResolution {
    Upheld,
    Overturned,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringSession {
    pub id: u64,
    pub exam_id: String,
    pub student: Address,
    pub proctor: Address,
    pub status: ProctoringStatus,
    pub started_at: u64,
    pub completed_at: Option<u64>,
    pub challenged_at: Option<u64>,
    pub resolved_at: Option<u64>,
    pub linked_credential_id: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringResult {
    pub session_id: u64,
    pub result_data: String,
    pub proctor_signature: BytesN<64>,
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProctoringKey {
    SessionCount,
    Session(u64),
    SessionResult(u64),
    SessionChallenge(u64),
    SessionResolution(u64),
    SessionCredential(u64),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringChallenge {
    pub session_id: u64,
    pub challenger: Address,
    pub evidence: String,
    pub challenged_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringResolutionRecord {
    pub session_id: u64,
    pub admin: Address,
    pub resolution: ChallengeResolution,
    pub resolved_at: u64,
}

fn store_session(env: &Env, session: &ProctoringSession) {
    env.storage()
        .persistent()
        .set(&ProctoringKey::Session(session.id), session);
}

fn require_session(env: &Env, session_id: u64) -> ProctoringSession {
    env.storage()
        .persistent()
        .get(&ProctoringKey::Session(session_id))
        .unwrap_or_else(|| panic_with_error!(env, ProctoringError::SessionNotFound))
}

fn latest_session_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&ProctoringKey::SessionCount)
        .unwrap_or(0)
}

// Contract attribute disabled - this is a module used by main contract in lib.rs
// #[contract]
pub struct ProctoringContract;

#[contractimpl]
impl ProctoringContract {
    /// Initialize a new assessment session
    pub fn start_session(
        env: Env,
        student: Address,
        assessment_id: String,
        identity_hash: BytesN<32>,
    ) -> u64 {
        PauseUtils::require_not_paused(&env);
        student.require_auth();

        let session_id = env
            .storage()
            .instance()
            .get(&ProctoringKey::SessionCount)
            .unwrap_or(0u64)
            + 1;

        let session = AssessmentSession {
            id: session_id,
            student: student.clone(),
            assessment_id,
            start_time: env.ledger().timestamp(),
            end_time: None,
            identity_hash,
            status: 1, // Active
        };

        env.storage()
            .instance()
            .set(&ProctoringKey::Session(session_id), &session);
        env.storage()
            .instance()
            .set(&ProctoringKey::SessionCount, &session_id);

        env.events().publish(
            (symbol_short!("proctor"), symbol_short!("start")),
            (session_id, student),
        );

        session_id
    }
}

/// Log a behavioral event for the audit trail
pub fn log_behavioral_event(
    env: Env,
    session_id: u64,
    event_type: String,
    data_hash: BytesN<32>,
) {
    PauseUtils::require_not_paused(&env);
    let session: AssessmentSession = env
        .storage()
        .instance()
        .get(&ProctoringKey::Session(session_id))
        .unwrap_or_else(|| panic!("Session not found"));

    session.student.require_auth();

    if session.status != 1 {
        panic!("Session is not active");
    }

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("behavior")),
        (session_id, event_type, data_hash),
    );
}

fn set_session_count(env: &Env, session_id: u64) {
    env.storage()
        .instance()
        .set(&ProctoringKey::SessionCount, &session_id);
}

/// Initiate a new proctoring session for an exam.
pub fn start_proctoring_session(
    env: &Env,
    exam_id: String,
    student: Address,
    proctor: Address,
) -> u64 {
    validate_string_length(env, &exam_id, MAX_SHORT_TEXT_LENGTH);
    validate_non_zero_address(env, &student);
    validate_non_zero_address(env, &proctor);

    student.require_auth();
    proctor.require_auth();

    let session_id = latest_session_id(env) + 1;
    let session = ProctoringSession {
        id: session_id,
        exam_id: exam_id.clone(),
        student: student.clone(),
        proctor: proctor.clone(),
        status: ProctoringStatus::Pending,
        started_at: env.ledger().timestamp(),
        completed_at: None,
        challenged_at: None,
        resolved_at: None,
        linked_credential_id: None,
    };

    store_session(env, &session);
    set_session_count(env, session_id);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("start")),
        (session_id, student, proctor),
    );

    session_id
}

/// Record the proctor's submitted result for a session.
pub fn submit_proctoring_result(
    env: &Env,
    session_id: u64,
    result_data: String,
    proctor_signature: BytesN<64>,
) {
    validate_string_length(env, &result_data, MAX_METADATA_LENGTH);

    let mut session = require_session(env, session_id);

    session.proctor.require_auth();
    if session.status != ProctoringStatus::Pending
        && session.status != ProctoringStatus::InProgress
    {
        panic_with_error!(env, ProctoringError::InvalidSessionState);
    }

    session.status = ProctoringStatus::InProgress;
    store_session(env, &session);

    let result = ProctoringResult {
        session_id,
        result_data: result_data.clone(),
        proctor_signature,
        submitted_at: env.ledger().timestamp(),
    };

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionResult(session_id), &result);

    session.status = ProctoringStatus::Completed;
    session.completed_at = Some(result.submitted_at);
    store_session(env, &session);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("result")),
        (session_id, result_data),
    );
}

/// File a challenge against a completed proctoring result.
pub fn challenge_proctoring_result(
    env: &Env,
    session_id: u64,
    challenger: Address,
    evidence: String,
) {
    validate_non_zero_address(env, &challenger);
    validate_string_length(env, &evidence, MAX_METADATA_LENGTH);

    challenger.require_auth();
    let mut session = require_session(env, session_id);

    if session.linked_credential_id.is_some() {
        panic_with_error!(env, ProctoringError::CredentialAlreadyLinked);
    }

    if env
        .storage()
        .persistent()
        .get::<_, ProctoringResult>(&ProctoringKey::SessionResult(session_id))
        .is_none()
    {
        panic_with_error!(env, ProctoringError::InvalidSessionState);
    }

    if env
        .storage()
        .persistent()
        .has(&ProctoringKey::SessionChallenge(session_id))
    {
        panic_with_error!(env, ProctoringError::ChallengeAlreadyFiled);
    }

    let challenge = ProctoringChallenge {
        session_id,
        challenger: challenger.clone(),
        evidence: evidence.clone(),
        challenged_at: env.ledger().timestamp(),
    };

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionChallenge(session_id), &challenge);

    session.status = ProctoringStatus::Challenged;
    session.challenged_at = Some(challenge.challenged_at);
    store_session(env, &session);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("challenge")),
        (session_id, challenger),
    );
}

/// Resolve a challenge. `Upheld` means the exam result remains valid.
pub fn resolve_challenge(
    env: &Env,
    session_id: u64,
    resolution: ChallengeResolution,
    admin: Address,
) {
    require_admin(env, &admin);

    let mut session = require_session(env, session_id);

    if session.status != ProctoringStatus::Challenged {
        panic_with_error!(env, ProctoringError::InvalidSessionState);
    }

    if env
        .storage()
        .persistent()
        .get::<_, ProctoringChallenge>(&ProctoringKey::SessionChallenge(session_id))
        .is_none()
    {
        panic_with_error!(env, ProctoringError::ChallengeNotFound);
    }

    if env
        .storage()
        .persistent()
        .has(&ProctoringKey::SessionResolution(session_id))
    {
        panic_with_error!(env, ProctoringError::ResolutionAlreadyRecorded);
    }

    let resolution_record = ProctoringResolutionRecord {
        session_id,
        admin: admin.clone(),
        resolution: resolution.clone(),
        resolved_at: env.ledger().timestamp(),
    };

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionResolution(session_id), &resolution_record);

    session.status = ProctoringStatus::Resolved;
    session.resolved_at = Some(resolution_record.resolved_at);
    store_session(env, &session);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("resolve")),
        (session_id, admin, resolution),
    );
}

/// Link a proctored credential issuance to a verified session.
pub fn register_proctored_credential(
    env: &Env,
    session_id: u64,
    credential_id: u64,
) {
    let mut session = require_session(env, session_id);

    if session.linked_credential_id.is_some() {
        panic_with_error!(env, ProctoringError::CredentialAlreadyLinked);
    }

    if !credential_registry::credential_exists(env, credential_id) {
        panic_with_error!(env, ProctoringError::CredentialNotEligible);
    }

    let eligible = match session.status {
        ProctoringStatus::Completed => true,
        ProctoringStatus::Resolved => {
            let resolution: ProctoringResolutionRecord = env
                .storage()
                .persistent()
                .get(&ProctoringKey::SessionResolution(session_id))
                .unwrap_or_else(|| panic_with_error!(env, ProctoringError::ChallengeNotFound));
            matches!(resolution.resolution, ChallengeResolution::Upheld)
        }
        ProctoringStatus::Pending | ProctoringStatus::InProgress | ProctoringStatus::Challenged => {
            false
        }
    };

    if !eligible {
        panic_with_error!(env, ProctoringError::CredentialNotEligible);
    }

    session.linked_credential_id = Some(credential_id);
    store_session(env, &session);

    credential_registry::mark_credential_as_proctored(env, credential_id);

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionCredential(session_id), &credential_id);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("link")),
        (session_id, credential_id),
    );
}

pub fn proctored_credential_is_eligible(env: &Env, session_id: u64) -> bool {
    let session = require_session(env, session_id);
    match session.status {
        ProctoringStatus::Completed => true,
        ProctoringStatus::Resolved => {
            if let Some(resolution) = env
                .storage()
                .persistent()
                .get::<_, ProctoringResolutionRecord>(&ProctoringKey::SessionResolution(session_id))
            {
                matches!(resolution.resolution, ChallengeResolution::Upheld)
            } else {
                false
            }
        }
        _ => false,
    }
}

pub fn get_proctoring_session(env: &Env, session_id: u64) -> ProctoringSession {
    require_session(env, session_id)
}

pub fn get_proctoring_result(env: &Env, session_id: u64) -> Option<ProctoringResult> {
    env.storage()
        .persistent()
        .get(&ProctoringKey::SessionResult(session_id))
}

pub fn get_proctoring_challenge(env: &Env, session_id: u64) -> Option<ProctoringChallenge> {
    env.storage()
        .persistent()
        .get(&ProctoringKey::SessionChallenge(session_id))
}

pub fn get_proctoring_resolution(
    env: &Env,
    session_id: u64,
) -> Option<ProctoringResolutionRecord> {
    env.storage()
        .persistent()
        .get(&ProctoringKey::SessionResolution(session_id))
}

pub fn get_proctoring_session_count(env: &Env) -> u64 {
    latest_session_id(env)
}
