use crate::utils::storage::{PackedRating, PackedTimestamps};
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
};

/// Optimized course status using bit packing
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CourseStatus {
    Active = 0,
    Inactive = 1,
    Archived = 2,
    Suspended = 3,
}

impl CourseStatus {
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    pub fn from_u32(value: u32) -> Self {
        match value & 0x03 {
            0 => CourseStatus::Active,
            1 => CourseStatus::Inactive,
            2 => CourseStatus::Archived,
            3 => CourseStatus::Suspended,
            _ => CourseStatus::Active,
        }
    }
}

/// Optimized course metadata with packed storage
#[contracttype]
#[derive(Clone, Debug)]
pub struct CourseMetadata {
    pub id: String,
    pub instructor: Address,
    pub title: String,
    pub description: String,
    pub category: String,
    pub level: String,
    pub duration: u64,
    pub price: u64,
    pub prerequisites_hash: String, // Hash of prerequisites vector
    pub objectives_hash: String,    // Hash of objectives vector
    pub syllabus_hash: String,      // IPFS hash
    pub thumbnail_hash: String,     // Hash of thumbnail URL
    pub tags_hash: String,          // Hash of tags vector
    pub language: String,
    pub flags: u32, // Packed certificate_enabled, verification status, etc.
    pub max_students: u32,
    pub current_enrollments: u32,
    pub timestamps: PackedTimestamps,
    pub verification_hash: String,
}

/// Optimized course completion with packed data
#[contracttype]
#[derive(Clone, Debug)]
pub struct CourseCompletion {
    pub id: String,
    pub course_id: String,
    pub student: Address,
    pub timestamp: u64,   // Packed completion_date and verification status
    pub final_grade: u32, // 0-100
    pub certificate_hash: String,
    pub skills_hash: String, // Hash of skills_acquired vector
}

/// Optimized instructor profile with packed data
#[contracttype]
#[derive(Clone, Debug)]
pub struct InstructorProfile {
    pub address: Address,
    pub name: String,
    pub bio_hash: String,       // Hash of bio string
    pub expertise_hash: String, // Hash of expertise vector
    pub experience_years: u32,
    pub rating: PackedRating,
    pub course_count: u32,
    pub total_students: u32,
    pub flags: u32, // Packed verification status and other booleans
    pub created_at: u64,
}

/// Optimized storage keys with better organization
#[contracttype]
pub enum CourseMetadataKey {
    Course(String),
    Instructor(Address),
    CourseCount,
    InstructorCount,
    Completion(String),
    CompletionCount,
    CourseRating(String),         // Separate packed rating storage
    CoursePrerequisites(String),  // Separate vector storage
    CourseObjectives(String),     // Separate vector storage
    CourseTags(String),           // Separate vector storage
    CompletionSkills(String),     // Separate vector storage
    InstructorBio(Address),       // Separate string storage
    InstructorExpertise(Address), // Separate vector storage
    Admin,
}

/// Parameters for create_course (to stay under 10-param limit)
#[contracttype]
#[derive(Clone)]
pub struct CreateCourseParams {
    pub category: String,
    pub level: String,
    pub duration: u64,
    pub price: u64,
    pub language: String,
    pub certificate_enabled: bool,
    pub max_students: u32,
}

/// Parameters for update_course (to stay under 10-param limit)
#[contracttype]
#[derive(Clone)]
pub struct UpdateCourseParams {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub level: Option<String>,
    pub duration: Option<u64>,
    pub price: Option<u64>,
    pub language: Option<String>,
    pub certificate_enabled: Option<bool>,
    pub max_students: Option<u32>,
    pub status: Option<CourseStatus>,
}

// Temporarily disabled to avoid symbol conflicts with main contract
// #[contract]
// pub struct CourseMetadataContract;

#[contractimpl]
pub struct CourseMetadataContract;

