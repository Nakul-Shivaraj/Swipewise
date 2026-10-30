# Swipewise

People with multiple credit cards often use the wrong card, forget their perks, and miss bonuses or due dates. SwipeWise is a private card wallet that shows the best card for any purchase and reminds users before rewards, points, or payments slip through the cracks.

## Local setup

### Prerequisites

- Node.js 22 LTS or newer
- npm 10 or newer

### Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `apps/api/.env` and supply your PostgreSQL connection strings:

   ```bash
   cp .env.example apps/api/.env
   ```

   - `DATABASE_URL`: Hosted Supabase transaction pooler (port 6543)
   - `DIRECT_URL`: Hosted Supabase direct session connection for migrations (port 5432)

3. **Run database migrations and seed:**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start development servers:**

   ```bash
   npm run dev
   ```

5. **Run tests, linting, and build:**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   npm run build
   ```

## Deploy

SwipeWise deploys as a single **Vercel** project serving the React frontend at `/` (`apps/web/dist`) and the Express API under `/api` (`api/index.ts`) on the same domain so the `httpOnly` auth cookie works seamlessly.

### Environments & workflow

- **Production (`main`):** Pushing or merging to `main` automatically triggers a Production deployment on Vercel against the production Supabase project.
- **Preview (Pull Requests):** Every pull request automatically gets an isolated Vercel Preview deployment connected to the shared `swipewise-dev` Supabase project.
- **Database migrations:** Preview deployments **never** run migrations. The build script (`npm run vercel-build`) runs `prisma migrate deploy` **only** when `VERCEL_ENV=production` (production deploys from `main`). To apply committed migrations to the shared `swipewise-dev` database, ping your partner first and run `npm --workspace=@swipewise/api run db:migrate:deploy` (`prisma migrate deploy` — never run `prisma migrate dev` against the shared database).
- **Production seed:** After the first production deploy completes, run the seed once by hand against the production database (`DIRECT_URL=<prod-session-pooler> npm run db:seed`).
- **Health check:** `GET /api/health` runs `SELECT 1` through Prisma and returns `200 {"status":"ok","db":"ok"}` when the app and database are reachable, or `503 {"status":"error","db":"down"}` if the database query fails.

### Supabase connection strings

- **`DATABASE_URL`:** Set to the Supabase **Transaction pooler** connection string (port `6543`, ending with `?pgbouncer=true`). Used by the API at runtime.
- **`DIRECT_URL`:** Set to the Supabase **Session pooler** connection string (port `5432`). Used only by Prisma CLI for migrations (`prisma migrate deploy`).

### Environment variables

Set the following variables in Vercel Project Settings → Environment Variables (values omitted):

| Name                | Purpose                                                                                                    | Production / Preview                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Runtime PostgreSQL connection via Supabase transaction pooler (port `6543`, `?pgbouncer=true`)             | Production (prod Supabase project) & Preview (`swipewise-dev` Supabase project) |
| `DIRECT_URL`        | Direct/session PostgreSQL connection via Supabase session pooler (port `5432`) for Prisma migrations       | Production (prod Supabase project) & Preview (`swipewise-dev` Supabase project) |
| `DATABASE_URL_TEST` | Test PostgreSQL connection string (`?schema=test`, never `public`) used by integration tests in `db.ts`    | Local / CI tests only (`schema=test`)                                           |
| `JWT_SECRET`        | Secret key (at least 32 characters) used to sign and verify `httpOnly` auth JWT cookies                    | Production & Preview (distinct secret per environment)                          |
| `NODE_ENV`          | Node runtime environment (`production` enables `Secure` cookies and production optimizations)              | Set automatically by Vercel (`production` in Production & Preview)              |
| `VERCEL_ENV`        | Target deployment environment (`production` or `preview`); gates `prisma migrate deploy` in `vercel-build` | Set automatically by Vercel (`production` on `main`, `preview` on PRs)          |
| `PORT`              | Port for the standalone Express server in local development (`apps/api/src/server.ts`)                     | Local development only (ignored on Vercel)                                      |
