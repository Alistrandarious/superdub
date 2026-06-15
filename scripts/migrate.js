require('dotenv').config();
const { Client } = require('pg');

const SQL = `
-- Profile (single row, id always 1)
CREATE TABLE IF NOT EXISTS profile (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  name       TEXT NOT NULL DEFAULT '',
  height_cm  TEXT NOT NULL DEFAULT '',
  weight_kg  TEXT NOT NULL DEFAULT '',
  age        TEXT NOT NULL DEFAULT '',
  sex        TEXT NOT NULL DEFAULT 'male',
  activity   TEXT NOT NULL DEFAULT '1.55',
  steps      TEXT NOT NULL DEFAULT '',
  vest_kg    TEXT NOT NULL DEFAULT ''
);
INSERT INTO profile (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Ordered habits list
CREATE TABLE IF NOT EXISTS habits (
  name     TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0
);

-- Diet macro targets (single row, id always 1)
CREATE TABLE IF NOT EXISTS diet_target (
  id       INTEGER PRIMARY KEY DEFAULT 1,
  calories INTEGER NOT NULL DEFAULT 2003,
  protein  INTEGER NOT NULL DEFAULT 150,
  carbs    INTEGER NOT NULL DEFAULT 200,
  fats     INTEGER NOT NULL DEFAULT 67
);
INSERT INTO diet_target (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Diet lock settings (single row, id always 1)
CREATE TABLE IF NOT EXISTS diet_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  lock_protein  BOOLEAN NOT NULL DEFAULT FALSE,
  lock_carbs    BOOLEAN NOT NULL DEFAULT FALSE,
  lock_fats     BOOLEAN NOT NULL DEFAULT FALSE,
  calorie_lock  BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO diet_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily tracker rows (one per dd/mm day key)
CREATE TABLE IF NOT EXISTS tracker (
  day      TEXT PRIMARY KEY,
  weight   TEXT NOT NULL DEFAULT '',
  calories TEXT NOT NULL DEFAULT '',
  protein  TEXT NOT NULL DEFAULT '',
  carbs    TEXT NOT NULL DEFAULT '',
  fats     TEXT NOT NULL DEFAULT '',
  steps    TEXT NOT NULL DEFAULT ''
);

-- Per-day habit completion (one row per day + habit)
CREATE TABLE IF NOT EXISTS tracker_habits (
  day        TEXT    NOT NULL,
  habit_name TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (day, habit_name)
);

-- Saved meal plans (up to 5, pruned by the API)
CREATE TABLE IF NOT EXISTS diet_plans (
  id         TEXT PRIMARY KEY,
  label      TEXT  NOT NULL,
  meals      JSONB NOT NULL,
  totals     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to Neon.');
  await client.query(SQL);
  console.log('Migration complete — all tables created.');
  await client.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
