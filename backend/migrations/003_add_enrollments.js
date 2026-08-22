/**
 * Migration: Add Enrollments Table
 * Version: 003_add_enrollments.js
 * Description: Creates enrollments table for tracking user course enrollments
 */

/**
 * Up migration - Create enrollments table and related structures
 */
async function up(pool) {
  try {
    console.log('Starting migration: Add Enrollments');
    
    // Create enrollments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        course_id VARCHAR(255) NOT NULL,
        enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped', 'suspended')),
        last_accessed_at TIMESTAMP,
        certificate_issued BOOLEAN DEFAULT FALSE,
        certificate_url TEXT,
        UNIQUE(user_id, course_id)
      )
    `);
    
    console.log('Created enrollments table');
    
    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON enrollments(enrolled_at)
    `);
    
    console.log('Created indexes for enrollments table');
    
    // Create enrollment_progress table for detailed progress tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollment_progress (
        id VARCHAR(255) PRIMARY KEY,
        enrollment_id VARCHAR(255) NOT NULL,
        content_id VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        time_spent INTEGER DEFAULT 0,
        last_accessed_at TIMESTAMP,
        score INTEGER,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(enrollment_id, content_id)
      )
    `);
    
    console.log('Created enrollment_progress table');
    
    // Create indexes for enrollment_progress
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_progress_enrollment_id ON enrollment_progress(enrollment_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_progress_content_id ON enrollment_progress(content_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_progress_completed ON enrollment_progress(completed)
    `);
    
    console.log('Created indexes for enrollment_progress table');
    
    // Create enrollment_analytics table for tracking enrollment metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollment_analytics (
        id VARCHAR(255) PRIMARY KEY,
        enrollment_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Created enrollment_analytics table');
    
    // Create indexes for enrollment_analytics
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_analytics_enrollment_id ON enrollment_analytics(enrollment_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_analytics_event_type ON enrollment_analytics(event_type)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_analytics_timestamp ON enrollment_analytics(timestamp)
    `);
    
    console.log('Created indexes for enrollment_analytics table');
    
    console.log('Migration completed successfully: Add Enrollments');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Down migration - Remove enrollments table and related structures
 */
async function down(pool) {
  try {
    console.log('Starting rollback migration: Remove Enrollments');
    
    // Drop enrollment_analytics table
    await pool.query(`
      DROP TABLE IF EXISTS enrollment_analytics
    `);
    
    console.log('Dropped enrollment_analytics table');
    
    // Drop enrollment_progress table
    await pool.query(`
      DROP TABLE IF EXISTS enrollment_progress
    `);
    
    console.log('Dropped enrollment_progress table');
    
    // Drop indexes
    await pool.query(`
      DROP INDEX IF EXISTS idx_enrollments_user_id
    `);
    
    await pool.query(`
      DROP INDEX IF EXISTS idx_enrollments_course_id
    `);
    
    await pool.query(`
      DROP INDEX IF EXISTS idx_enrollments_status
    `);
    
    await pool.query(`
      DROP INDEX IF EXISTS idx_enrollments_enrolled_at
    `);
    
    console.log('Dropped enrollments indexes');
    
    // Drop enrollments table
    await pool.query(`
      DROP TABLE IF EXISTS enrollments
    `);
    
    console.log('Dropped enrollments table');
    
    console.log('Rollback migration completed successfully: Remove Enrollments');
    
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
    console.log('Validating migration: Add Enrollments');
    
    // Check if enrollments table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'enrollments'
    `);
    
    if (tableCheck.rows.length === 0) {
      throw new Error('enrollments table not found');
    }
    
    console.log('✓ enrollments table exists');
    
    // Check if enrollment_progress table exists
    const progressTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'enrollment_progress'
    `);
    
    if (progressTableCheck.rows.length === 0) {
      throw new Error('enrollment_progress table not found');
    }
    
    console.log('✓ enrollment_progress table exists');
    
    // Check if enrollment_analytics table exists
    const analyticsTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'enrollment_analytics'
    `);
    
    if (analyticsTableCheck.rows.length === 0) {
      throw new Error('enrollment_analytics table not found');
    }
    
    console.log('✓ enrollment_analytics table exists');
    
    // Check if indexes exist
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE indexname IN (
        'idx_enrollments_user_id',
        'idx_enrollments_course_id',
        'idx_enrollments_status',
        'idx_enrollments_enrolled_at',
        'idx_enrollment_progress_enrollment_id',
        'idx_enrollment_progress_content_id',
        'idx_enrollment_progress_completed',
        'idx_enrollment_analytics_enrollment_id',
        'idx_enrollment_analytics_event_type',
        'idx_enrollment_analytics_timestamp'
      )
    `);
    
    const expectedIndexes = [
      'idx_enrollments_user_id',
      'idx_enrollments_course_id',
      'idx_enrollments_status',
      'idx_enrollments_enrolled_at',
      'idx_enrollment_progress_enrollment_id',
      'idx_enrollment_progress_content_id',
      'idx_enrollment_progress_completed',
      'idx_enrollment_analytics_enrollment_id',
      'idx_enrollment_analytics_event_type',
      'idx_enrollment_analytics_timestamp'
    ];
    
    const foundIndexes = indexCheck.rows.map(row => row.indexname);
    
    for (const expectedIndex of expectedIndexes) {
      if (!foundIndexes.includes(expectedIndex)) {
        throw new Error(`Index ${expectedIndex} not found`);
      }
    }
    
    console.log('✓ All required indexes exist');
    
    console.log('Migration validation passed: Add Enrollments');
    
  } catch (error) {
    console.error('Migration validation failed:', error);
    throw error;
  }
}

module.exports = {
  up,
  down,
  validate,
  version: '003',
  description: 'Add Enrollments',
  dependencies: ['002']
};
