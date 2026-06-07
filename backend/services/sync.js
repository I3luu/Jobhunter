const fetch = require('node-fetch');
const { pool } = require('../db');

// ── Config ────────────────────────────────────────────────────────────────────

const REMOTIVE_CATEGORIES = ['software-dev', 'devops-sysadmin', 'data-science'];

// ── Tech filter ───────────────────────────────────────────────────────────────

const TECH_TAGS = new Set([
  'api', 'aws', 'azure', 'backend', 'blockchain', 'c', 'c#', 'c++',
  'css', 'data engineering', 'data science', 'database', 'devops', 'docker',
  'elasticsearch', 'frontend', 'fullstack', 'gcp', 'golang',
  'html', 'infrastructure', 'ios', 'android', 'java', 'javascript',
  'kubernetes', 'linux', 'machine learning', 'mobile', 'mongodb', 'mysql',
  'next.js', 'node.js', 'php', 'postgresql', 'python', 'react', 'react native',
  'redis', 'rest', 'ruby/rails', 'rust', 'security', 'sql', 'swift',
  'terraform', 'typescript', 'ui/ux', 'unity', 'vue',
  'ai/ml', 'nlp', 'spark', 'kafka', 'microservices', 'system architecture',
  'bash', 'scala', 'kotlin', 'flutter', 'solidity', 'angular', 'infosec',
  'cloud', 'git', 'web', 'open source', 'saas',
]);

// 'go' and 'testing' were tried as exact tag matches but they're too generic —
// they appear on non-tech postings (clinical trial "testing", research "go"
// tags) and let noise through. Title keywords below catch real tech roles
// like "Software Developer" instead, which is a more specific signal.
const TECH_TITLE_KEYWORDS = [
  'engineer', 'developer', 'devops', 'backend', 'frontend', 'fullstack',
  'full-stack', 'full stack', 'software', 'data engineer', 'data scientist',
  'data engineering', 'data science', 'machine learning', 'ml ',
  'ai ', 'artificial intelligence', 'cloud', 'platform', 'infrastructure',
  'security', 'sre', 'architect', 'ios', 'android', 'mobile', 'api',
  'database', 'sysadmin', 'sys admin', 'qa ', 'quality assurance',
  'typescript', 'javascript', 'python', 'golang', 'react', 'node',
];

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

  if (TITLE_BLOCKLIST.some(w => title.includes(w))) return false;

  const hasTagSignal = tags.some(tag => TECH_TAGS.has(tag));
  const hasTitleSignal = TECH_TITLE_KEYWORDS.some(kw => title.includes(kw));

  // RemoteOK tags are category-level (applied to all jobs), not job-specific —
  // a tag match alone proves nothing there, so both signals must agree.
  if (job.external_id && job.external_id.startsWith('remoteok-')) {
    return hasTagSignal && hasTitleSignal;
  }

  // Other sources tag jobs individually, so either signal is enough —
  // a clear title ("Senior Software Developer") counts even with sparse tags.
  return hasTagSignal || hasTitleSignal;
}

function normalizeTitle(title) {
  return title.replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase();
}

function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.company}||${normalizeTitle(job.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── API fetchers — each returns an array of normalized job objects ─────────────

const JOB_TYPE_MAP = {
  full_time: 'Full Time', part_time: 'Part Time',
  contract: 'Contractor', freelance: 'Freelance', internship: 'Internship',
};

async function fetchRemotive() {
  const jobs = [];
  for (const category of REMOTIVE_CATEGORIES) {
    const res = await fetch(`https://remotive.com/api/remote-jobs?category=${category}`, {
      headers: { 'User-Agent': 'JobHunterApp/1.0' }, timeout: 10000,
    });
    if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
    const data = await res.json();
    for (const j of (data.jobs || [])) {
      jobs.push({
        external_id: `remotive-${j.id}`,
        title: j.title,
        company: j.company_name,
        company_logo: j.company_logo || null,
        location: j.candidate_required_location || 'Remote',
        job_type: JOB_TYPE_MAP[j.job_type] || j.job_type || null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        description: j.description || null,
        url: j.url,
        tags: j.tags || [],
        date_posted: j.publication_date ? new Date(j.publication_date) : null,
      });
    }
  }
  return jobs;
}

async function fetchRemoteOK() {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'JobHunterApp/1.0' }, timeout: 10000,
  });
  if (!res.ok) throw new Error(`RemoteOK HTTP ${res.status}`);
  const data = await res.json();
  return data
    .filter(j => j && j.id && j.position)
    .map(j => ({
      external_id: `remoteok-${j.id}`,
      title: j.position,
      company: j.company,
      company_logo: j.company_logo || j.logo || null,
      location: j.location || 'Remote',
      job_type: null,
      salary_min: j.salary_min > 0 ? j.salary_min : null,
      salary_max: j.salary_max > 0 ? j.salary_max : null,
      salary_currency: (j.salary_min > 0 || j.salary_max > 0) ? 'USD' : null,
      description: j.description || null,
      url: j.url,
      tags: j.tags || [],
      date_posted: j.date ? new Date(j.date) : null,
    }));
}

// ── Main sync ─────────────────────────────────────────────────────────────────

async function syncJobs() {
  console.log('🔄 Syncing jobs from Remotive + RemoteOK...');

  const results = await Promise.allSettled([fetchRemotive(), fetchRemoteOK()]);

  const [remotiveResult, remoteOKResult] = results;
  if (remotiveResult.status === 'rejected')
    console.warn('⚠️  Remotive failed:', remotiveResult.reason.message);
  if (remoteOKResult.status === 'rejected')
    console.warn('⚠️  RemoteOK failed:', remoteOKResult.reason.message);

  const raw = [
    ...(remotiveResult.status === 'fulfilled' ? remotiveResult.value : []),
    ...(remoteOKResult.status === 'fulfilled' ? remoteOKResult.value : []),
  ];

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
          job.external_id, job.title, job.company, job.company_logo,
          job.location, job.job_type, job.salary_min, job.salary_max,
          job.salary_currency, job.description, job.url, job.tags, job.date_posted,
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

module.exports = { syncJobs };
