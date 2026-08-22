#![cfg(test)]

use crate::course_events::{
    get_course_actor_events, get_course_event, get_course_event_count, get_course_events,
    publish_course_event, record_course_event, CourseLifecycleEvent,
};
use soroban_sdk::{testutils::Address as _, testutils::Events as _, Address, Env};

#[test]
fn test_publish_records_event_and_indexes_it() {
    let env = Env::default();
    env.mock_all_auths();

    let instructor = Address::generate(&env);
    let course_id: u64 = 1;

    let event_id = publish_course_event(
        &env,
        CourseLifecycleEvent::Created,
        course_id,
        instructor.clone(),
    );

    assert_eq!(event_id, 1);
    assert_eq!(get_course_event_count(&env), 1);

    let record = get_course_event(&env, event_id).unwrap();
    assert_eq!(record.id, event_id);
    assert_eq!(record.event_type, CourseLifecycleEvent::Created);
    assert_eq!(record.course_id, course_id);
    assert_eq!(record.actor, instructor);
    assert_eq!(record.timestamp, env.ledger().timestamp());

    // Indexed by course_id.
    let by_course = get_course_events(&env, course_id);
    assert_eq!(by_course.len(), 1);
    assert_eq!(by_course.get(0).unwrap().id, event_id);

    // Indexed by actor.
    let by_actor = get_course_actor_events(&env, instructor.clone());
    assert_eq!(by_actor.len(), 1);
    assert_eq!(by_actor.get(0).unwrap().id, event_id);
}

#[test]
fn test_publish_appends_multiple_events_per_course() {
    let env = Env::default();
    env.mock_all_auths();

    let instructor = Address::generate(&env);
    let student = Address::generate(&env);
    let course_id: u64 = 5;

    let created_id = publish_course_event(
        &env,
        CourseLifecycleEvent::Created,
        course_id,
        instructor.clone(),
    );
    let enrolled_id = publish_course_event(
        &env,
        CourseLifecycleEvent::Enrolled,
        course_id,
        student.clone(),
    );
    let completed_id = publish_course_event(
        &env,
        CourseLifecycleEvent::Completed,
        course_id,
        student.clone(),
    );

    assert_eq!(created_id, 1);
    assert_eq!(enrolled_id, 2);
    assert_eq!(completed_id, 3);
    assert_eq!(get_course_event_count(&env), 3);

    let events = get_course_events(&env, course_id);
    assert_eq!(events.len(), 3);
    assert_eq!(
        events.get(0).unwrap().event_type,
        CourseLifecycleEvent::Created
    );
    assert_eq!(
        events.get(1).unwrap().event_type,
        CourseLifecycleEvent::Enrolled
    );
    assert_eq!(
        events.get(2).unwrap().event_type,
        CourseLifecycleEvent::Completed
    );

    // Instructor only has the Created event.
    assert_eq!(get_course_actor_events(&env, instructor).len(), 1);
    // Student has Enrolled and Completed events.
    assert_eq!(get_course_actor_events(&env, student).len(), 2);
}

#[test]
fn test_publish_distinguishes_events_by_course_id() {
    let env = Env::default();
    env.mock_all_auths();

    let actor = Address::generate(&env);

    publish_course_event(&env, CourseLifecycleEvent::Created, 10, actor.clone());
    publish_course_event(&env, CourseLifecycleEvent::Created, 20, actor.clone());
    publish_course_event(&env, CourseLifecycleEvent::Completed, 10, actor.clone());

    // Course 10 has Created and Completed.
    assert_eq!(get_course_events(&env, 10).len(), 2);
    // Course 20 has only Created.
    assert_eq!(get_course_events(&env, 20).len(), 1);
    // Actor has all 3.
    assert_eq!(get_course_actor_events(&env, actor).len(), 3);
}

#[test]
fn test_publish_emits_on_chain_event_with_expected_topics_and_payload() {
    let env = Env::default();
    env.mock_all_auths();

    let instructor = Address::generate(&env);
    let course_id: u64 = 99;

    publish_course_event(
        &env,
        CourseLifecycleEvent::Created,
        course_id,
        instructor.clone(),
    );

    let all = env.events().all();
    assert_eq!(all.len(), 1);

    let event = &all.get(0).unwrap();
    // Topics: (course_op, created).
    assert_eq!(event.1.len(), 2);
    assert_eq!(
        event.1.get(0).unwrap(),
        soroban_sdk::Symbol::new(&env, "course_op")
    );
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "created")
    );

    // Payload: (course_id, actor, timestamp).
    let payload = &event.2;
    assert_eq!(payload.len(), 3);
    assert_eq!(payload.get(0).unwrap(), course_id);
    assert_eq!(payload.get(1).unwrap(), instructor);
    assert_eq!(payload.get(2).unwrap(), env.ledger().timestamp());
}