impl CourseMetadataContract {
    /// Initialize the contract with optimized storage
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&CourseMetadataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage()
            .instance()
            .set(&CourseMetadataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&CourseMetadataKey::CourseCount, &0u64);
        env.storage()
            .instance()
            .set(&CourseMetadataKey::InstructorCount, &0u64);
        env.storage()
            .instance()
            .set(&CourseMetadataKey::CompletionCount, &0u64);
    }

    /// Create and store course metadata with optimized storage
    pub fn create_course_metadata(
        env: Env,
        instructor: Address,
        title: String,
        description: String,
        syllabus: String,
        thumbnail_url: String,
        prerequisites: Vec<String>,
        learning_objectives: Vec<String>,
        tags: Vec<String>,
        params: CreateCourseParams,
    ) -> String {
        instructor.require_auth();

        // RBAC: require Instructor role
        crate::access_control::require_role(&env, &instructor, crate::access_control::Role::Instructor);

        // Check if instructor exists, create if not
        if !env
            .storage()
            .instance()
            .has(&CourseMetadataKey::Instructor(instructor.clone()))
        {
            Self::create_instructor_profile(env.clone(), instructor.clone());
        }

        let course_count: u64 = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::CourseCount)
            .unwrap_or(0);

        let course_id_str = u64_to_course_id(&env, course_count + 1);
        let timestamp = env.ledger().timestamp();

        // Generate hashes for large data structures
        let prerequisites_hash = Self::generate_vector_hash(&prerequisites);
        let objectives_hash = Self::generate_vector_hash(&learning_objectives);
        let tags_hash = Self::generate_vector_hash(&tags);
        let thumbnail_hash = Self::generate_string_hash(&thumbnail_url);

        // Create verification hash (simple hash without format!)
        let verification_hash_buf = simple_hash_concat(&title, &description, &instructor, params.price, timestamp);
        let verification_hash = verification_hash_buf;

        // Pack flags
        let mut flags = CourseStatus::Active.to_u32();
        if params.certificate_enabled {
            flags |= 0x04;
        }

        let course_metadata = CourseMetadata {
            id: course_id_str.clone(),
            instructor: instructor.clone(),
            title,
            description,
            category: params.category.clone(),
            level: params.level,
            duration: params.duration,
            price: params.price,
            prerequisites_hash,
            objectives_hash,
            syllabus_hash: syllabus,
            thumbnail_hash,
            tags_hash,
            language: params.language,
            flags,
            max_students: params.max_students,
            current_enrollments: 0,
            timestamps: PackedTimestamps::new(timestamp, timestamp),
            verification_hash,
        };

        // Store main metadata
        env.storage().instance().set(
            &CourseMetadataKey::Course(course_id_str.clone()),
            &course_metadata,
        );
        env.storage()
            .instance()
            .set(&CourseMetadataKey::CourseCount, &(course_count + 1));

        // Store large vectors separately
        if !prerequisites.is_empty() {
            env.storage().instance().set(
                &CourseMetadataKey::CoursePrerequisites(course_id_str.clone()),
                &prerequisites,
            );
        }
        if !learning_objectives.is_empty() {
            env.storage().instance().set(
                &CourseMetadataKey::CourseObjectives(course_id_str.clone()),
                &learning_objectives,
            );
        }
        if !tags.is_empty() {
            env.storage()
                .instance()
                .set(&CourseMetadataKey::CourseTags(course_id_str.clone()), &tags);
        }

        // Initialize rating
        let rating = PackedRating::new(0, 0);
        env.storage()
            .instance()
            .set(&CourseMetadataKey::CourseRating(course_id_str.clone()), &rating);

        // Update instructor course count
        let mut instructor_profile = Self::get_instructor_profile(env.clone(), instructor.clone());
        instructor_profile.course_count += 1;
        env.storage().instance().set(
            &CourseMetadataKey::Instructor(instructor),
            &instructor_profile,
        );

        course_id_str
    }

    /// Update course metadata
    pub fn update_course(
        env: Env,
        course_id: String,
        instructor: Address,
        params: UpdateCourseParams,
    ) -> bool {
        let mut course_metadata: CourseMetadata = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::Course(course_id.clone()))
            .unwrap_or_else(|| panic!("Course not found"));

        // Verify instructor ownership
        if course_metadata.instructor != instructor {
            panic!("Only course instructor can update course");
        }

        // Update fields if provided
        if let Some(new_title) = params.title {
            course_metadata.title = new_title;
        }
        if let Some(new_description) = params.description {
            course_metadata.description = new_description;
        }
        if let Some(new_category) = params.category {
            course_metadata.category = new_category;
        }
        if let Some(new_level) = params.level {
            course_metadata.level = new_level;
        }
        if let Some(new_duration) = params.duration {
            course_metadata.duration = new_duration;
        }
        if let Some(new_price) = params.price {
            course_metadata.price = new_price;
        }
        if let Some(new_language) = params.language {
            course_metadata.language = new_language;
        }
        if let Some(new_certificate_enabled) = params.certificate_enabled {
            if new_certificate_enabled {
                course_metadata.flags |= 0x04;
            } else {
                course_metadata.flags &= !0x04;
            }
        }
        if let Some(new_max_students) = params.max_students {
            course_metadata.max_students = new_max_students;
        }
        if let Some(new_status) = params.status {
            course_metadata.flags = (course_metadata.flags & !0x03) | new_status.to_u32();
        }

        // Update timestamp
        course_metadata.timestamps = PackedTimestamps::new(
            course_metadata.timestamps.created_at(),
            env.ledger().timestamp(),
        );

        env.storage()
            .instance()
            .set(&CourseMetadataKey::Course(course_id), &course_metadata);
        true
    }

    /// Verify course authenticity
    pub fn verify_course(env: Env, course_id: String) -> bool {
        let course_metadata: CourseMetadata = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::Course(course_id.clone()))
            .unwrap_or_else(|| panic!("Course not found"));

        // Simple verification - hash based on stored fields
        let verification_data = simple_hash_concat(
            &course_metadata.title,
            &course_metadata.description,
            &course_metadata.instructor,
            course_metadata.price,
            course_metadata.timestamps.updated_at(),
        );

        verification_data == course_metadata.verification_hash
    }

    /// Get course metadata
    pub fn get_course(env: Env, course_id: String) -> CourseMetadata {
        env.storage()
            .instance()
            .get(&CourseMetadataKey::Course(course_id))
            .unwrap_or_else(|| panic!("Course not found"))
    }

    /// Get instructor profile
    pub fn get_instructor_profile(env: Env, instructor: Address) -> InstructorProfile {
        env.storage()
            .instance()
            .get(&CourseMetadataKey::Instructor(instructor))
            .unwrap_or_else(|| panic!("Instructor profile not found"))
    }

    /// Create instructor profile with optimized storage
    fn create_instructor_profile(env: Env, instructor: Address) {
        let timestamp = env.ledger().timestamp();
        let rating = PackedRating::new(0, 0);

        let profile = InstructorProfile {
            address: instructor.clone(),
            name: String::from_str(&env, "Unnamed Instructor"),
            bio_hash: String::from_str(&env, "0"),
            expertise_hash: String::from_str(&env, "0"),
            experience_years: 0,
            rating,
            course_count: 0,
            total_students: 0,
            flags: 0,
            created_at: timestamp,
        };

        env.storage()
            .instance()
            .set(&CourseMetadataKey::Instructor(instructor), &profile);
    }

    /// Generate hash for vector data
    fn generate_vector_hash(vec: &Vec<String>) -> String {
        let mut hash: u64 = 0;
        for i in 0..vec.len() {
            let item = vec.get(i).unwrap();
            let mut buf = [0u8; 256];
            let len = item.len() as usize;
            let buf_len = if len < 256 { len } else { 256usize };
            item.copy_into_slice(&mut buf[..buf_len]);
            for j in 0..buf_len {
                hash = hash.wrapping_mul(31).wrapping_add(buf[j] as u64);
            }
        }
        u64_to_hex_string(hash)
    }

    /// Generate hash for string data
    fn generate_string_hash(string: &String) -> String {
        let mut hash: u64 = 0;
        let mut buf = [0u8; 256];
        let len = string.len() as usize;
        let buf_len = if len < 256 { len } else { 256usize };
        string.copy_into_slice(&mut buf[..buf_len]);
        for i in 0..buf_len {
            hash = hash.wrapping_mul(31).wrapping_add(buf[i] as u64);
        }
        u64_to_hex_string(hash)
    }

    /// Record course completion
    pub fn record_completion(
        env: Env,
        course_id: String,
        student: Address,
        final_grade: u32,
        certificate_hash: String,
        skills_acquired: Vec<String>,
    ) -> String {
        // Verify course exists
        let _course_metadata: CourseMetadata = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::Course(course_id.clone()))
            .unwrap_or_else(|| panic!("Course not found"));

        let completion_count: u64 = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::CompletionCount)
            .unwrap_or(0);

        let completion_id_str = u64_to_completion_id(&env, completion_count + 1);
        let skills_hash = Self::generate_vector_hash(&skills_acquired);

        let completion = CourseCompletion {
            id: completion_id_str.clone(),
            course_id: course_id.clone(),
            student: student.clone(),
            timestamp: env.ledger().timestamp(),
            final_grade,
            certificate_hash,
            skills_hash,
        };

        env.storage().instance().set(
            &CourseMetadataKey::Completion(completion_id_str.clone()),
            &completion,
        );
        env.storage()
            .instance()
            .set(&CourseMetadataKey::CompletionCount, &(completion_count + 1));

        completion_id_str
    }

    /// Verify course completion
    pub fn verify_completion(env: Env, completion_id: String) -> bool {
        let _completion: CourseCompletion = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::Completion(completion_id.clone()))
            .unwrap_or_else(|| panic!("Completion record not found"));

        true
    }

    /// Get course completion record
    pub fn get_completion(env: Env, completion_id: String) -> CourseCompletion {
        env.storage()
            .instance()
            .get(&CourseMetadataKey::Completion(completion_id))
            .unwrap_or_else(|| panic!("Completion record not found"))
    }

    /// Get student's course completions
    pub fn get_student_completions(env: Env, _student: Address) -> Vec<String> {
        Vec::new(&env)
    }

    /// Get instructor's courses
    pub fn get_instructor_courses(env: Env, _instructor: Address) -> Vec<String> {
        Vec::new(&env)
    }

    /// Get total course count
    pub fn get_course_metadata_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&CourseMetadataKey::CourseCount)
            .unwrap_or(0)
    }

    /// Get total completion count
    pub fn get_completion_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&CourseMetadataKey::CompletionCount)
            .unwrap_or(0)
    }

    /// Rate a course with packed rating storage
    pub fn rate_course(env: Env, course_id: String, _rater: Address, rating: u32) -> bool {
        if rating > 100 {
            panic!("Rating must be between 0 and 100");
        }

        let _course_metadata: CourseMetadata = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::Course(course_id.clone()))
            .unwrap_or_else(|| panic!("Course not found"));

        // Update packed rating
        let mut packed_rating: PackedRating = env
            .storage()
            .instance()
            .get(&CourseMetadataKey::CourseRating(course_id.clone()))
            .unwrap_or_else(|| PackedRating::new(0, 0));

        let current_rating = packed_rating.rating_bps();
        let current_count = packed_rating.review_count();
        let new_count = current_count + 1;
        let new_rating = ((current_rating * current_count + rating * 100) / new_count) as u32;

        packed_rating = PackedRating::new(new_rating, new_count);
        env.storage()
            .instance()
            .set(&CourseMetadataKey::CourseRating(course_id), &packed_rating);
        true
    }
}

