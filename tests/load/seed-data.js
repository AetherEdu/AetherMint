/**
 * Test Data Seeder for Load Tests
 *
 * Populates the database with realistic test data before running k6 load tests.
 * Connects to PostgreSQL and inserts courses, users, credentials, and enrollments.
 *
 * Usage:
 *   node tests/load/seed-data.js
 *
 * Environment variables:
 *   DB_HOST     - PostgreSQL host (default: localhost)
 *   DB_PORT     - PostgreSQL port (default: 5432)
 *   DB_NAME     - Database name (default: aethermint_test)
 *   DB_USER     - Database user (default: aethermint)
 *   DB_PASSWORD - Database password (default: aethermint_dev)
 *   SEED_COUNT  - Number of records per entity (default: 200)
 *
 * SAFETY: This script only inserts into tables prefixed with 'load_test_' or
 * uses a dedicated test database (aethermint_test). It NEVER touches production.
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'aethermint_test';
const DB_USER = process.env.DB_USER || 'aethermint';
const DB_PASSWORD = process.env.DB_PASSWORD || 'aethermint_dev';
const SEED_COUNT = parseInt(process.env.SEED_COUNT || '200', 10);

// Safety check: refuse to run against production database
if (DB_NAME === 'aethermint' && process.env.NODE_ENV === 'production') {
  console.error('ERROR: Refusing to seed data into production database.');
  console.error('Set DB_NAME=aethermint_test or NODE_ENV!=production.');
  process.exit(1);
}

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
});

const COURSE_TITLES = [
  'Introduction to Blockchain',
  'Smart Contract Development',
  'DeFi Fundamentals',
  'NFT Creation and Management',
  'Decentralized Identity',
  'Web3 Security Essentials',
  'Tokenomics Design',
  'DAO Governance Models',
  'Cross-Chain Protocols',
  'Zero-Knowledge Proofs',
  'Stellar Soroban Development',
  'Rust for Blockchain',
  'Federated Learning Basics',
  'Quantum-Resistant Cryptography',
  'AI-Powered Tutoring Systems',
];

const CATEGORIES = ['blockchain', 'defi', 'nft', 'security', 'identity', 'ai', 'governance'];
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureTables() {
  const client = await pool.connect();
  try {
    // Create load-test-specific tables to avoid polluting production data
    await client.query(`
      CREATE TABLE IF NOT EXISTS load_test_users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS load_test_courses (
        id UUID PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        difficulty VARCHAR(50),
        instructor_id UUID REFERENCES load_test_users(id),
        duration_hours INTEGER,
        enrollment_count INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS load_test_credentials (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES load_test_users(id),
        course_id UUID REFERENCES load_test_courses(id),
        credential_type VARCHAR(100) NOT NULL,
        issued_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        is_revoked BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS load_test_enrollments (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES load_test_users(id),
        course_id UUID REFERENCES load_test_courses(id),
        enrolled_at TIMESTAMP DEFAULT NOW(),
        progress DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS load_test_analytics_snapshots (
        id UUID PRIMARY KEY,
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(20,4),
        dimensions JSONB DEFAULT '{}',
        recorded_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Load test tables created/verified');
  } finally {
    client.release();
  }
}

async function seedUsers(count) {
  const client = await pool.connect();
  try {
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const email = `loadtest_${i}@aethermint.test`;
      const name = `Test User ${i}`;
      const passwordHash = await bcrypt.hash(`password_${i}`, 4);
      const role = i % 10 === 0 ? 'instructor' : 'student';

      values.push(id, email, name, passwordHash, role);
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      paramIndex += 5;
    }

    await client.query(`
      INSERT INTO load_test_users (id, email, name, password_hash, role)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, values);

    console.log(`✓ Seeded ${count} users`);
  } finally {
    client.release();
  }
}

async function seedCourses(count) {
  const client = await pool.connect();
  try {
    // Get instructor IDs
    const { rows: instructors } = await client.query(
      "SELECT id FROM load_test_users WHERE role = 'instructor' LIMIT 20"
    );

    if (instructors.length === 0) {
      console.error('No instructors found. Seed users first.');
      return;
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const title = `${randomItem(COURSE_TITLES)} - Module ${i + 1}`;
      const description = `Comprehensive course covering ${randomItem(COURSE_TITLES).toLowerCase()} topics.`;
      const category = randomItem(CATEGORIES);
      const difficulty = randomItem(DIFFICULTY_LEVELS);
      const instructorId = randomItem(instructors).id;
      const durationHours = randomInt(2, 40);
      const enrollmentCount = randomInt(0, 500);
      const rating = (Math.random() * 2 + 3).toFixed(2); // 3.0 - 5.0

      values.push(id, title, description, category, difficulty, instructorId, durationHours, enrollmentCount, rating);
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`);
      paramIndex += 9;
    }

    await client.query(`
      INSERT INTO load_test_courses (id, title, description, category, difficulty, instructor_id, duration_hours, enrollment_count, rating)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, values);

    console.log(`✓ Seeded ${count} courses`);
  } finally {
    client.release();
  }
}

async function seedCredentials(count) {
  const client = await pool.connect();
  try {
    const { rows: users } = await client.query('SELECT id FROM load_test_users LIMIT 100');
    const { rows: courses } = await client.query('SELECT id FROM load_test_courses LIMIT 50');

    if (users.length === 0 || courses.length === 0) {
      console.error('Need users and courses first.');
      return;
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    const credentialTypes = ['completion', 'achievement', 'certification', 'badge'];

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const userId = randomItem(users).id;
      const courseId = randomItem(courses).id;
      const credType = randomItem(credentialTypes);
      const issuedAt = new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000));
      const expiresAt = new Date(issuedAt.getTime() + randomInt(30, 365) * 24 * 60 * 60 * 1000);

      values.push(id, userId, courseId, credType, issuedAt, expiresAt);
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
      paramIndex += 6;
    }

    await client.query(`
      INSERT INTO load_test_credentials (id, user_id, course_id, credential_type, issued_at, expires_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, values);

    console.log(`✓ Seeded ${count} credentials`);
  } finally {
    client.release();
  }
}

async function seedEnrollments(count) {
  const client = await pool.connect();
  try {
    const { rows: users } = await client.query('SELECT id FROM load_test_users LIMIT 100');
    const { rows: courses } = await client.query('SELECT id FROM load_test_courses LIMIT 50');

    if (users.length === 0 || courses.length === 0) {
      console.error('Need users and courses first.');
      return;
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const userId = randomItem(users).id;
      const courseId = randomItem(courses).id;
      const progress = (Math.random() * 100).toFixed(2);
      const status = randomItem(['active', 'completed', 'dropped']);

      values.push(id, userId, courseId, progress, status);
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      paramIndex += 5;
    }

    await client.query(`
      INSERT INTO load_test_enrollments (id, user_id, course_id, progress, status)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, values);

    console.log(`✓ Seeded ${count} enrollments`);
  } finally {
    client.release();
  }
}

async function seedAnalyticsSnapshots(count) {
  const client = await pool.connect();
  try {
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    const metricNames = [
      'daily_active_users', 'weekly_enrollments', 'completion_rate',
      'avg_session_duration', 'course_views', 'credential_issuances',
    ];

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const metricName = randomItem(metricNames);
      const metricValue = randomInt(10, 10000);
      const dimensions = JSON.stringify({
        category: randomItem(CATEGORIES),
        difficulty: randomItem(DIFFICULTY_LEVELS),
        period: randomItem(['hourly', 'daily', 'weekly']),
      });

      values.push(id, metricName, metricValue, dimensions);
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
      paramIndex += 4;
    }

    await client.query(`
      INSERT INTO load_test_analytics_snapshots (id, metric_name, metric_value, dimensions)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, values);

    console.log(`✓ Seeded ${count} analytics snapshots`);
  } finally {
    client.release();
  }
}

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS load_test_enrollments');
    await client.query('DROP TABLE IF EXISTS load_test_credentials');
    await client.query('DROP TABLE IF EXISTS load_test_courses');
    await client.query('DROP TABLE IF EXISTS load_test_users');
    await client.query('DROP TABLE IF EXISTS load_test_analytics_snapshots');
    console.log('✓ Cleaned up load test tables');
  } finally {
    client.release();
  }
}

async function main() {
  const action = process.argv[2] || 'seed';

  console.log(`\n=== AetherMint Load Test Data Seeder ===`);
  console.log(`Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);
  console.log(`Action: ${action}`);
  console.log(`Seed count: ${SEED_COUNT}\n`);

  try {
    if (action === 'cleanup') {
      await cleanup();
    } else {
      await ensureTables();
      await seedUsers(SEED_COUNT);
      await seedCourses(Math.floor(SEED_COUNT / 2));
      await seedCredentials(SEED_COUNT);
      await seedEnrollments(SEED_COUNT);
      await seedAnalyticsSnapshots(SEED_COUNT);
      console.log('\n✓ Seeding complete!');
      console.log('  Run "node tests/load/seed-data.js cleanup" to remove test data.\n');
    }
  } catch (err) {
    console.error('Seeder error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export IDs for k6 scripts to use
async function exportTestIds() {
  const client = await pool.connect();
  try {
    const { rows: courses } = await client.query('SELECT id FROM load_test_courses LIMIT 50');
    const { rows: credentials } = await client.query('SELECT id FROM load_test_credentials LIMIT 50');
    const { rows: users } = await client.query('SELECT id FROM load_test_users LIMIT 50');

    const exportData = {
      courseIds: courses.map(r => r.id),
      credentialIds: credentials.map(r => r.id),
      userIds: users.map(r => r.id),
    };

    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
      path.join(__dirname, 'test-data.json'),
      JSON.stringify(exportData, null, 2)
    );
    console.log('✓ Exported test IDs to tests/load/test-data.json');
  } finally {
    client.release();
  }
}

// Support: node seed-data.js export
if (process.argv[2] === 'export') {
  main().then(() => exportTestIds()).then(() => process.exit(0));
} else {
  main().then(() => process.exit(0));
}
