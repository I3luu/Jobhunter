const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jobhunter',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
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
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
