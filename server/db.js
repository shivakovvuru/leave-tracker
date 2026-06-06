// Database setup for the Leave Tracker using sql.js (pure JS / WASM).
// Data is persisted to server/data/leave_tracker.db on every write.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'leave_tracker.db');

let SQL = null;
let db  = null;

function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbFile, Buffer.from(data));
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function bindAndCollect(stmt, params, collectAll) {
  if (params && params.length) {
    const flat = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
    if (flat && flat.length) stmt.bind(flat);
  }
  if (collectAll) {
    const r = [];
    while (stmt.step()) r.push(stmt.getAsObject());
    return r;
  }
  return stmt.step() ? stmt.getAsObject() : null;
}

const dbApi = {
  exec(sql) { db.exec(sql); persist(); },
  prepare(sql) { return db.prepare(sql); },
  run(sql, ...p) {
    const stmt = db.prepare(sql);
    if (p && p.length) {
      const flat = (p.length === 1 && Array.isArray(p[0])) ? p[0] : p;
      if (flat && flat.length) stmt.bind(flat);
    }
    stmt.step();
    stmt.free();
    persist();
  },
  all(sql, ...p) {
    const stmt = db.prepare(sql);
    const r = bindAndCollect(stmt, p, true);
    stmt.free();
    return r;
  },
  get(sql, ...p) {
    const stmt = db.prepare(sql);
    const r = bindAndCollect(stmt, p, false);
    stmt.free();
    return r;
  },
  lastInsertRowid(tableName) {
    if (tableName) {
      try {
        const r = db.exec(`SELECT seq FROM sqlite_sequence WHERE name = "${tableName}"`);
        if (r && r[0] && r[0].values && r[0].values[0]) return r[0].values[0][0];
      } catch (e) { /* fall through */ }
    }
    try {
      const r = db.exec('SELECT last_insert_rowid() AS id');
      if (r && r[0] && r[0].values && r[0].values[0]) return r[0].values[0][0];
    } catch (e) { /* fall through */ }
    return 0;
  },
};

