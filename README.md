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
