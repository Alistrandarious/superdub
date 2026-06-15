require('dotenv').config();
const { Client } = require('pg');

const SQL = `
-- Drop old single-user tables (all empty, safe to drop)
DROP TABLE IF EXISTS tracker_habits;
DROP TABLE IF EXISTS tracker;
DROP TABLE IF EXISTS diet_plans;
DROP TABLE IF EXISTS diet_settings;
DROP TABLE IF EXISTS diet_target;
DROP TABLE IF EXISTS habits;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS profile;

-- Users
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profile (one per user, created at sign-up)
CREATE TABLE profile (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL DEFAULT '',
  height_cm TEXT NOT NULL DEFAULT '',
  weight_kg TEXT NOT NULL DEFAULT '',
  age       TEXT NOT NULL DEFAULT '',
  sex       TEXT NOT NULL DEFAULT 'male',
  activity  TEXT NOT NULL DEFAULT '1.55',
  steps     TEXT NOT NULL DEFAULT '',
  vest_kg   TEXT NOT NULL DEFAULT ''
);

-- Weight & goal settings (home page chart inputs, persisted per user)
CREATE TABLE weight_settings (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_weight TEXT NOT NULL DEFAULT '',
  goal_weight    TEXT NOT NULL DEFAULT '',
  loss_per_week  TEXT NOT NULL DEFAULT '',
  time_days      TEXT NOT NULL DEFAULT '',
  height         TEXT NOT NULL DEFAULT '',
  age            TEXT NOT NULL DEFAULT '',
  activity_level TEXT NOT NULL DEFAULT '1.4'
);

-- Ordered habits list (per user)
CREATE TABLE habits (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, name)
);

-- Diet macro targets (one per user)
CREATE TABLE diet_target (
  user_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  calories INTEGER NOT NULL DEFAULT 2003,
  protein  INTEGER NOT NULL DEFAULT 150,
  carbs    INTEGER NOT NULL DEFAULT 200,
  fats     INTEGER NOT NULL DEFAULT 67
);

-- Diet lock states (one per user)
CREATE TABLE diet_settings (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lock_protein BOOLEAN NOT NULL DEFAULT FALSE,
  lock_carbs   BOOLEAN NOT NULL DEFAULT FALSE,
  lock_fats    BOOLEAN NOT NULL DEFAULT FALSE,
  calorie_lock BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tasks (per user)
CREATE TABLE tasks (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Daily tracker rows (per user + dd/mm day key)
CREATE TABLE tracker (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  weight   TEXT NOT NULL DEFAULT '',
  calories TEXT NOT NULL DEFAULT '',
  protein  TEXT NOT NULL DEFAULT '',
  carbs    TEXT NOT NULL DEFAULT '',
  fats     TEXT NOT NULL DEFAULT '',
  steps    TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, day)
);

-- Per-day habit completion (per user + day + habit)
CREATE TABLE tracker_habits (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  habit_name TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, day, habit_name)
);

-- Saved meal plans (per user)
CREATE TABLE diet_plans (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  meals      JSONB NOT NULL,
  totals     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);
`;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to Neon.');
  await client.query(SQL);
  console.log('Migration v2 complete — multi-user schema ready.');
  await client.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
