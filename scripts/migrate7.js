require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`
    ALTER TABLE profile ADD COLUMN IF NOT EXISTS gym_sessions_per_week INTEGER DEFAULT 3;
    ALTER TABLE profile ADD COLUMN IF NOT EXISTS gym_intensity TEXT DEFAULT 'moderate';
    ALTER TABLE profile ADD COLUMN IF NOT EXISTS gym_minutes INTEGER DEFAULT 60;
    ALTER TABLE profile ADD COLUMN IF NOT EXISTS weekly_activities TEXT DEFAULT '[]';
  `);
  console.log('profile: gym_sessions_per_week, gym_intensity, gym_minutes, weekly_activities columns added');
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
