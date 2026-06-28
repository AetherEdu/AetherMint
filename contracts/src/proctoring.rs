//! # Proctoring Module
//!
//! Proctoring session lifecycle and result verification for high-stakes exams.
//! Records on-chain state so credential issuance can be linked back to verified
//! proctoring sessions.
//!
//! ## Flow
//!
//! 1. [`start_proctoring_session`] — Student and proctor both authorize a new session.
//! 2. [`submit_proctoring_result`] — Proctor submits the result with a cryptographic signature.
//! 3. (*Optional*) [`challenge_proctoring_result`] — A challenger disputes the result.
//! 4. (*Optional*) [`resolve_challenge`] — Admin resolves the challenge (Upheld / Overturned).
//! 5. [`register_proctored_credential`] — Link a completed (or upheld) session to a credential.
//!
//! ## Storage
//!
//! Sessions and results are stored in persistent storage. Session count is kept
//! in instance storage. The `ProctoringKey` enum provides type-safe storage keys.
//!
//! ## Error Handling
//!
//! All errors use typed [`ProctoringError`] variants via [`soroban_sdk::panic_with_error`].

use crate::credential_registry;
use crate::utils::validation::{
    validate_non_zero_address, validate_string_length, MAX_METADATA_LENGTH, MAX_SHORT_TEXT_LENGTH,
};
use crate::DataKey;
use soroban_sdk::{
    contracterror, contracttype, panic_with_error, symbol_short, Address, BytesN, Env, String,
};
use crate::utils::pause::PauseUtils;

/// Typed proctoring errors.
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

/// Proctoring session lifecycle states.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProctoringStatus {
    Pending,
    InProgress,
    Completed,
    Challenged,
    Resolved,
}

/// Resolution outcome for a challenged proctoring result.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ChallengeResolution {
    /// Exam result remains valid.
    Upheld,
    /// Exam result is invalidated.
    Overturned,
}

/// On-chain representation of a proctoring session.
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

/// A submitted proctoring result with proctor signature.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringResult {
    pub session_id: u64,
    pub result_data: String,
    pub proctor_signature: BytesN<64>,
    pub submitted_at: u64,
}

/// A challenge filed against a proctoring result.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringChallenge {
    pub session_id: u64,
    pub challenger: Address,
    pub evidence: String,
    pub challenged_at: u64,
}

/// Record of an admin's resolution of a challenge.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProctoringResolutionRecord {
    pub session_id: u64,
    pub admin: Address,
    pub resolution: ChallengeResolution,
    pub resolved_at: u64,
}

/// Type-safe storage keys for the proctoring module.
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

// ===== Internal Helpers =====

/// Retrieve a session by ID, panicking if not found.
fn require_session(env: &Env, session_id: u64) -> ProctoringSession {
    env.storage()
        .persistent()
        .get(&ProctoringKey::Session(session_id))
        .unwrap_or_else(|| panic_with_error!(env, ProctoringError::SessionNotFound))
}

/// Store (or update) a session in persistent storage.
fn store_session(env: &Env, session: &ProctoringSession) {
    env.storage()
        .persistent()
        .set(&ProctoringKey::Session(session.id), session);
}

/// Return the most recently assigned session ID (0 if none).
fn latest_session_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&ProctoringKey::SessionCount)
        .unwrap_or(0)
}

/// Set the session count in instance storage.
fn set_session_count(env: &Env, session_id: u64) {
    env.storage()
        .instance()
        .set(&ProctoringKey::SessionCount, &session_id);
}

/// Require that `caller` is the contract admin.
fn require_admin(env: &Env, admin: &Address) {
    let actual_admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, ProctoringError::AdminNotSet));

    if admin != &actual_admin {
        panic_with_error!(env, ProctoringError::Unauthorized);
    }
    admin.require_auth();
}

// ===== Public Free Functions =====

