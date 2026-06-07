require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const jobsRouter = require('./routes/jobs');
const { syncJobs } = require('./services/sync');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/jobs', jobsRouter);

// POST /sync — manually trigger a sync from the external API
app.post('/sync', async (req, res) => {
  try {
    const result = await syncJobs();
    res.json({ message: 'Sync complete', ...result });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /health — simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Boot ────────────────────────────────────────────────────
async function start() {
  await initDB();

  app.listen(PORT, () => {
    console.log(`🚀 JobHunter API running at http://localhost:${PORT}`);
    console.log(`   GET  /jobs       — list jobs`);
    console.log(`   POST /jobs       — insert a job`);
    console.log(`   POST /sync       — pull from Remotive + RemoteOK`);
    console.log(`   GET  /health     — health check`);
  });

  // Auto-sync on startup
  try {
    await syncJobs();
  } catch (err) {
    console.warn('⚠️  Initial sync failed (DB may not be ready):', err.message);
  }
}
start();


