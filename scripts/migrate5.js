require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS start_date TEXT;
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  console.log('habits: start_date and archived columns added');
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
