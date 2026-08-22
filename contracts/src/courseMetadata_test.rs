#![cfg(test)]

use crate::courseMetadata::{
    CourseCompletion, CourseMetadata, CourseMetadataContract, CourseMetadataKey, CourseStatus,
    InstructorProfile,
};
use soroban_sdk::{testutils::Address as _, vec, Address, Env, String, Vec};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);

    // Test successful initialization
    CourseMetadataContract::initialize(env.clone(), admin.clone());

    // Verify admin is set
    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&CourseMetadataKey::Admin)
        .unwrap();
    assert_eq!(stored_admin, admin);

    // Test double initialization fails
    let result = std::panic::catch_unwind(|| {
        CourseMetadataContract::initialize(env, admin);
    });
    assert!(result.is_err());
}

#[test]
fn test_create_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Introduction to Rust"),
        String::from_str(&env, "Learn the basics of Rust programming"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,      // 40 hours
        1000000, // price in stroops
        vec![&env, String::from_str(&env, "Basic programming")],
        vec![
            &env,
            String::from_str(&env, "Understand Rust syntax"),
            String::from_str(&env, "Write basic Rust programs"),
        ],
        String::from_str(&env, "QmHash123"), // IPFS hash
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![
            &env,
            String::from_str(&env, "rust"),
            String::from_str(&env, "programming"),
        ],
        String::from_str(&env, "English"),
        true, // certificate enabled
        100,  // max students
    );

    // Verify course was created
    let course = CourseMetadataContract::get_course(env.clone(), course_id.clone());
    assert_eq!(course.title, String::from_str(&env, "Introduction to Rust"));
    assert_eq!(course.instructor, instructor);
    assert_eq!(course.price, 1000000);
    assert_eq!(course.current_enrollments, 0);
    assert_eq!(course.rating, 0);
    assert_eq!(course.review_count, 0);
    assert!(matches!(course.status, CourseStatus::Active));

    // Verify instructor profile was created
    let instructor_profile = CourseMetadataContract::get_instructor_profile(env, instructor);
    assert_eq!(instructor_profile.address, instructor);
    assert_eq!(instructor_profile.course_count, 1);
    assert_eq!(instructor_profile.total_students, 0);
}

#[test]
fn test_update_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Original Title"),
        String::from_str(&env, "Original description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Update the course
    let update_result = CourseMetadataContract::update_course(
        env.clone(),
        course_id.clone(),
        instructor.clone(),
        Some(String::from_str(&env, "Updated Title")),
        Some(String::from_str(&env, "Updated description")),
        None, // category unchanged
        Some(String::from_str(&env, "intermediate")),
        Some(60),      // updated duration
        Some(2000000), // updated price
        None,          // prerequisites unchanged
        None,          // learning objectives unchanged
        None,          // syllabus unchanged
        None,          // thumbnail unchanged
        None,          // tags unchanged
        None,          // language unchanged
        None,          // certificate enabled unchanged
        None,          // max students unchanged
        Some(CourseStatus::Inactive),
    );

    assert!(update_result);

    // Verify updates
    let updated_course = CourseMetadataContract::get_course(env, course_id);
    assert_eq!(
        updated_course.title,
        String::from_str(&env, "Updated Title")
    );
    assert_eq!(
        updated_course.description,
        String::from_str(&env, "Updated description")
    );
    assert_eq!(updated_course.level, String::from_str(&env, "intermediate"));
    assert_eq!(updated_course.duration, 60);
    assert_eq!(updated_course.price, 2000000);
    assert!(matches!(updated_course.status, CourseStatus::Inactive));
    // Category should remain unchanged
    assert_eq!(
        updated_course.category,
        String::from_str(&env, "Programming")
    );
}

#[test]
fn test_verify_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Test Course"),
        String::from_str(&env, "Test description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Verify course authenticity
    let is_valid = CourseMetadataContract::verify_course(env.clone(), course_id.clone());
    assert!(is_valid);

    // Get course and manually tamper with verification hash test
    let mut course = CourseMetadataContract::get_course(env.clone(), course_id);
    course.verification_hash = String::from_str(&env, "tampered_hash");

    // This would require direct storage access to test tampering
    // For now, we just verify the verification logic works
    let original_verification = CourseMetadataContract::verify_course(env, course_id);
    assert!(original_verification); // Should still be valid as we didn't actually tamper
}

