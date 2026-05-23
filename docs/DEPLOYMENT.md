# Production Deployment Guide

## 1. Prerequisites
- Node.js 18+ installed
- npm available
- GitHub account for repository hosting
- Render account (fastest deploy path)
- Optional: domain registrar access for custom domain setup

## 2. Local verification
```bash
npm install
npm test
npm run verify:deploy
npm run smoke
npm start
```
Open `http://localhost:3000`

## 3. Build and start commands
- Build/install: `npm ci`
- Start: `npm start`
- Test: `npm test`
- Smoke test: `npm run smoke`
- Verify deployment structure: `node scripts/verify-deployment.js`

## 4. Database setup
This site can run without a live application database because the curriculum is already stored in static files and JSON config.

Optional metadata database files are included for future persistence:
- `database/schema.sql`
- `database/init.sql`
- `database/seed.sql`
- `database/migrations/001_create_curriculum_tables.sql`
- `database/migrations/002_seed_curriculum_programs.sql`
- `database/migrations/003_create_shared_resource_tables.sql`
- `database/migrations/004_seed_shared_resources.sql`

### SQLite quick start (optional)
If you want a local SQLite metadata database:
1. Create the database file path from `.env.example`.
2. Apply `database/init.sql` from the sqlite shell.
3. Or apply all migrations in order manually.
4. Use `database/seed.sql` if you only need seed entries.

## 5. Render deployment
This repo includes `render.yaml`, `Procfile`, and `Dockerfile`.

### Fastest Render flow
1. Push repository to GitHub.
2. In Render, create a new Web Service from the repo.
3. Use:
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/api/health`
4. Deploy.
5. Confirm `/api/health` returns status `ok`.
6. Confirm `/api/resources` returns the shared document library.

## 6. Go-live checklist
- Homepage loads
- Program pages load
- Downloadable files open
- Shared resource library loads
- API health endpoint responds
- Curriculum API responds
- Resource API responds
- Custom domain connected
- HTTPS active
- Final browser/mobile check complete
