# MVP Status And Verification Plan

This repo is an MVP URL shortener with:
- Node/Express API
- PostgreSQL
- Static admin UI in `/public/admin`
- QR endpoints
- Domain verification (DNS TXT)

## Current MVP assumptions
These must be true for the MVP to work as intended:
- `JWT_SECRET` is set
- Postgres is reachable with the env vars in `.env`
- The DB schema matches `scripts/migrate.js`
- The service is running behind a reverse proxy or direct, with `PUBLIC_HOST` or `BASE_URL`
- The admin UI is served from `/public/admin`
- `SERVICE_MODE` defaults to `all` (set to `api`, `redirect`, or `worker` to split services)

## Recent enhancements (Phase 3.4)
- Bulk create/delete (JSON + CSV import)
- Tags/groups and UTM builder in admin UI
- A/B variants and weighted routing
- Password-protected links
- Deep link handling with device fallbacks

## Local verification checklist
1) Install deps:
   - `npm install`
2) Set `.env`:
   - `JWT_SECRET=...`
   - `POSTGRES_HOST=...`
   - `POSTGRES_PORT=...`
   - `POSTGRES_DB=...`
   - `POSTGRES_USER=...`
   - `POSTGRES_PASSWORD=...`
3) Run migrations:
   - `npm run migrate`
4) Run server:
   - `npm run dev`
5) Healthcheck:
   - `curl http://localhost:3000/health`
6) Create a user:
   - `curl -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"pass1234"}'`
7) Login:
   - `curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"pass1234"}'`
8) Create a link (replace TOKEN):
   - `curl -X POST http://localhost:3000/api/links -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'`
9) Visit the redirect:
   - `curl -I http://localhost:3000/SHORT_CODE`

## Production (Droplet) verification checklist
1) Confirm env vars are set on the droplet
2) Confirm port is open and reverse proxy is routing to the app
3) Confirm the DB is reachable from the droplet
4) Run `/health` from a remote machine
5) Log into `/admin/` and create a link
6) Confirm redirect and QR endpoints work

Current deployment model: systemd + single Docker container.

## Current known gaps (from review)
- No Redis caching for redirects or rate limits
- No API keys for programmatic usage
- No multi-tenant or org features
- Analytics is basic and stored in Postgres only
