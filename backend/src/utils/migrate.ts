import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import logger from './logger';

interface MigrationFile {
  filename: string;
  version: string;
  path: string;
}

interface MigrationModule {
  up: (pool: Pool) => Promise<void> | void;
  down: (pool: Pool) => Promise<void> | void;
  validate?: (pool: Pool) => Promise<void> | void;
  version?: string;
  description?: string;
  dependencies?: string[];
}

interface MigrationRecord {
  id: number;
  version: string;
  name: string;
  applied_at: Date;
  execution_time_ms: number;
}

export class MigrationRunner {
  private readonly pool: Pool;
  private readonly migrationsDir: string;
  private readonly autoRun: boolean;

  constructor(pool: Pool, migrationsDir: string, autoRun: boolean = true) {
    this.pool = pool;
    this.migrationsDir = migrationsDir;
    this.autoRun = autoRun;
  }

  /**
   * Initialize the migrations table if it doesn't exist
   */
  private async initializeMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create index for faster lookups
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
      ON schema_migrations(version)
    `);

    logger.info('Migrations table initialized');
  }

  /**
   * Get all migration files from the migrations directory
   */
  private getMigrationFiles(): MigrationFile[] {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn(`Migrations directory does not exist: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
      .sort();

    return files.map(filename => {
      const version = filename.split('_')[0];
      return {
        filename,
        version,
        path: path.join(this.migrationsDir, filename)
      };
    });
  }

  /**
   * Get applied migrations from the database
   */
  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM schema_migrations ORDER BY version ASC'
    );
    return result.rows;
  }

  /**
   * Load a migration module
   */
  private async loadMigration(migrationPath: string): Promise<MigrationModule> {
    // Clear require cache to ensure fresh load
    delete require.cache[require.resolve(migrationPath)];
    
    const migration = require(migrationPath);
    
    // Handle both CommonJS and ES modules
    if (migration.default) {
      return migration.default;
    }
    
    // Handle Knex-style exports
    if (migration.up && typeof migration.up === 'function') {
      return {
        up: async (pool: Pool) => {
          // Create a Knex-like interface for the pool
          const knexLike = this.createKnexLikeInterface(pool);
          await migration.up(knexLike);
        },
        down: async (pool: Pool) => {
          const knexLike = this.createKnexLikeInterface(pool);
          await migration.down(knexLike);
        }
      };
    }
    
    return migration;
  }

  /**
   * Create a Knex-like interface for compatibility with existing migrations
   */
  private createKnexLikeInterface(pool: Pool) {
    return {
      schema: {
        createTable: (tableName: string, callback: any) => {
          const builder = new TableBuilder(tableName);
          callback(builder);
          return pool.query(builder.getCreateSQL());
        },
        alterTable: (tableName: string, callback: any) => {
          const builder = new TableBuilder(tableName, true);
          callback(builder);
          return pool.query(builder.getAlterSQL());
        },
        dropTableIfExists: (tableName: string) => {
          return pool.query(`DROP TABLE IF EXISTS ${tableName}`);
        },
        hasTable: async (tableName: string) => {
          const result = await pool.query(
            'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
            [tableName]
          );
          return result.rows[0].exists;
        }
      },
      raw: (sql: string) => pool.query(sql),
      query: (table: string) => ({
        where: (column: string, value: any) => ({
          del: () => pool.query(`DELETE FROM ${table} WHERE ${column} = $1`, [value])
        }),
        insert: (data: any) => {
          const columns = Object.keys(data);
          const values = Object.values(data);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          return pool.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }),
      fn: {
        now: () => 'CURRENT_TIMESTAMP'
      }
    };
  }

  /**
   * Run pending migrations
   */
  async up(): Promise<void> {
    try {
      await this.initializeMigrationsTable();

      const migrationFiles = this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));

      const pendingMigrations = migrationFiles.filter(
        m => !appliedVersions.has(m.version)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration, 'up');
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', error);
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  async down(): Promise<void> {
    try {
      await this.initializeMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();

      if (appliedMigrations.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }

      const lastMigration = appliedMigrations[appliedMigrations.length - 1];
      const migrationFiles = this.getMigrationFiles();
      const migrationFile = migrationFiles.find(m => m.version === lastMigration.version);

      if (!migrationFile) {
        throw new Error(`Migration file not found for version ${lastMigration.version}`);
      }

      logger.info(`Rolling back migration: ${lastMigration.version}`);
      await this.runMigration(migrationFile, 'down');

      // Remove migration record
      await this.pool.query(
        'DELETE FROM schema_migrations WHERE version = $1',
        [lastMigration.version]
      );

      logger.info(`Migration ${lastMigration.version} rolled back successfully`);
    } catch (error) {
      logger.error('Rollback failed', error);
      throw error;
    }
  }

  /**
   * Run a single migration with transaction support
   */
  private async runMigration(migration: MigrationFile, direction: 'up' | 'down'): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const startTime = Date.now();
      const migrationModule = await this.loadMigration(migration.path);

      logger.info(`Running migration ${direction}: ${migration.filename}`);

      if (direction === 'up') {
        await migrationModule.up(this.pool);
        
        // Record migration
        await client.query(
          `INSERT INTO schema_migrations (version, name, applied_at, execution_time_ms)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
          [migration.version, migration.filename, Date.now() - startTime]
        );
      } else {
        await migrationModule.down(this.pool);
      }

      await client.query('COMMIT');

      const executionTime = Date.now() - startTime;
      logger.info(`Migration ${direction} completed: ${migration.filename} (${executionTime}ms)`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration ${direction} failed, rolled back: ${migration.filename}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    try {
      await this.initializeMigrationsTable();

      const migrationFiles = this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));

      const pending = migrationFiles.filter(m => !appliedVersions.has(m.version));
      const applied = migrationFiles.filter(m => appliedVersions.has(m.version));

      console.log('\n=== Migration Status ===');
      console.log(`Total migrations: ${migrationFiles.length}`);
      console.log(`Applied: ${applied.length}`);
      console.log(`Pending: ${pending.length}\n`);

      if (applied.length > 0) {
        console.log('Applied migrations:');
        applied.forEach(m => {
          const record = appliedMigrations.find(am => am.version === m.version);
          console.log(`  ✓ ${m.filename} (applied at ${record?.applied_at.toISOString()})`);
        });
      }

      if (pending.length > 0) {
        console.log('\nPending migrations:');
        pending.forEach(m => {
          console.log(`  ○ ${m.filename}`);
        });
      }

      console.log('\n');
    } catch (error) {
      logger.error('Failed to get migration status', error);
      throw error;
    }
  }

  /**
   * Run migrations automatically on startup if configured
   */
  async autoMigrate(): Promise<void> {
    if (this.autoRun) {
      logger.info('Auto-running migrations on startup');
      await this.up();
    } else {
      logger.info('Auto-migration disabled, skipping');
    }
  }
}

/**
 * Simple table builder for Knex-like compatibility
 */
class TableBuilder {
  private readonly columns: string[] = [];
  private readonly indexes: string[] = [];
  private readonly uniques: string[] = [];
  private readonly alterMode: boolean;

  constructor(private readonly tableName: string, alterMode: boolean = false) {
    this.alterMode = alterMode;
  }

  string(name: string, options?: { primary?: boolean; nullable?: boolean; comment?: string }) {
    const sql = `${name} VARCHAR(255)`;
    this.addColumn(name, sql, options);
    return this;
  }

  integer(name: string, options?: { primary?: boolean; nullable?: boolean; comment?: string }) {
    const sql = `${name} INTEGER`;
    this.addColumn(name, sql, options);
    return this;
  }

  text(name: string, options?: { nullable?: boolean; comment?: string }) {
    const sql = `${name} TEXT`;
    this.addColumn(name, sql, options);
    return this;
  }

  timestamp(name: string, options?: { nullable?: boolean; defaultTo?: string; comment?: string }) {
    let sql = `${name} TIMESTAMP`;
    if (options?.defaultTo) {
      sql += ` DEFAULT ${options.defaultTo}`;
    }
    this.addColumn(name, sql, options);
    return this;
  }

  boolean(name: string, options?: { defaultTo?: boolean; comment?: string }) {
    let sql = `${name} BOOLEAN`;
    if (options?.defaultTo !== undefined) {
      sql += ` DEFAULT ${options.defaultTo}`;
    }
    this.addColumn(name, sql, options);
    return this;
  }

  json(name: string, options?: { defaultTo?: string; comment?: string }) {
    let sql = `${name} JSONB`;
    if (options?.defaultTo) {
      sql += ` DEFAULT ${options.defaultTo}`;
    }
    this.addColumn(name, sql, options);
    return this;
  }

  private addColumn(name: string, type: string, options?: any) {
    if (this.alterMode) {
      const nullable = options?.nullable === false ? ' NOT NULL' : '';
      this.columns.push(`ADD COLUMN ${type}${nullable}`);
    } else {
      const constraints = [];
      if (options?.primary) constraints.push('PRIMARY KEY');
      if (options?.nullable === false) constraints.push('NOT NULL');
      if (options?.comment) constraints.push(`COMMENT '${options.comment}'`);
      
      this.columns.push(`${type}${constraints.length ? ' ' + constraints.join(' ') : ''}`);
    }
  }

  index(columns: string | string[], indexName?: string) {
    const colArray = Array.isArray(columns) ? columns : [columns];
    const name = indexName || `idx_${this.tableName}_${colArray.join('_')}`;
    this.indexes.push(
      `CREATE INDEX IF NOT EXISTS ${name} ON ${this.tableName}(${colArray.join(', ')})`
    );
    return this;
  }

  unique(columns: string | string[], uniqueName?: string) {
    const colArray = Array.isArray(columns) ? columns : [columns];
    const name = uniqueName || `uq_${this.tableName}_${colArray.join('_')}`;
    this.uniques.push(
      `CONSTRAINT ${name} UNIQUE (${colArray.join(', ')})`
    );
    return this;
  }

  dropColumn(name: string) {
    this.columns.push(`DROP COLUMN ${name}`);
    return this;
  }

  getCreateSQL(): string {
    const columnsSQL = this.columns.map(c => `  ${c}`).join(',\n');
    const uniqueSQL = this.uniques.length ? ',\n  ' + this.uniques.join(',\n  ') : '';
    
    return `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        ${columnsSQL}${uniqueSQL}
      )
    `;
  }

  getAlterSQL(): string {
    return `ALTER TABLE ${this.tableName}\n  ${this.columns.join(',\n  ')}`;
  }

  getIndexesSQL(): string[] {
    return this.indexes;
  }
}

/**
 * Create database pool from environment variables
 */
export function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

/**
 * Restore a pg_dump backup into the database referenced by DATABASE_URL.
 *
 * Expects a custom-format dump (`pg_dump -Fc`, as produced by
 * scripts/backup-db.sh) and shells out to `pg_restore` so the restore is
 * streamed rather than buffered in memory. Intended for disaster recovery and
 * for the backup-verification flow.
 *
 * @param backupPath Path to a custom-format dump file.
 * @param options.clean When true, drop existing objects before recreating them.
 */
export async function restoreBackup(
  backupPath: string,
  options: { clean?: boolean } = {}
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const args = [
    '--dbname', databaseUrl,
    '--no-owner',
    '--no-privileges',
    '--jobs', '4',
  ];
  if (options.clean) {
    args.push('--clean', '--if-exists');
  }
  args.push(backupPath);

  logger.info(`Restoring backup from ${backupPath}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn('pg_restore', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', err => {
      reject(new Error(`Failed to spawn pg_restore: ${err.message}. Is the PostgreSQL client installed?`));
    });
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_restore exited with code ${code}`));
      }
    });
  });

  logger.info('Backup restore completed successfully');
}

/**
 * Main entry point for CLI commands
 */
export async function runMigrationCommand(command: string, autoRun: boolean = true): Promise<void> {
  const pool = createPool();
  const migrationsDir = path.join(process.cwd(), 'migrations');
  
  try {
    const runner = new MigrationRunner(pool, migrationsDir, autoRun);

    switch (command) {
      case 'up':
        await runner.up();
        break;
      case 'down':
        await runner.down();
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: up, down, status, restore');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// CLI entry point
if (require.main === module) {
  const command = process.argv[2];
  if (!command) {
    console.error('Usage: ts-node src/utils/migrate.ts <command> [args]');
    console.error('Available commands: up, down, status, restore <backup-file> [--clean]');
    process.exit(1);
  }

  if (command === 'restore') {
    const backupPath = process.argv[3];
    if (!backupPath) {
      console.error('Usage: ts-node src/utils/migrate.ts restore <backup-file> [--clean]');
      process.exit(1);
    }
    const clean = process.argv.includes('--clean');
    restoreBackup(backupPath, { clean }).catch(error => {
      console.error('Restore command failed:', error);
      process.exit(1);
    });
  } else {
    runMigrationCommand(command, false).catch(error => {
      console.error('Migration command failed:', error);
      process.exit(1);
    });
  }
}

// Migrater class for programmatic use

export class Migrator {
  async up(): Promise<void> {
    await runMigrationCommand('up', false);
  }

  async down(): Promise<void> {
    await runMigrationCommand('down', false);
  }

  async close(): Promise<void> {
    // no-op — pool is managed internally
  }

  async run(): Promise<void> {
    await this.up();
  }
}