#[test]
fn test_record_completion() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let student = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Test Course"),
        String::from_str(&env, "Test description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Record course completion
    let completion_id = CourseMetadataContract::record_completion(
        env.clone(),
        course_id.clone(),
        student.clone(),
        85,                                      // final grade
        String::from_str(&env, "QmCertHash456"), // certificate hash
        vec![
            &env,
            String::from_str(&env, "Rust basics"),
            String::from_str(&env, "Memory management"),
        ],
    );

    // Verify completion was recorded
    let completion = CourseMetadataContract::get_completion(env.clone(), completion_id.clone());
    assert_eq!(completion.course_id, course_id);
    assert_eq!(completion.student, student);
    assert_eq!(completion.final_grade, 85);
    assert_eq!(
        completion.certificate_hash,
        String::from_str(&env, "QmCertHash456")
    );
    assert!(!completion.is_verified); // Initially not verified
    assert_eq!(completion.skills_acquired.len(), 2);

    // Verify course enrollment count updated
    let updated_course = CourseMetadataContract::get_course(env.clone(), course_id);
    assert_eq!(updated_course.current_enrollments, 1);

    // Verify instructor student count updated
    let updated_instructor = CourseMetadataContract::get_instructor_profile(env, instructor);
    assert_eq!(updated_instructor.total_students, 1);
}

#[test]
fn test_verify_completion() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let student = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test Course"),
        String::from_str(&env, "Test description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Record completion
    let completion_id = CourseMetadataContract::record_completion(
        env.clone(),
        course_id,
        student,
        85,
        String::from_str(&env, "QmCertHash456"),
        vec![&env, String::from_str(&env, "Rust basics")],
    );

    // Verify completion is initially not verified
    let completion = CourseMetadataContract::get_completion(env.clone(), completion_id.clone());
    assert!(!completion.is_verified);

    // Verify completion
    let verify_result =
        CourseMetadataContract::verify_completion(env.clone(), completion_id.clone());
    assert!(verify_result);

    // Check that completion is now verified
    let verified_completion = CourseMetadataContract::get_completion(env, completion_id);
    assert!(verified_completion.is_verified);
}

#[test]
fn test_rate_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let rater = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test Course"),
        String::from_str(&env, "Test description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Rate the course
    let rate_result =
        CourseMetadataContract::rate_course(env.clone(), course_id.clone(), rater, 80);
    assert!(rate_result);

    // Check rating was updated
    let rated_course = CourseMetadataContract::get_course(env.clone(), course_id);
    assert_eq!(rated_course.rating, 80);
    assert_eq!(rated_course.review_count, 1);

    // Rate again
    let rate_result2 =
        CourseMetadataContract::rate_course(env.clone(), course_id.clone(), rater, 90);
    assert!(rate_result2);

    // Check average rating calculation
    let final_course = CourseMetadataContract::get_course(env, course_id);
    assert_eq!(final_course.rating, 85); // (80 + 90) / 2 = 85
    assert_eq!(final_course.review_count, 2);
}

#[test]
fn test_get_course_count() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Initially no courses
    assert_eq!(CourseMetadataContract::get_course_count(env.clone()), 0);

    // Create courses
    CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Course 1"),
        String::from_str(&env, "Description 1"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    assert_eq!(CourseMetadataContract::get_course_count(env.clone()), 1);

    CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Course 2"),
        String::from_str(&env, "Description 2"),
        String::from_str(&env, "Design"),
        String::from_str(&env, "intermediate"),
        60,
        2000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash456"),
        String::from_str(&env, "https://example.com/thumbnail2.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        50,
    );

    assert_eq!(CourseMetadataContract::get_course_count(env), 2);
}

#[test]
fn test_get_completion_count() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let student = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Initially no completions
    assert_eq!(CourseMetadataContract::get_completion_count(env.clone()), 0);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test Course"),
        String::from_str(&env, "Test description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Record completions
    CourseMetadataContract::record_completion(
        env.clone(),
        course_id.clone(),
        student.clone(),
        85,
        String::from_str(&env, "QmCertHash456"),
        vec![&env, String::from_str(&env, "Rust basics")],
    );

    assert_eq!(CourseMetadataContract::get_completion_count(env.clone()), 1);

    CourseMetadataContract::record_completion(
        env.clone(),
        course_id,
        student,
        90,
        String::from_str(&env, "QmCertHash789"),
        vec![&env, String::from_str(&env, "Advanced Rust")],
    );

    assert_eq!(CourseMetadataContract::get_completion_count(env), 2);
}

#[test]
#[should_panic(expected = "Rating must be between 0 and 100")]
fn test_invalid_rating() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let rater = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test Course"),
        String::from_str(&env, "Test description"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash123"),
        String::from_str(&env, "https://example.com/thumbnail.jpg"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    // Try to rate with invalid rating (should panic)
    CourseMetadataContract::rate_course(env, course_id, rater, 150); // Invalid rating > 100
}

#[test]
fn test_create_course_with_empty_strings() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    // Initialize contract
    CourseMetadataContract::initialize(env.clone(), admin);

    // Create a course with empty strings
    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, ""),
        String::from_str(&env, ""),
        String::from_str(&env, ""),
        String::from_str(&env, ""),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, ""),
        String::from_str(&env, ""),
        vec![&env],
        String::from_str(&env, ""),
        true,
        100,
    );

    let course = CourseMetadataContract::get_course(env, course_id);
    assert_eq!(course.title.len(), 0);
    assert_eq!(course.description.len(), 0);
}

