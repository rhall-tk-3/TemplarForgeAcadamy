# KTKC School Programs Repository

Production-oriented repository package for the KTKC school-program website build.

## Included structure
- `package.json`
- `package-lock.json`
- `server.js`
- `src/config/curriculum/`
- `src/controllers/`
- `src/services/`
- `scripts/`
- `tests/`
- `public/`
- `public/programs/`
- `public/resources/`
- `database/`
- `database/migrations/`
- `docs/`
- `Dockerfile`
- `Procfile`
- `render.yaml`
- `.env.example`
- `.dockerignore`

## Programs included
- Levie
- Squire
- Corporal
- Sergeant
- SFC
- Knight Aspirant
- Knight
- Lieutenant
- Captain
- Major
- Commander

## Shared repository resources
- Core program documents under `public/resources/core-documents/`
- Fillable Schoolmaster forms under `public/resources/schoolmaster-forms/`
- Resource API endpoints under `/api/resources`

## Fastest path to get this operational tonight
### Local run
```bash
npm install
npm test
npm run verify:deploy
npm run smoke
npm start
```
Open `http://localhost:3000`

### Fastest hosted deploy
#### Render
1. Upload this repo to GitHub.
2. Create a new Render Web Service from the repo.
3. Render can use the included `render.yaml`, or manually set:
   - build: `npm ci`
   - start: `npm start`
4. Deploy.
5. Add your custom domain after the service is healthy.

## Helpful scripts
- `npm test`
- `npm run smoke`
- `npm run verify:deploy`
- `npm run migrate:list`
- `npm run setup:prod`

## API endpoints
- `GET /api/health`
- `GET /api/curriculum`
- `GET /api/curriculum/phases`
- `GET /api/curriculum/:slug`
- `GET /api/curriculum/:slug/manifest/files`
- `GET /api/resources`
- `GET /api/resources/:sectionKey`
- `GET /api/programs`
- `GET /api/programs/:slug`

## Database files
- `database/schema.sql`
- `database/init.sql`
- `database/seed.sql`
- `database/migrations/001_create_curriculum_tables.sql`
- `database/migrations/002_seed_curriculum_programs.sql`
- `database/migrations/003_create_shared_resource_tables.sql`
- `database/migrations/004_seed_shared_resources.sql`

## Deployment docs
- `docs/DEPLOYMENT.md`
- `docs/DOMAIN_SETUP.md`
- `deploy-notes.txt`

## Static content
Final website-builder program folders are stored in `public/programs/`.
The shared document library is served from `public/resources/`.
