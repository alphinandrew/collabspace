const fs = require('fs');
const path = require('path');
const config = require('../config');

let dbInstance = null;

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function getDatabase() {
  if (dbInstance) return dbInstance;

  // Cloud PostgreSQL Driver
  if (config.db.driver === 'postgres' || config.db.url) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: config.db.url,
      ssl: config.db.url.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    const dbWrapper = {
      driver: 'postgres',
      raw: pool,

      async run(sql, params = []) {
        const pgSql = toPgSql(sql);
        return pool.query(pgSql, params);
      },

      async get(sql, params = []) {
        const pgSql = toPgSql(sql);
        const res = await pool.query(pgSql, params);
        return res.rows[0] || null;
      },

      async all(sql, params = []) {
        const pgSql = toPgSql(sql);
        const res = await pool.query(pgSql, params);
        return res.rows;
      },

      async exec(sql) {
        return pool.query(sql);
      },

      persist() {}
    };

    await initSchema(dbWrapper);
    dbInstance = dbWrapper;
    console.log('✅ Connected to Cloud Persistent PostgreSQL database.');
    return dbInstance;
  }

  // SQLite Driver for Local Offline Development
  const initSqlJs = require('sql.js');
  const dbDir = path.dirname(config.db.sqlitePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(config.db.sqlitePath)) {
    const fileBuffer = fs.readFileSync(config.db.sqlitePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Persistence helper
  const persist = () => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(config.db.sqlitePath, buffer);
    } catch (err) {
      console.error('Error persisting database to disk:', err);
    }
  };

  // Wrapper with parameterized query safety
  const dbWrapper = {
    driver: 'sqlite',
    raw: db,
    persist,

    run(sql, params = []) {
      try {
        db.run(sql, params);
        persist();
      } catch (err) {
        console.error(`DB Run Error on [${sql}]:`, err.message);
        throw err;
      }
    },

    get(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return null;
      } catch (err) {
        console.error(`DB Get Error on [${sql}]:`, err.message);
        throw err;
      }
    },

    all(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      } catch (err) {
        console.error(`DB All Error on [${sql}]:`, err.message);
        throw err;
      }
    },

    exec(sql) {
      db.exec(sql);
      persist();
    }
  };

  // Run migrations
  await initSchema(dbWrapper);

  dbInstance = dbWrapper;
  return dbInstance;
}

async function initSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      avatar TEXT,
      password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'online',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatar TEXT,
      owner_id TEXT NOT NULL,
      join_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
      joined_at TEXT NOT NULL,
      UNIQUE(group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      max_uses INTEGER DEFAULT 0, -- 0 = unlimited
      uses_count INTEGER DEFAULT 0,
      expires_at TEXT,
      is_revoked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'file', 'system'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      initiated_by TEXT NOT NULL,
      call_type TEXT NOT NULL DEFAULT 'video', -- 'voice', 'video'
      status TEXT NOT NULL DEFAULT 'ringing', -- 'ringing', 'active', 'ended'
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (initiated_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_groups_join_code ON groups(join_code);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
    CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_files_group ON files(group_id, created_at);
  `);
}

module.exports = {
  getDatabase,
};