#[test]
fn test_create_course_with_zero_duration() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        0,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    let course = CourseMetadataContract::get_course(env, course_id);
    assert_eq!(course.duration, 0);
}

#[test]
fn test_create_course_with_zero_price() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        0,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    let course = CourseMetadataContract::get_course(env, course_id);
    assert_eq!(course.price, 0);
}

#[test]
fn test_create_course_with_zero_max_students() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        0,
    );

    let course = CourseMetadataContract::get_course(env, course_id);
    assert_eq!(course.max_students, 0);
}

#[test]
fn test_update_nonexistent_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::update_course(
            env.clone(),
            999,
            instructor,
            Some(String::from_str(&env, "Updated")),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        );
    }));
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_course() {
    let env = Env::default();
    let admin = Address::generate(&env);

    CourseMetadataContract::initialize(env);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::get_course(env, 999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_completion() {
    let env = Env::default();
    let admin = Address::generate(&env);

    CourseMetadataContract::initialize(env);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::get_completion(env, 999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_get_nonexistent_instructor_profile() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    CourseMetadataContract::initialize(env);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::get_instructor_profile(env, instructor);
    }));
    assert!(result.is_err());
}

#[test]
fn test_rate_nonexistent_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let rater = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::rate_course(env, 999, rater, 80);
    }));
    assert!(result.is_err());
}

#[test]
fn test_record_completion_nonexistent_course() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let student = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::record_completion(
            env,
            999,
            student,
            85,
            String::from_str(&env, "QmCert"),
            vec![&env],
        );
    }));
    assert!(result.is_err());
}

#[test]
fn test_verify_completion_nonexistent() {
    let env = Env::default();
    let admin = Address::generate(&env);

    CourseMetadataContract::initialize(env);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::verify_completion(env, 999);
    }));
    assert!(result.is_err());
}

#[test]
fn test_rate_course_negative_rating() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let rater = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        CourseMetadataContract::rate_course(env, course_id, rater, -10);
    }));
    assert!(result.is_err());
}

#[test]
fn test_multiple_instructors() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor1 = Address::generate(&env);
    let instructor2 = Address::generate(&env);
    let instructor3 = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let course1 = CourseMetadataContract::create_course(
        env.clone(),
        instructor1.clone(),
        String::from_str(&env, "Course 1"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash1"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    let course2 = CourseMetadataContract::create_course(
        env.clone(),
        instructor2.clone(),
        String::from_str(&env, "Course 2"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Design"),
        String::from_str(&env, "intermediate"),
        60,
        2000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash2"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        50,
    );

    let course3 = CourseMetadataContract::create_course(
        env.clone(),
        instructor3.clone(),
        String::from_str(&env, "Course 3"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Business"),
        String::from_str(&env, "advanced"),
        80,
        3000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash3"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        75,
    );

    let profile1 = CourseMetadataContract::get_instructor_profile(env.clone(), instructor1);
    let profile2 = CourseMetadataContract::get_instructor_profile(env.clone(), instructor2);
    let profile3 = CourseMetadataContract::get_instructor_profile(env, instructor3);

    assert_eq!(profile1.course_count, 1);
    assert_eq!(profile2.course_count, 1);
    assert_eq!(profile3.course_count, 1);
}

#[test]
fn test_same_instructor_multiple_courses() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Course 1"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash1"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    CourseMetadataContract::create_course(
        env.clone(),
        instructor.clone(),
        String::from_str(&env, "Course 2"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Design"),
        String::from_str(&env, "intermediate"),
        60,
        2000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash2"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        50,
    );

    let profile = CourseMetadataContract::get_instructor_profile(env, instructor);
    assert_eq!(profile.course_count, 2);
}

#[test]
fn test_completion_with_empty_skills() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let instructor = Address::generate(&env);
    let student = Address::generate(&env);

    CourseMetadataContract::initialize(env.clone(), admin);

    let course_id = CourseMetadataContract::create_course(
        env.clone(),
        instructor,
        String::from_str(&env, "Test"),
        String::from_str(&env, "Desc"),
        String::from_str(&env, "Programming"),
        String::from_str(&env, "beginner"),
        40,
        1000000,
        vec![&env],
        vec![&env],
        String::from_str(&env, "QmHash"),
        String::from_str(&env, "https://example.com"),
        vec![&env],
        String::from_str(&env, "English"),
        true,
        100,
    );

    let completion_id = CourseMetadataContract::record_completion(
        env.clone(),
        course_id,
        student,
        85,
        String::from_str(&env, "QmCert"),
        vec![&env], // Empty skills
    );

    let completion = CourseMetadataContract::get_completion(env, completion_id);
    assert_eq!(completion.skills_acquired.len(), 0);
}
