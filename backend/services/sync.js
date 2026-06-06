const fetch = require('node-fetch');
const { pool } = require('../db');

const HIMALAYAS_BASE = 'https://himalayas.app/jobs/api';
const PAGE_SIZE = 10;   // must stay ≤ 10 — the API returns placeholder data above this
const MAX_PAGES = 5;    // fetch up to 50 jobs per sync

// Fallback sample data used during development if the API is unreachable
const SAMPLE_JOBS = [
  { id: 'sample-1', title: 'Senior Frontend Engineer', companyName: 'Vercel', companyLogo: 'https://vercel.com/favicon.ico', locationRestrictions: ['Worldwide'], jobType: 'full-time', salary: { min: 130000, max: 180000, currency: 'USD' }, categories: ['React', 'TypeScript', 'Next.js'], applicationLink: 'https://vercel.com/careers', createdAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'sample-2', title: 'Backend Engineer (Go)', companyName: 'PlanetScale', companyLogo: null, locationRestrictions: ['Americas'], jobType: 'full-time', salary: { min: 140000, max: 190000, currency: 'USD' }, categories: ['Go', 'MySQL', 'Kubernetes'], applicationLink: 'https://planetscale.com/careers', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'sample-3', title: 'Product Designer', companyName: 'Linear', companyLogo: null, locationRestrictions: ['Europe', 'Americas'], jobType: 'full-time', salary: { min: 100000, max: 140000, currency: 'USD' }, categories: ['Figma', 'Design Systems', 'UX'], applicationLink: 'https://linear.app/careers', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'sample-4', title: 'DevOps Engineer', companyName: 'Fly.io', companyLogo: null, locationRestrictions: ['Worldwide'], jobType: 'full-time', salary: { min: 120000, max: 160000, currency: 'USD' }, categories: ['AWS', 'Terraform', 'Docker'], applicationLink: 'https://fly.io/jobs', createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 'sample-5', title: 'Staff Engineer, Platform', companyName: 'Stripe', companyLogo: null, locationRestrictions: ['USA', 'Canada'], jobType: 'full-time', salary: { min: 200000, max: 260000, currency: 'USD' }, categories: ['Ruby', 'Java', 'Distributed Systems'], applicationLink: 'https://stripe.com/jobs', createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'sample-6', title: 'ML Engineer', companyName: 'Hugging Face', companyLogo: null, locationRestrictions: ['Worldwide'], jobType: 'full-time', salary: { min: 150000, max: 210000, currency: 'USD' }, categories: ['Python', 'PyTorch', 'LLMs'], applicationLink: 'https://huggingface.co/jobs', createdAt: new Date(Date.now() - 86400000 * 6).toISOString() },
  { id: 'sample-7', title: 'Technical Writer', companyName: 'Supabase', companyLogo: null, locationRestrictions: ['Worldwide'], jobType: 'contract', salary: { min: 60000, max: 90000, currency: 'USD' }, categories: ['Documentation', 'PostgreSQL', 'Markdown'], applicationLink: 'https://supabase.com/careers', createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'sample-8', title: 'iOS Engineer', companyName: 'Loom', companyLogo: null, locationRestrictions: ['USA'], jobType: 'full-time', salary: { min: 145000, max: 175000, currency: 'USD' }, categories: ['Swift', 'SwiftUI', 'iOS'], applicationLink: 'https://loom.com/careers', createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
  { id: 'sample-9', title: 'Security Engineer', companyName: 'Cloudflare', companyLogo: null, locationRestrictions: ['Worldwide'], jobType: 'full-time', salary: { min: 160000, max: 200000, currency: 'USD' }, categories: ['Security', 'Rust', 'Networking'], applicationLink: 'https://cloudflare.com/careers', createdAt: new Date(Date.now() - 86400000 * 9).toISOString() },
  { id: 'sample-10', title: 'Data Engineer', companyName: 'dbt Labs', companyLogo: null, locationRestrictions: ['Americas', 'Europe'], jobType: 'full-time', salary: { min: 120000, max: 155000, currency: 'USD' }, categories: ['dbt', 'SQL', 'Python', 'Snowflake'], applicationLink: 'https://getdbt.com/careers', createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
];

/**
 * Fetch jobs from Himalayas API and upsert into the database.
 * Returns { inserted, skipped, total } counts.
 */
async function syncJobsFromHimalayas() {
  console.log('🔄 Syncing jobs from Himalayas API...');

  let jobs = [];
  let usedFallback = false;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${HIMALAYAS_BASE}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'JobHunterApp/1.0', 'Accept': 'application/json' },
        timeout: 10000,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const pageJobs = data.jobs || [];
      if (pageJobs.length === 0) break;
      jobs.push(...pageJobs);
    }
    console.log(`📥 Fetched ${jobs.length} jobs from Himalayas`);
  } catch (err) {
    console.warn(`⚠️  Himalayas API unreachable (${err.message}), using sample data for development`);
    jobs = SAMPLE_JOBS;
    usedFallback = true;
  }

  let inserted = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      // Parse salary — Himalayas uses flat fields: minSalary, maxSalary, currency
      const salary_min = job.minSalary || job.salary?.min || null;
      const salary_max = job.maxSalary || job.salary?.max || null;
      const salary_currency = job.currency || job.salary?.currency || null;

      // Normalize location
      const location = job.locationRestrictions?.join(', ') || job.location || 'Remote';

      const result = await pool.query(
        `INSERT INTO jobs
          (external_id, title, company, company_logo, location, job_type,
           salary_min, salary_max, salary_currency, description, url, tags, date_posted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [
          job.guid || job.id || job.slug,
          job.title,
          job.companyName || job.company?.name || 'Unknown',
          job.companyLogo || job.company?.logo || null,
          location,
          job.employmentType || job.jobType || job.type || null,
          salary_min,
          salary_max,
          salary_currency,
          job.description || null,
          job.applicationLink || job.url || null,
          job.categories || [],
          job.pubDate ? new Date(job.pubDate * 1000) : (job.createdAt ? new Date(job.createdAt) : null),
        ]
      );

      if (result.rows.length > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`⚠️  Failed to insert job "${job.title}":`, err.message);
      skipped++;
    }
  }

  console.log(`✅ Sync complete: ${inserted} inserted, ${skipped} skipped${usedFallback ? ' (sample data)' : ''}`);
  return { inserted, skipped, total: jobs.length, usedFallback };
}

module.exports = { syncJobsFromHimalayas };
