import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const PAGE_SIZE = 18;

// ── Helpers ──────────────────────────────────────────────────
function formatSalary(min, max, currency = 'USD') {
  const fmt = (n) =>
    n >= 1000
      ? `${currency === 'USD' ? '$' : currency}${Math.round(n / 1000)}k`
      : `${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ── Skeleton Card ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div style={{ display: 'flex', gap: 14 }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 16, width: '80%' }} />
          <div className="skeleton" style={{ height: 13, width: '50%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ height: 26, width: 90, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 26, width: 70, borderRadius: 20 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 22, width: 55, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <div className="skeleton" style={{ height: 13, width: 60 }} />
        <div className="skeleton" style={{ height: 34, width: 80, borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────
function JobCard({ job, style }) {
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const posted = timeAgo(job.date_posted || job.created_at);
  const tags = Array.isArray(job.tags) ? job.tags.slice(0, 4) : [];

  return (
    <div className="job-card" style={style}>
      <div className="card-header">
        {job.company_logo ? (
          <img
            className="company-logo"
            src={job.company_logo}
            alt={job.company}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="company-logo-placeholder"
          style={{ display: job.company_logo ? 'none' : 'flex' }}
        >
          {initials(job.company || '?')}
        </div>
        <div className="card-title-group">
          <div className="job-title">{job.title}</div>
          <div className="company-name">{job.company}</div>
        </div>
      </div>

      <div className="card-meta">
        {job.location && (
          <span className="meta-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {job.location}
          </span>
        )}
        {job.job_type && (
          <span className="meta-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            </svg>
            {job.job_type}
          </span>
        )}
        {salary && (
          <span className="meta-chip salary-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
            {salary}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="card-tags">
          {tags.map((tag, i) => (
            <span key={i} className="tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="card-footer">
        <span className="posted-date">{posted || ''}</span>
        {job.url ? (
          <a className="apply-btn" href={job.url} target="_blank" rel="noopener noreferrer">
            Apply →
          </a>
        ) : (
          <span className="apply-btn" style={{ opacity: 0.4, cursor: 'default' }}>No link</span>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [jobType, setJobType] = useState('');
  const [page, setPage] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const searchTimer = useRef(null);

  const fetchJobs = useCallback(async (q, type, pageNum) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });
      if (q) params.set('search', q);
      if (type) params.set('type', type);

      const res = await fetch(`${API_BASE}/jobs?${params}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
      fetchJobs(search, jobType, 0);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search, jobType, fetchJobs]);

  useEffect(() => {
    fetchJobs(search, jobType, page);
  }, [page]); // eslint-disable-line

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncMsg({ type: 'success', text: `✓ ${data.inserted} new jobs added` });
      setPage(0);
      fetchJobs(search, jobType, 0);
    } catch (err) {
      setSyncMsg({ type: 'error', text: `✗ ${err.message}` });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <span className="logo">
              <span className="logo-dot" />
              JobHunter
            </span>
            <button className="sync-btn" onClick={handleSync} disabled={syncing}>
              {syncing ? <span className="sync-spinner" /> : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              )}
              {syncing ? 'Syncing…' : 'Sync Jobs'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <p className="hero-eyebrow">Remote-first opportunities</p>
          <h1 className="hero-title">
            Find your<br /><span>next remote</span> role
          </h1>
          <p className="hero-sub">Curated remote jobs updated in real time</p>

          <div className="search-bar">
            <div className="search-input-wrap">
              <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="search-input"
                type="text"
                placeholder="Search by title, company, or keyword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={jobType}
              onChange={(e) => { setJobType(e.target.value); setPage(0); }}
            >
              <option value="">All types</option>
              <option value="Full Time">Full Time</option>
              <option value="Part Time">Part Time</option>
              <option value="Contractor">Contractor</option>
              <option value="Internship">Internship</option>
              <option value="Freelance">Freelance</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main */}
      <main>
        <div className="container">
          <div className="stats-bar">
            {!loading && (
              <p className="job-count">
                <strong>{total.toLocaleString()}</strong> remote {total === 1 ? 'job' : 'jobs'} found
              </p>
            )}
            {syncMsg && (
              <span className={`sync-message ${syncMsg.type}`}>{syncMsg.text}</span>
            )}
          </div>

          {loading ? (
            <div className="skeleton-grid">
              {Array.from({ length: 9 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="jobs-grid">
              <div className="error-state">
                <div className="empty-icon">⚡</div>
                <h3>Connection error</h3>
                <p>{error}</p>
                <p style={{ marginTop: 8, fontSize: 13 }}>
                  Make sure the backend is running on <code style={{ color: 'var(--accent2)' }}>localhost:4000</code>
                </p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="jobs-grid">
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No jobs found</h3>
                <p>Try a different search or click <strong>Sync Jobs</strong> to fetch the latest listings.</p>
              </div>
            </div>
          ) : (
            <div className="jobs-grid">
              {jobs.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  style={{ animationDelay: `${(i % PAGE_SIZE) * 30}ms` }}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="page-btn"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          JobHunter — powered by{' '}
          <a href="https://remotive.com" target="_blank" rel="noopener noreferrer">
            Remotive
          </a>{' '}&{' '}
          <a href="https://remoteok.com" target="_blank" rel="noopener noreferrer">
            RemoteOK
          </a>
        </div>
      </footer>
    </div>
  );
}
