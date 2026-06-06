const fetch = require('node-fetch');
const { pool } = require('../db');

const REMOTIVE_BASE = 'https://remotive.com/api/remote-jobs';
const CATEGORIES = ['software-dev', 'devops-sysadmin', 'data-science'];

const JOB_TYPE_MAP = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contractor',
  freelance: 'Freelance',
  internship: 'Internship',
};

// A job passes if it has at least one of these tags
const TECH_TAGS = new Set([
  'api', 'aws', 'azure', 'backend', 'blockchain', 'c', 'c#', 'c++', 'cloud',
  'css', 'data engineering', 'data science', 'database', 'devops', 'docker',
  'elasticsearch', 'engineering', 'frontend', 'fullstack', 'gcp', 'git',
  'golang', 'html', 'infrastructure', 'ios', 'android', 'java', 'javascript',
  'kubernetes', 'linux', 'machine learning', 'mobile', 'mongodb', 'mysql',
  'next.js', 'node.js', 'php', 'postgresql', 'python', 'react', 'react native',
  'redis', 'rest', 'ruby/rails', 'rust', 'security', 'sql', 'swift',
  'terraform', 'testing', 'typescript', 'ui/ux', 'unity', 'vue', 'web',
  'ai/ml', 'nlp', 'spark', 'kafka', 'microservices', 'system architecture',
  'bash', 'scala', 'kotlin', 'flutter', 'solidity', 'angular',
]);

// A job is rejected if its title contains any of these (case-insensitive)
const TITLE_BLOCKLIST = [
  'writer', 'copywriter', 'sales', 'recruiter', 'recruiting', 'hr ',
  'human resources', 'accountant', 'accounting', 'bookkeeper', 'payroll',
  'coordinator', 'office assistant', 'office manager', 'paralegal',
  'customer success', 'customer support', 'customer service', 'customer operations',
  'social media', 'content creator', 'graphic design', 'video editor',
  'translator', 'transcri', 'tutor', 'coach', 'therapist', 'pharmacist',
  'nurse', 'medical', 'dental', 'insurance agent', 'loan officer',
  'real estate', 'inside sales', 'business development', 'account executive',
  'data labeling', 'data annotation', 'data entry',
  'business transformation', 'director of revenue', 'revenue systems',
  'people operations', 'talent acquisition', 'operations specialist',
];

function isTechJob(job) {
  const title = (job.title || '').toLowerCase();
  const tags = (job.tags || []).map(t => t.toLowerCase());

  // Reject on title blocklist first
  if (TITLE_BLOCKLIST.some(word => title.includes(word))) return false;

  // Must have at least one recognized tech tag
  return tags.some(tag => TECH_TAGS.has(tag));
}

// Normalize a title for deduplication — strips trailing city/location in parens
// e.g. "Staff SWE (São Paulo)" → "staff swe"
function normalizeTitle(title) {
  return title.replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase();
}

function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.company_name}||${normalizeTitle(job.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function syncJobsFromHimalayas() {
  console.log('🔄 Syncing jobs from Remotive API...');

  let raw = [];

  try {
    for (const category of CATEGORIES) {
      const response = await fetch(`${REMOTIVE_BASE}?category=${category}`, {
        headers: { 'User-Agent': 'JobHunterApp/1.0', 'Accept': 'application/json' },
        timeout: 10000,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      raw.push(...(data.jobs || []));
    }
  } catch (err) {
    console.warn(`⚠️  Remotive API unreachable: ${err.message}`);
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const filtered = deduplicateJobs(raw.filter(isTechJob));
  console.log(`📥 Fetched ${raw.length} raw → ${filtered.length} after filter + dedup`);

  let inserted = 0;
  let skipped = 0;

  for (const job of filtered) {
    try {
      const result = await pool.query(
        `INSERT INTO jobs
          (external_id, title, company, company_logo, location, job_type,
           salary_min, salary_max, salary_currency, description, url, tags, date_posted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [
          String(job.id),
          job.title,
          job.company_name,
          job.company_logo || null,
          job.candidate_required_location || 'Remote',
          JOB_TYPE_MAP[job.job_type] || job.job_type || null,
          null,
          null,
          null,
          job.description || null,
          job.url,
          job.tags || [],
          job.publication_date ? new Date(job.publication_date) : null,
        ]
      );

      if (result.rows.length > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`⚠️  Failed to insert "${job.title}":`, err.message);
      skipped++;
    }
  }

  console.log(`✅ Sync complete: ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped, total: filtered.length };
}

module.exports = { syncJobsFromHimalayas };