/// Helper: u64 to course_id string without format!
fn u64_to_course_id(env: &Env, num: u64) -> soroban_sdk::String {
    let prefix = b"course_";
    let mut buf = [0u8; 20];
    // Copy prefix
    let mut pos = 0;
    for &b in prefix.iter() {
        buf[pos] = b;
        pos += 1;
    }
    // Write number digits
    if num == 0 {
        buf[pos] = b'0';
        pos += 1;
    } else {
        let mut n = num;
        let digits_start = pos;
        while n > 0 {
            buf[pos] = b'0' + (n % 10) as u8;
            n /= 10;
            pos += 1;
        }
        // Reverse the digits
        let mut i = digits_start;
        let mut j = pos - 1;
        while i < j {
            buf.swap(i, j);
            i += 1;
            j -= 1;
        }
    }
    String::from_bytes(env, &buf[..pos])
}

/// Helper: u64 to completion_id string without format!
fn u64_to_completion_id(env: &Env, num: u64) -> soroban_sdk::String {
    let prefix = b"completion_";
    let mut buf = [0u8; 30];
    let mut pos = 0;
    for &b in prefix.iter() {
        buf[pos] = b;
        pos += 1;
    }
    if num == 0 {
        buf[pos] = b'0';
        pos += 1;
    } else {
        let mut n = num;
        let digits_start = pos;
        while n > 0 {
            buf[pos] = b'0' + (n % 10) as u8;
            n /= 10;
            pos += 1;
        }
        let mut i = digits_start;
        let mut j = pos - 1;
        while i < j {
            buf.swap(i, j);
            i += 1;
            j -= 1;
        }
    }
    String::from_bytes(env, &buf[..pos])
}

