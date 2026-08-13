import { pool } from "./index";

// Split into separate statements so each succeeds independently
const TABLES = [
  `CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'Presenter',
    department VARCHAR(255) DEFAULT 'SHERQ',
    email VARCHAR(255),
    birthday VARCHAR(10),
    pin VARCHAR(255),
    pin_reset_requested BOOLEAN NOT NULL DEFAULT false,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS roster_assignments (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    member_id INTEGER,
    topic VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    no_talk_reason VARCHAR(50),
    no_talk_presenter VARCHAR(255),
    no_talk_topic VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    added_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS roster_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value VARCHAR(500) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE,
    added_by VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS action_history (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    detail TEXT,
    changed_by VARCHAR(255),
    snapshot_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `ALTER TABLE action_history ADD COLUMN IF NOT EXISTS changed_by VARCHAR(255)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    reply_to_id INTEGER,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  // Add columns that might be missing on older databases
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS pin VARCHAR(255)`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS pin_reset_requested BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS birthday VARCHAR(10)`,
  `ALTER TABLE roster_assignments ADD COLUMN IF NOT EXISTS no_talk_reason VARCHAR(50)`,
  `ALTER TABLE roster_assignments ADD COLUMN IF NOT EXISTS no_talk_presenter VARCHAR(255)`,
  `ALTER TABLE roster_assignments ADD COLUMN IF NOT EXISTS no_talk_topic VARCHAR(500)`,
];

let migrated = false;

export async function ensureTables() {
  if (migrated) return;
  try {
    for (const sql of TABLES) {
      try {
        await pool.query(sql);
      } catch (e) {
        // Ignore individual ALTER failures (column already exists, etc.)
      }
    }
    migrated = true;
  } catch (err) {
    console.error("Migration error:", err);
  }
}
