use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec, BytesN,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProctoringKey {
    Session(u64),
    SessionAudit(u64),
    SessionResult(u64),
    ProctorAttestation(Address),
    SessionCount,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssessmentSession {
    pub id: u64,
    pub student: Address,
    pub assessment_id: String,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub identity_hash: BytesN<32>, // Biometric data hash
    pub status: u32, // 0: Pending, 1: Active, 2: Completed, 3: Flagged, 4: Invalidated
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditLog {
    pub session_id: u64,
    pub timestamp: u64,
    pub event_type: String,
    pub data_hash: BytesN<32>, // Hash of encrypted behavioral data
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

    /// Log a behavioral event for the audit trail
    pub fn log_behavioral_event(
        env: Env,
        session_id: u64,
        event_type: String,
        data_hash: BytesN<32>,
    ) {
        let session: AssessmentSession = env
            .storage()
            .instance()
            .get(&ProctoringKey::Session(session_id))
            .unwrap_or_else(|| panic!("Session not found"));

        session.student.require_auth();

        if session.status != 1 {
            panic!("Session is not active");
        }

        let audit_log = AuditLog {
            session_id,
            timestamp: env.ledger().timestamp(),
            event_type: event_type.clone(),
            data_hash,
        };

        // Append to audit trail (using a simplistic approach for now)
        let mut audit_trail: Vec<AuditLog> = env
            .storage()
            .instance()
            .get(&ProctoringKey::SessionAudit(session_id))
            .unwrap_or_else(|| Vec::new(&env));

        audit_trail.push_back(audit_log);
        env.storage()
            .instance()
            .set(&ProctoringKey::SessionAudit(session_id), &audit_trail);

        env.events().publish(
            (symbol_short!("proctor"), symbol_short!("log")),
            (session_id, event_type),
        );
    }

    /// Complete the session and lock the result
    pub fn complete_session(env: Env, session_id: u64, result_hash: BytesN<32>) {
        let mut session: AssessmentSession = env
            .storage()
            .instance()
            .get(&ProctoringKey::Session(session_id))
            .unwrap_or_else(|| panic!("Session not found"));

        session.student.require_auth();

        if session.status != 1 {
            panic!("Session is not active");
        }

        session.status = 2; // Completed
        session.end_time = Some(env.ledger().timestamp());

        env.storage()
            .instance()
            .set(&ProctoringKey::Session(session_id), &session);
        env.storage()
            .instance()
            .set(&ProctoringKey::SessionResult(session_id), &result_hash);

        env.events().publish(
            (symbol_short!("proctor"), symbol_short!("done")),
            (session_id, result_hash),
        );
    }

    /// Proctor attestation for high-stakes exams
    pub fn attest_session(
        env: Env,
        proctor: Address,
        session_id: u64,
        flagged: bool,
        notes_hash: BytesN<32>,
    ) {
        proctor.require_auth();

        let mut session: AssessmentSession = env
            .storage()
            .instance()
            .get(&ProctoringKey::Session(session_id))
            .unwrap_or_else(|| panic!("Session not found"));

        if flagged {
            session.status = 3; // Flagged
        }

        env.storage()
            .instance()
            .set(&ProctoringKey::Session(session_id), &session);

        // Store attestation info (simplified)
        env.storage()
            .instance()
            .set(&ProctoringKey::ProctorAttestation(proctor.clone()), &notes_hash);

        env.events().publish(
            (symbol_short!("proctor"), symbol_short!("attest")),
            (session_id, proctor, flagged),
        );
    }

    /// Get session details
    pub fn get_session(env: Env, session_id: u64) -> AssessmentSession {
        env.storage()
            .instance()
            .get(&ProctoringKey::Session(session_id))
            .unwrap_or_else(|| panic!("Session not found"))
    }

    /// Get audit trail for a session
    pub fn get_audit_trail(env: Env, session_id: u64) -> Vec<AuditLog> {
        env.storage()
            .instance()
            .get(&ProctoringKey::SessionAudit(session_id))
            .unwrap_or_else(|| Vec::new(&env))
    }
}
