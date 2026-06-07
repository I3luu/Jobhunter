JobHunter
A remote job board that aggregates tech listings from the Remotive and RemoteOK APIs, filters out non-tech noise, and stores them locally in PostgreSQL. Built because I wanted a single place to browse remote jobs without ads or paywalls.
Stack

Frontend — React
Backend — Node.js + Express
Database — PostgreSQL

Features

Search jobs by title, company, or keyword
Filter by job type
One-click sync to pull fresh listings
Pagination

Running locally
You'll need Node.js and PostgreSQL installed.
bash# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up environment
cd backend
cp .env.example .env
# Fill in your PostgreSQL credentials

# Create the database
node scripts/setup-db.js

# Start backend (port 4000)
node server.js

# Start frontend (port 3000) — in a separate terminal
cd frontend && npm start

API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /jobs | Fetch jobs — supports `?search=`, `?type=`, `?limit=`, `?offset=` |
| POST | /sync | Pull latest listings from Remotive + RemoteOK |
| GET | /health | Health check |
