/**
 * Run this once to create the `jobhunter` database and `jobs` table.
 *
 * Usage:
 *   DB_USER=postgres DB_PASSWORD=secret node scripts/setup-db.js
 */
require('dotenv').config();
const { Client } = require('pg');

async function setup() {
  // Connect to the default postgres DB first to create our database
  const admin = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  await admin.connect();

  const dbName = process.env.DB_NAME || 'jobhunter';

  const exists = await admin.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName]
  );

  if (exists.rows.length === 0) {
    await admin.query(`CREATE DATABASE ${dbName}`);
    console.log(`✅ Database "${dbName}" created`);
  } else {
    console.log(`ℹ️  Database "${dbName}" already exists`);
  }

  await admin.end();

  // Now connect to jobhunter DB and create the table
  const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: dbName,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  await db.connect();

  await db.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      external_id VARCHAR(255) UNIQUE,
      title VARCHAR(500) NOT NULL,
      company VARCHAR(255) NOT NULL,
      company_logo VARCHAR(1000),
      location VARCHAR(255),
      job_type VARCHAR(100),
      salary_min INTEGER,
      salary_max INTEGER,
      salary_currency VARCHAR(10),
      description TEXT,
      url VARCHAR(1000),
      tags TEXT[],
      date_posted TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('✅ Table "jobs" ready');
  await db.end();
  console.log('🎉 Setup complete! You can now run: node server.js');
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