async function init() {
  if (db) return dbApi;
  SQL = await initSqlJs();

  if (fs.existsSync(dbFile)) {
    const fileBuffer = fs.readFileSync(dbFile);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize schema (idempotent)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',     -- 'admin' | 'member'
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      mobile TEXT,
      approved INTEGER NOT NULL DEFAULT 0,     -- admin-approval gate for new signups
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fiscal_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER UNIQUE NOT NULL,
      label TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      description TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role_id INTEGER,
      project_id INTEGER,
      join_date TEXT,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    -- leave_type: 'PL' (Planned Leave) | 'Sick Leave' | 'Unplanned Leave'
    -- status:    'Pending' (member-submitted update) | 'Approved' (admin-approved) | 'Rejected'
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      project_id INTEGER,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days REAL DEFAULT 1,
      reason TEXT,
      status TEXT DEFAULT 'Approved',
      pending_update INTEGER NOT NULL DEFAULT 0,
      pending_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS public_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      fiscal_year_id INTEGER,
      FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                  -- 'leave_submitted' | 'leave_approved' | 'leave_rejected' | 'leave_cancelled' | 'leave_changed'
      message TEXT NOT NULL,
      leave_id INTEGER,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_id) REFERENCES leaves(id) ON DELETE CASCADE
    );
  `);

  // Seed admin user (only if no users exist)
  const userCount = dbApi.get('SELECT COUNT(*) AS c FROM users').c;
  if (userCount === 0) {
    const { salt, hash } = hashPassword('admin123');
    dbApi.run(
      `INSERT INTO users (email, password_hash, password_salt, role, name, first_name, last_name, mobile, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['admin@company.com', hash, salt, 'admin', 'Administrator', 'Admin', 'User', '+1-555-0001', 1]
    );
  }

  // Seed current + next fiscal year
  const yearCount = dbApi.get('SELECT COUNT(*) AS c FROM fiscal_years').c;
  if (yearCount === 0) {
    const y = new Date().getFullYear();
    dbApi.run('INSERT INTO fiscal_years (year, label, active) VALUES (?, ?, ?)', [y,     `FY ${y}`,     1]);
    dbApi.run('INSERT INTO fiscal_years (year, label, active) VALUES (?, ?, ?)', [y + 1, `FY ${y + 1}`, 1]);
  }

  // Seed roles
  const roleCount = dbApi.get('SELECT COUNT(*) AS c FROM roles').c;
  if (roleCount === 0) {
    const insert = db.prepare('INSERT INTO roles (name) VALUES (?)');
    ['Project Manager', 'Team Lead', 'Senior Developer', 'Developer',
     'QA Engineer', 'UI/UX Designer', 'DevOps Engineer', 'Business Analyst'].forEach(r => insert.run([r]));
    insert.free();
  }

  // Seed projects + sample data only if no projects exist
  const projCount = dbApi.get('SELECT COUNT(*) AS c FROM projects').c;
  if (projCount === 0) {
    const y = new Date().getFullYear();
    dbApi.run(`INSERT INTO projects (name, code, description, start_date, end_date, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              ['Website Redesign', 'WEB-2026', 'Marketing site overhaul with new CMS',
               `${y}-01-15`, `${y}-08-30`, 'Active']);
    dbApi.run(`INSERT INTO projects (name, code, description, start_date, end_date, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              ['Mobile Banking App', 'MOB-2026', 'iOS + Android banking app, v2.0',
               `${y}-02-01`, `${y}-12-31`, 'Active']);

    const p1 = dbApi.get('SELECT id FROM projects ORDER BY id ASC LIMIT 1').id;
    const p2 = dbApi.get('SELECT id FROM projects ORDER BY id DESC LIMIT 1').id;
    const pm  = dbApi.get('SELECT id FROM roles WHERE name = ?', 'Project Manager').id;
    const dev = dbApi.get('SELECT id FROM roles WHERE name = ?', 'Developer').id;
    const qa  = dbApi.get('SELECT id FROM roles WHERE name = ?', 'QA Engineer').id;

    // Create member-only users so the demo has loginable members
    const demoUsers = [
      { name: 'Aarav Sharma', email: 'aarav@company.com', role: pm, project: p1,  pwd: 'member123' },
      { name: 'Priya Iyer',   email: 'priya@company.com', role: dev, project: p1,  pwd: 'member123' },
      { name: 'Rohan Verma',  email: 'rohan@company.com', role: dev, project: p1,  pwd: 'member123' },
      { name: 'Sara Khan',    email: 'sara@company.com',  role: qa,  project: p1,  pwd: 'member123' },
      { name: 'Vikram Mehta', email: 'vikram@company.com',role: pm,  project: p2,  pwd: 'member123' },
      { name: 'Anita Joshi',  email: 'anita@company.com', role: dev, project: p2,  pwd: 'member123' },
    ];
    for (const u of demoUsers) {
      const { salt, hash } = hashPassword(u.pwd);
      const [firstName, ...rest] = u.name.split(' ');
      const lastName = rest.join(' ') || '';
      dbApi.run(
        `INSERT INTO users (email, password_hash, password_salt, role, name, first_name, last_name, mobile, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.email, hash, salt, 'member', u.name, firstName, lastName, `+1-555-${String(1000 + Math.floor(Math.random() * 9000))}`, 1]
      );
      const userId = dbApi.lastInsertRowid('users');
      dbApi.run(
        `INSERT INTO members (user_id, name, email, role_id, project_id, join_date) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, u.name, u.email, u.role, u.project, `${y}-01-15`]
      );
    }

    // Sample leave records
    const m1 = dbApi.get('SELECT id FROM members WHERE email = ?', 'aarav@company.com').id;
    const m2 = dbApi.get('SELECT id FROM members WHERE email = ?', 'priya@company.com').id;
    const m3 = dbApi.get('SELECT id FROM members WHERE email = ?', 'rohan@company.com').id;
    const m4 = dbApi.get('SELECT id FROM members WHERE email = ?', 'sara@company.com').id;

    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    dbApi.run(`INSERT INTO leaves (member_id, project_id, leave_type, start_date, end_date, days, reason, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [m1, p1, 'PL',  fmt(addDays(today, 3)),  fmt(addDays(today, 5)), 3, 'Family function', 'Approved']);
    dbApi.run(`INSERT INTO leaves (member_id, project_id, leave_type, start_date, end_date, days, reason, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [m2, p1, 'Sick Leave',  fmt(today), fmt(today), 1, 'Fever', 'Approved']);
    dbApi.run(`INSERT INTO leaves (member_id, project_id, leave_type, start_date, end_date, days, reason, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [m3, p1, 'PL',  fmt(addDays(today, 14)), fmt(addDays(today, 18)), 5, 'Vacation', 'Approved']);
    dbApi.run(`INSERT INTO leaves (member_id, project_id, leave_type, start_date, end_date, days, reason, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [m4, p1, 'Unplanned Leave',  fmt(addDays(today, -7)), fmt(addDays(today, -5)), 3, 'Personal errand', 'Approved']);
  }

  // Seed holidays per fiscal year (current + next)
  const holidayCount = dbApi.get('SELECT COUNT(*) AS c FROM public_holidays').c;
  if (holidayCount === 0) {
    const years = dbApi.all('SELECT id, year FROM fiscal_years');
    const insert = db.prepare('INSERT INTO public_holidays (date, name, fiscal_year_id) VALUES (?, ?, ?)');
    const seed = (y, fyId) => [
      [`${y}-01-01`, 'New Year'],
      [`${y}-01-26`, 'Republic Day'],
      [`${y}-05-01`, 'Labour Day'],
      [`${y}-08-15`, 'Independence Day'],
      [`${y}-10-02`, 'Gandhi Jayanti'],
      [`${y}-12-25`, 'Christmas'],
    ];
    years.forEach(({ id, year }) => seed(year, id).forEach(h => insert.run([h[0], h[1], id])));
    insert.free();
  }

  // Backfill first_name/last_name for users that pre-date the profile columns
  // Add new columns on users (idempotent — sql.js has no IF NOT EXISTS for ALTER, so check first)
  const userCols = db.exec("PRAGMA table_info(users)");
  const userColNames = (userCols[0] && userCols[0].values) ? userCols[0].values.map(r => r[1]) : [];
  if (!userColNames.includes('first_name')) db.run('ALTER TABLE users ADD COLUMN first_name TEXT');
  if (!userColNames.includes('last_name'))  db.run('ALTER TABLE users ADD COLUMN last_name TEXT');
  if (!userColNames.includes('mobile'))     db.run('ALTER TABLE users ADD COLUMN mobile TEXT');

  const noFirst = dbApi.all("SELECT id, name FROM users WHERE first_name IS NULL OR first_name = ''");
  for (const u of noFirst) {
    const parts = (u.name || '').trim().split(/\s+/);
    const first = parts[0] || '';
    const last  = parts.slice(1).join(' ') || '';
    dbApi.run('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?', [first, last, u.id]);
  }

  persist();
  return dbApi;
}

module.exports = { init, db: dbApi, hashPassword, verifyPassword, makeToken };