/// Simple hash concatenation without format!
fn simple_hash_concat(title: &soroban_sdk::String, description: &soroban_sdk::String, _instructor: &Address, price: u64, timestamp: u64) -> soroban_sdk::String {
    let mut combined: u64 = 0;
    let mut t_buf = [0u8; 256];
    let t_len = title.len() as usize;
    let t_buf_len = if t_len < 256 { t_len } else { 256usize };
    title.copy_into_slice(&mut t_buf[..t_buf_len]);
    for i in 0..t_buf_len {
        combined = combined.wrapping_mul(31).wrapping_add(t_buf[i as usize] as u64);
    }
    let mut d_buf = [0u8; 512];
    let d_len = description.len() as usize;
    let d_buf_len = if d_len < 512 { d_len } else { 512usize };
    description.copy_into_slice(&mut d_buf[..d_buf_len]);
    for i in 0..d_buf_len {
        combined = combined.wrapping_mul(31).wrapping_add(d_buf[i as usize] as u64);
    }
    combined = combined.wrapping_mul(31).wrapping_add(price);
    combined = combined.wrapping_mul(31).wrapping_add(timestamp);
    u64_to_hex_string(combined)
}

/// Convert u64 to hex string without format!
fn u64_to_hex_string(_num: u64) -> soroban_sdk::String {
    // Placeholder - this should be called with env context
    // In no_std without env reference, return static value
    soroban_sdk::String::from_str(&soroban_sdk::Env::default(), "0")
}
