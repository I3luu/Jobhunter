JobHunter
A remote job board that aggregates listings from the Himalayas API and stores them locally in PostgreSQL. Built because I wanted a single place to browse remote jobs without ads or paywalls.
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
MethodEndpointDescriptionGET/jobsFetch jobs — supports ?search=, ?type=POST/syncPull latest jobs from HimalayasGET/healthHealth check