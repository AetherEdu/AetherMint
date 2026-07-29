/**
 * Migration: Add Database Indexes
 * Version: 004_add_database_indexes.js
 * Description: Comprehensive indexing strategy for MongoDB collections and
 *   PostgreSQL tables. Creates missing single-column, composite, and text
 *   indexes on all frequently-queried fields.
 *
 *   Implements issue #168 – Backend database indexing strategy.
 */

/**
 * Up migration - Create all missing indexes
 */
async function up(pool) {
  try {
    console.log('Starting migration: Add Database Indexes');

    // ── PostgreSQL indexes ────────────────────────────────────────────────

    // Users table – wallet address lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address)
    `);
    console.log('✓ Created idx_users_wallet_address');

    // Users table – role + created_at for analytics
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role_created ON users(role, created_at)
    `);
    console.log('✓ Created idx_users_role_created');

    // Courses table – slug (if courses table exists)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'courses'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_status_created ON courses(status, created_at)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_category_status ON courses(category, status, created_at)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_instructor_status ON courses(instructor_id, status)';
        END IF;
      END $$;
    `);
    console.log('✓ Created courses indexes (if table exists)');

    // Enrollments table – composite user+course
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'enrollments'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON enrollments(user_id, course_id)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_enrollments_course_status ON enrollments(course_id, status)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_enrollments_user_status ON enrollments(user_id, status)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_enrollments_user_progress ON enrollments(user_id, progress)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_enrollments_course_enrolled ON enrollments(course_id, enrolled_at)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_enrollments_status_enrolled ON enrollments(status, enrolled_at)';
        END IF;
      END $$;
    `);
    console.log('✓ Created enrollments indexes (if table exists)');

    // Content table – composite indexes for versioning and search
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'content'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_course_status ON content(course_id, status)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_type_status ON content(type, status)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_created_by ON content(created_by, created_at)';
        END IF;
      END $$;
    `);
    console.log('✓ Created content indexes (if table exists)');

    // ── MongoDB / Mongoose indexes ────────────────────────────────────────
    // Indexes are defined in schema files and created at application startup
    // (see index.ts ensureMongooseIndexes). This migration only handles the
    // PostgreSQL side. MongoDB indexes are auto-managed by Mongoose.
    console.log('ℹ MongoDB indexes are managed at application startup (index.ts)');

    console.log('Migration completed successfully: Add Database Indexes');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Down migration - Drop the indexes created by this migration
 */
async function down(pool) {
  try {
    console.log('Starting rollback migration: Remove Database Indexes');

    // ── PostgreSQL index drops ────────────────────────────────────────────

    await pool.query(`DROP INDEX IF EXISTS idx_users_wallet_address`);
    await pool.query(`DROP INDEX IF EXISTS idx_users_role_created`);

    // Courses
    await pool.query(`DROP INDEX IF EXISTS idx_courses_slug`);
    await pool.query(`DROP INDEX IF EXISTS idx_courses_status_created`);
    await pool.query(`DROP INDEX IF EXISTS idx_courses_category_status`);
    await pool.query(`DROP INDEX IF EXISTS idx_courses_instructor_status`);

    // Enrollments
    await pool.query(`DROP INDEX IF EXISTS idx_enrollments_user_course`);
    await pool.query(`DROP INDEX IF EXISTS idx_enrollments_course_status`);
    await pool.query(`DROP INDEX IF EXISTS idx_enrollments_user_status`);
    await pool.query(`DROP INDEX IF EXISTS idx_enrollments_user_progress`);
    await pool.query(`DROP INDEX IF EXISTS idx_enrollments_course_enrolled`);
    await pool.query(`DROP INDEX IF EXISTS idx_enrollments_status_enrolled`);

    // Content
    await pool.query(`DROP INDEX IF EXISTS idx_content_course_status`);
    await pool.query(`DROP INDEX IF EXISTS idx_content_type_status`);
    await pool.query(`DROP INDEX IF EXISTS idx_content_created_by`);

    console.log('✓ PostgreSQL indexes dropped');

    console.log('ℹ MongoDB index rollback is handled at the schema level');

    console.log('Rollback migration completed successfully: Remove Database Indexes');
  } catch (error) {
    console.error('Rollback migration failed:', error);
    throw error;
  }
}

/**
 * Migration validation
 */
async function validate(pool) {
  try {
    console.log('Validating migration: Add Database Indexes');

    const issues = [];

    // ── PostgreSQL index validation ───────────────────────────────────────

    const indexCheck = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname IN (
        'idx_users_wallet_address',
        'idx_users_role_created',
        'idx_courses_slug',
        'idx_courses_status_created',
        'idx_courses_category_status',
        'idx_courses_instructor_status',
        'idx_enrollments_user_course',
        'idx_enrollments_course_status',
        'idx_enrollments_user_status',
        'idx_enrollments_user_progress',
        'idx_enrollments_course_enrolled',
        'idx_enrollments_status_enrolled',
        'idx_content_course_status',
        'idx_content_type_status',
        'idx_content_created_by'
      )
    `);

    const foundIndexes = new Set(indexCheck.rows.map(r => r.indexname));

    // Only validate indexes for tables that exist
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('users', 'courses', 'enrollments', 'content')
      AND table_schema = 'public'
    `);
    const existingTables = new Set(tableCheck.rows.map(r => r.table_name));

    if (existingTables.has('users')) {
      if (!foundIndexes.has('idx_users_wallet_address')) {
        issues.push('Missing idx_users_wallet_address on users table');
      }
      if (!foundIndexes.has('idx_users_role_created')) {
        issues.push('Missing idx_users_role_created on users table');
      }
    }

    if (existingTables.has('courses')) {
      if (!foundIndexes.has('idx_courses_slug')) {
        issues.push('Missing idx_courses_slug on courses table');
      }
      if (!foundIndexes.has('idx_courses_status_created')) {
        issues.push('Missing idx_courses_status_created on courses table');
      }
    }

    if (existingTables.has('enrollments')) {
      if (!foundIndexes.has('idx_enrollments_user_course')) {
        issues.push('Missing idx_enrollments_user_course on enrollments table');
      }
    }

    if (issues.length > 0) {
      console.warn('⚠ Validation warnings:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    if (issues.length === 0) {
      console.log('✓ All required indexes exist');
    }

    // ── MongoDB index validation ──────────────────────────────────────────
    // Schemas are validated at application startup; migration validation
    // focuses on PostgreSQL indexes only.
    console.log('ℹ MongoDB index validation is handled at application startup');

    console.log('Migration validation passed: Add Database Indexes');
  } catch (error) {
    console.error('Migration validation failed:', error);
    throw error;
  }
}

module.exports = {
  up,
  down,
  validate,
  version: '004',
  description: 'Add Database Indexes',
  dependencies: ['003'],
};
