exports.up = async function(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_versions (
      id VARCHAR(255) PRIMARY KEY,
      content_id VARCHAR(255) NOT NULL,
      version INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      content JSONB NOT NULL,
      media_files JSONB DEFAULT '[]',
      changes JSONB NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_current BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMP,
      UNIQUE(content_id, version)
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_versions_content_id ON content_versions(content_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_versions_content_version ON content_versions(content_id, version)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_versions_current ON content_versions(content_id, is_current)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_versions_created_by ON content_versions(created_by)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_versions_created_at ON content_versions(created_at)');

  await pool.query(`
    ALTER TABLE content
    ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_version_update TIMESTAMP,
    ADD COLUMN IF NOT EXISTS auto_versioning BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS max_versions INTEGER DEFAULT 0
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_current_version ON content(current_version)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_content_auto_versioning ON content(auto_versioning)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS version_comparison_cache (
      id VARCHAR(255) PRIMARY KEY,
      content_id VARCHAR(255) NOT NULL,
      version1 INTEGER NOT NULL,
      version2 INTEGER NOT NULL,
      comparison_data JSONB NOT NULL,
      cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_version_comparison_lookup ON version_comparison_cache(content_id, version1, version2)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_version_comparison_expires ON version_comparison_cache(expires_at)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS version_restore_history (
      id VARCHAR(255) PRIMARY KEY,
      content_id VARCHAR(255) NOT NULL,
      restored_from_version_id VARCHAR(255) NOT NULL,
      restored_from_version_number INTEGER NOT NULL,
      restored_by VARCHAR(255) NOT NULL,
      restore_reason TEXT,
      restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_version_restore_content ON version_restore_history(content_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_version_restore_user ON version_restore_history(restored_by)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_version_restore_date ON version_restore_history(restored_at)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS version_settings (
      content_id VARCHAR(255) PRIMARY KEY,
      auto_versioning BOOLEAN DEFAULT TRUE,
      max_versions INTEGER DEFAULT 0,
      custom_settings JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_version_settings_auto_versioning ON version_settings(auto_versioning)');

  await pool.query(`
    INSERT INTO version_settings (content_id, max_versions, auto_versioning, custom_settings, created_at, updated_at)
    VALUES ('default_version_settings', 50, TRUE, '{"auto_cleanup_old_versions": true, "cleanup_retention_days": 365, "enable_comparison_cache": true, "cache_expiry_hours": 24, "require_change_description": true, "enable_auto_versioning": true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (content_id) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO content_versions (
      id, content_id, version, title, description, content,
      media_files, changes, created_by, is_current, created_at
    )
    SELECT
      'ver_' || id || '_initial',
      id,
      1,
      title,
      description,
      content,
      COALESCE(media_files, '[]'::jsonb),
      '["Initial version created during migration"]'::jsonb,
      created_by,
      TRUE,
      created_at
    FROM content
    WHERE id NOT IN (SELECT DISTINCT content_id FROM content_versions)
  `);

  await pool.query(`
    UPDATE content
    SET
      current_version = 1,
      last_version_update = created_at,
      auto_versioning = TRUE,
      max_versions = 0
    WHERE id IN (SELECT DISTINCT content_id FROM content_versions)
  `);

  await pool.query(`
    INSERT INTO version_settings (content_id, auto_versioning, max_versions, created_at, updated_at)
    SELECT id, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM content
    WHERE id NOT IN (SELECT content_id FROM version_settings)
    ON CONFLICT (content_id) DO NOTHING
  `);
};

exports.down = async function(pool) {
  await pool.query('DROP TABLE IF EXISTS version_restore_history');
  await pool.query('DROP TABLE IF EXISTS version_comparison_cache');
  await pool.query('DROP TABLE IF EXISTS version_settings');

  await pool.query('ALTER TABLE content DROP COLUMN IF EXISTS current_version');
  await pool.query('ALTER TABLE content DROP COLUMN IF EXISTS last_version_update');
  await pool.query('ALTER TABLE content DROP COLUMN IF EXISTS auto_versioning');
  await pool.query('ALTER TABLE content DROP COLUMN IF EXISTS max_versions');

  await pool.query('DROP TABLE IF EXISTS content_versions');

  await pool.query("DELETE FROM version_settings WHERE content_id = 'default_version_settings'");
};

exports.helpers = {
  createInitialVersions: async function(pool, contentIds) {
    for (const contentId of contentIds) {
      const result = await pool.query('SELECT * FROM content WHERE id = $1', [contentId]);
      const content = result.rows[0];
      if (content) {
        await pool.query(`
          INSERT INTO content_versions (id, content_id, version, title, description, content, media_files, changes, created_by, is_current, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          `ver_${contentId}_initial`,
          contentId,
          1,
          content.title,
          content.description,
          content.content,
          content.media_files || '[]',
          JSON.stringify(['Initial version created during migration']),
          content.created_by,
          true,
          content.created_at
        ]);
      }
    }
  },

  migrateExistingContent: async function(pool) {
    const result = await pool.query('SELECT id FROM content');
    const contentIds = result.rows.map(c => c.id);
    if (contentIds.length > 0) {
      await this.createInitialVersions(pool, contentIds);
    }
  },

  validateMigration: async function(pool) {
    const issues = [];

    const noSettings = await pool.query(`
      SELECT COUNT(*) as count FROM content c
      LEFT JOIN version_settings vs ON c.id = vs.content_id
      WHERE vs.content_id IS NULL
    `);
    if (parseInt(noSettings.rows[0].count) > 0) {
      issues.push(`${noSettings.rows[0].count} content items missing version settings`);
    }

    const noVersions = await pool.query(`
      SELECT COUNT(*) as count FROM content c
      LEFT JOIN content_versions cv ON c.id = cv.content_id
      WHERE cv.content_id IS NULL
    `);
    if (parseInt(noVersions.rows[0].count) > 0) {
      issues.push(`${noVersions.rows[0].count} content items missing versions`);
    }

    const dupCurrent = await pool.query(`
      SELECT content_id FROM content_versions
      WHERE is_current = TRUE
      GROUP BY content_id
      HAVING COUNT(*) > 1
    `);
    if (dupCurrent.rows.length > 0) {
      issues.push(`${dupCurrent.rows.length} content items have multiple current versions`);
    }

    return issues;
  }
};