#[test]
fn test_enrolled_event_on_chain_topics() {
    let env = Env::default();
    env.mock_all_auths();

    let student = Address::generate(&env);
    publish_course_event(&env, CourseLifecycleEvent::Enrolled, 42, student.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);
    let event = &all.get(0).unwrap();
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "enrolled")
    );
}

#[test]
fn test_completed_event_on_chain_topics() {
    let env = Env::default();
    env.mock_all_auths();

    let student = Address::generate(&env);
    publish_course_event(&env, CourseLifecycleEvent::Completed, 7, student.clone());

    let all = env.events().all();
    assert_eq!(all.len(), 1);
    let event = &all.get(0).unwrap();
    assert_eq!(
        event.1.get(1).unwrap(),
        soroban_sdk::Symbol::new(&env, "completed")
    );
}

#[test]
fn test_record_event_does_not_publish_but_still_indexes() {
    let env = Env::default();
    env.mock_all_auths();

    let actor = Address::generate(&env);
    let course_id: u64 = 3;

    let event_id = record_course_event(
        &env,
        CourseLifecycleEvent::Enrolled,
        course_id,
        actor.clone(),
        env.ledger().timestamp(),
    );

    assert_eq!(event_id, 1);
    assert_eq!(get_course_event_count(&env), 1);
    assert_eq!(get_course_events(&env, course_id).len(), 1);
    assert_eq!(get_course_actor_events(&env, actor).len(), 1);

    // No on-chain event emitted (record_course_event skips env.events().publish).
    assert_eq!(env.events().all().len(), 0);
}

#[test]
fn test_get_course_event_for_unknown_id_returns_none() {
    let env = Env::default();
    assert!(get_course_event(&env, 999).is_none());
    assert_eq!(get_course_event_count(&env), 0);
    assert_eq!(get_course_events(&env, 1).len(), 0);
}

#[test]
fn test_topic_mapping_is_stable_and_distinct() {
    let env = Env::default();

    assert_eq!(
        CourseLifecycleEvent::Created.topic(),
        soroban_sdk::Symbol::new(&env, "created")
    );
    assert_eq!(
        CourseLifecycleEvent::Enrolled.topic(),
        soroban_sdk::Symbol::new(&env, "enrolled")
    );
    assert_eq!(
        CourseLifecycleEvent::Completed.topic(),
        soroban_sdk::Symbol::new(&env, "completed")
    );
    assert_eq!(
        CourseLifecycleEvent::Updated.topic(),
        soroban_sdk::Symbol::new(&env, "updated")
    );

    // All topics are distinct.
    assert_ne!(
        CourseLifecycleEvent::Created.topic(),
        CourseLifecycleEvent::Enrolled.topic()
    );
    assert_ne!(
        CourseLifecycleEvent::Created.topic(),
        CourseLifecycleEvent::Completed.topic()
    );
    assert_ne!(
        CourseLifecycleEvent::Created.topic(),
        CourseLifecycleEvent::Updated.topic()
    );
    assert_ne!(
        CourseLifecycleEvent::Enrolled.topic(),
        CourseLifecycleEvent::Completed.topic()
    );
}

#[test]
fn test_updated_event_emitted_on_course_update() {
    let env = Env::default();
    env.mock_all_auths();

    let instructor = Address::generate(&env);

    publish_course_event(&env, CourseLifecycleEvent::Created, 1, instructor.clone());
    publish_course_event(&env, CourseLifecycleEvent::Updated, 1, instructor.clone());

    let events = get_course_events(&env, 1);
    assert_eq!(events.len(), 2);
    assert_eq!(
        events.get(0).unwrap().event_type,
        CourseLifecycleEvent::Created
    );
    assert_eq!(
        events.get(1).unwrap().event_type,
        CourseLifecycleEvent::Updated
    );
}