/// Start a new proctoring session for an exam.
///
/// Both the student and proctor must authorize the call.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `exam_id` - Unique identifier for the exam.
/// * `student` - The address being proctored.
/// * `proctor` - The proctor supervising the session.
///
/// # Returns
/// The newly assigned session ID.
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

/// Submit the proctoring result for a session.
///
/// Only the session's proctor may submit. The session must be in Pending or
/// InProgress state.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `session_id` - The session to submit results for.
/// * `result_data` - Encoded proctoring result data.
/// * `proctor_signature` - Cryptographic signature from the proctor.
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

    let now = env.ledger().timestamp();
    let result = ProctoringResult {
        session_id,
        result_data: result_data.clone(),
        proctor_signature,
        submitted_at: now,
    };

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionResult(session_id), &result);

    session.status = ProctoringStatus::Completed;
    session.completed_at = Some(now);
    store_session(env, &session);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("result")),
        (session_id, result_data),
    );
}

/// Challenge a completed proctoring result with evidence.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `session_id` - The session to challenge.
/// * `challenger` - Address filing the challenge (must authorize).
/// * `evidence` - Evidence supporting the challenge.
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

    let now = env.ledger().timestamp();
    let challenge = ProctoringChallenge {
        session_id,
        challenger: challenger.clone(),
        evidence: evidence.clone(),
        challenged_at: now,
    };

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionChallenge(session_id), &challenge);

    session.status = ProctoringStatus::Challenged;
    session.challenged_at = Some(now);
    store_session(env, &session);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("challenge")),
        (session_id, challenger),
    );
}

/// Resolve a pending proctoring challenge as the admin.
///
/// `ChallengeResolution::Upheld` means the exam result remains valid.
/// `ChallengeResolution::Overturned` means the exam result is invalidated.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `session_id` - The challenged session.
/// * `resolution` - The admin's resolution.
/// * `admin` - Must be the stored contract admin.
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

    let now = env.ledger().timestamp();
    let resolution_record = ProctoringResolutionRecord {
        session_id,
        admin: admin.clone(),
        resolution: resolution.clone(),
        resolved_at: now,
    };

    env.storage()
        .persistent()
        .set(&ProctoringKey::SessionResolution(session_id), &resolution_record);

    session.status = ProctoringStatus::Resolved;
    session.resolved_at = Some(now);
    store_session(env, &session);

    env.events().publish(
        (symbol_short!("proctor"), symbol_short!("resolve")),
        (session_id, admin, resolution),
    );
}

/// Link a credential issuance to a verified proctoring session.
///
/// The session must be Completed, or Resolved with an Upheld resolution.
/// The credential must already exist in the credential registry.
///
/// # Parameters
/// * `env` - Soroban environment.
/// * `session_id` - The verified proctoring session.
/// * `credential_id` - The credential to link.
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

/// Check whether a proctoring session is eligible for credential issuance.
///
/// # Returns
/// `true` if the session is Completed, or Resolved with an Upheld resolution.
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

/// Get the full details of a proctoring session by ID.
pub fn get_proctoring_session(env: &Env, session_id: u64) -> ProctoringSession {
    require_session(env, session_id)
}

/// Get the proctoring result for a session, if submitted.
pub fn get_proctoring_result(env: &Env, session_id: u64) -> Option<ProctoringResult> {
    env.storage()
        .persistent()
        .get(&ProctoringKey::SessionResult(session_id))
}

/// Get the pending challenge for a session, if one exists.
pub fn get_proctoring_challenge(env: &Env, session_id: u64) -> Option<ProctoringChallenge> {
    env.storage()
        .persistent()
        .get(&ProctoringKey::SessionChallenge(session_id))
}

/// Get the challenge resolution record for a session, if resolved.
pub fn get_proctoring_resolution(
    env: &Env,
    session_id: u64,
) -> Option<ProctoringResolutionRecord> {
    env.storage()
        .persistent()
        .get(&ProctoringKey::SessionResolution(session_id))
}

/// Get the total number of proctoring sessions created.
pub fn get_proctoring_session_count(env: &Env) -> u64 {
    latest_session_id(env)
}
