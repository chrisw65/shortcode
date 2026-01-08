# shortcode

Short link service with an admin UI, analytics, QR codes, and custom domains.

## Requirements
- Node.js 18+
- Postgres 14+
- Redis (optional; only required if you add Redis-backed rate limiting later)

## Quick start
1) Install dependencies:
   - `npm install`
2) Create a `.env` file (see Environment variables)
3) Run migrations:
   - `npm run migrate`
4) Start the server:
   - `npm run dev`

The API will be available at `http://localhost:3000` and the admin UI at `http://localhost:3000/admin/`.

## Environment variables
Required:
- `JWT_SECRET` = strong secret used to sign/verify JWTs
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Optional:
- `PORT` (default 3000)
- `NODE_ENV` (default development)
- `PUBLIC_HOST` or `BASE_URL` (used to render short URLs in API responses)
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

Example `.env`:
```
PORT=3000
NODE_ENV=development
JWT_SECRET=replace_me

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=shortlink_dev
POSTGRES_USER=shortlink
POSTGRES_PASSWORD=dev_password
```

## Database
`npm run migrate` creates the schema used by the API, including:
- `users` (with `is_active`, `email_verified`)
- `domains`
- `links` (with `active`, `domain_id`)
- `click_events`

The migration also inserts a default admin user:
- Email: `admin@shortlink.com`
- Password: `admin123`

Change or remove this user in production.

## Admin UI
Visit `/admin/` to log in. The admin UI uses JWTs stored in localStorage.

## API overview
Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`

Links:
- `POST /api/links`
- `GET /api/links`
- `GET /api/links/:shortCode`
- `PUT /api/links/:shortCode`
- `DELETE /api/links/:shortCode`

Domains:
- `GET /api/domains`
- `POST /api/domains`
- `POST /api/domains/:id/verify`
- `POST /api/domains/:id/default`
- `DELETE /api/domains/:id`

Analytics:
- `GET /api/analytics/summary`
- `GET /api/analytics/links/:shortCode/summary`
- `GET /api/analytics/links/:shortCode/events`

QR codes:
- `GET /api/qr/:shortCode.svg`
- `GET /api/qr/:shortCode.png`

Redirects:
- `GET /:shortCode`

## Notes
- Only `http`/`https` URLs are accepted for short links.
- `short_code` is 3-32 chars, letters/digits/`-`/`_`.
