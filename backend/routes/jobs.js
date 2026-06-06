const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /jobs — fetch all jobs with optional filters
router.get('/', async (req, res) => {
  try {
    const { search, type, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR company ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    if (type) {
      params.push(type);
      query += ` AND job_type = $${params.length}`;
    }

    query += ` ORDER BY date_posted DESC NULLS LAST, created_at DESC`;
    params.push(Number(limit));
    query += ` LIMIT $${params.length}`;
    params.push(Number(offset));
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) FROM jobs WHERE 1=1';
    const countParams = [];
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (title ILIKE $${countParams.length} OR company ILIKE $${countParams.length} OR description ILIKE $${countParams.length})`;
    }
    if (type) {
      countParams.push(type);
      countQuery += ` AND job_type = $${countParams.length}`;
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      jobs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    console.error('GET /jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// POST /jobs — insert a single job
router.post('/', async (req, res) => {
  try {
    const {
      external_id, title, company, company_logo, location,
      job_type, salary_min, salary_max, salary_currency,
      description, url, tags, date_posted,
    } = req.body;

    if (!title || !company) {
      return res.status(400).json({ error: 'title and company are required' });
    }

    const result = await pool.query(
      `INSERT INTO jobs
        (external_id, title, company, company_logo, location, job_type,
         salary_min, salary_max, salary_currency, description, url, tags, date_posted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (external_id) DO NOTHING
       RETURNING *`,
      [external_id, title, company, company_logo, location, job_type,
       salary_min, salary_max, salary_currency, description, url, tags, date_posted]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'Job already exists (duplicate)' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /jobs error:', err);
    res.status(500).json({ error: 'Failed to insert job' });
  }
});

module.exports = router;
