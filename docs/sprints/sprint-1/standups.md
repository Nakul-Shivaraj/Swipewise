# Sprint 1 — Standups

Async standups posted in the team's Slack channel, copied word for word from Slack. Times are when each message was posted (Pacific time). Where a standup covers an earlier day, its own title says so.

**Count:** Dhanraj 4 standups, Nakul 3 standups plus one status update.

---

## Oct 30 — Nakul (status update, posted 3:37 PM)

> Hey Dhanraj, quick update:
>
> **Done:** #4 (Prisma + Supabase), #7 (Tailwind theme from DESIGN.md), #8 (AGENTS.md v0.5) are closed. Nice work on #5!
> **Needs your review:** #9 PR (database schema + demo data). I'm starting #10 (log in/log out) next.
>
> **Database setup:**
> - I've invited you to our SwipeWise org on Supabase (dev DB is Swipewise-dev). Grab the connection strings from Connect > ORM > Prisma.
> - Create your own `apps/api/.env` with: DATABASE_URL, DIRECT_URL, DATABASE_URL_TEST and DIRECT_URL_TEST (same URLs with `schema=test`), and JWT_SECRET. See `.env.example` and the README.
> - Then run `npm install`, `npm run db:migrate`, `npm run db:seed`.
> - We share the dev DB, so let's ping each other before adding new migrations.
>
> **Your next card: #6 (deploy)**, since the MVP needs to be live by Nov 5:
> - Website on Vercel (PR previews), API on Render, and a separate production Supabase project (we have one free slot left in our org).
> - Our login cookie is SameSite=Lax, so add a Vercel rewrite from `/api/*` to Render. Otherwise login won't work across the two domains.
>
> After that: #12 (best card), then #13 (store search). Tables: cards, reward_rules (`rate_x100`), rewards_programs (`cents_per_100_points`), stores, store_aliases. The reward formula is in AGENTS.md section 6.
>
> Sprint 1 ends Nov 5. Shout if anything's blocking you!

## Oct 30 — Dhanraj (posted 4:05 PM)

> **Standup – Oct 30 (Dhanraj)**
>
> **Done**
> - #5 CI merged (PR #30): lint, typecheck, tests, build, production npm audit, CodeQL, and the Husky pre-commit hook. CI is green on main.
> - Branch protection on main is on: PR required, 1 approval, CI and CodeQL must pass.
> - Created the Sprint 2 issues #19–#28 with acceptance criteria, labels, and estimates.
>
> **Doing**
> - #6 deploy, built in Antigravity on branch chore/6-deploy-starter. Plan approved:
>   - One Vercel project: web at /, Express API under /api (same domain, so the SameSite=Lax cookie works)
>   - GET /api/health checks the database
>   - Adds @prisma/adapter-pg + pg (Prisma 7 needs a driver adapter) and one shared Prisma client in apps/api/src/db.ts. Please use it in #10 instead of a new PrismaClient.
>   - […]
>   - Runtime uses the pooled DATABASE_URL (6543). DIRECT_URL is only for migrations.
>   - Migrations: previews never migrate. Production migrates only on deploy from main. Dev migrations […] each other first.
>   - CI will use a temporary Postgres, never Supabase, before any tests hit the database.
>   - Rate limiting with Postgres storage stays in #10.
>
> **Need from you**
> - Set up the production Supabase project and import the repo into Vercel together; I'll send the env var list.
> - Review the #6 PR when it's up.
>
> **Blockers**
> - None yet. PR previews need the Vercel import first.

*[…] marks a few words that were not captured when this message was copied from Slack.*

## Oct 31 and Nov 1 — Nakul (both posted Nov 2, 4:36 PM)

> **Standup: Oct 31**
> **Done:** #9 merged: Prisma schema (7 tables), 2 migrations on Supabase, demo cards and stores seeded. Built #10: log in, log out, /me route, login guard, Postgres rate limiting (49 tests passing).
> **Today:** Waiting on #6 for the shared Prisma client, then switching #10 over to it. Set up the test schema for integration tests.
> **Blockers:** #10 can't merge until #6 lands.
>
> **Standup: Nov 1**
> **Done:** Merged main into #10, resolved 4 conflicts, switched to the shared db.ts, pinned dependency versions.
> **Today:** Fixed the failing PR checks (Postgres in CI, rate limit on all /api/v1 routes for the CodeQL alert). Applied the rate_limits migration to dev and prod, tested on the preview, merging #10. Next: layout bug, then #11 wallet.
> **Blockers:** None.

## Nov 2 — Dhanraj (posted 11:51 PM)

> **Standup – Nov 2 (Dhanraj)**
> **Done:** #6 deploy verified (prod live, previews working). Reviewed #36 (layout fix). Built #12 best card by category: PR #37, 66 tests, all checks green.
> **Next:** #13 store search, after #37 merges.
> **Blockers:** Need review on #37, and demo wallet data on dev to test the ranking on the preview.

## Nov 3 — Dhanraj (posted 12:23 AM)

> **Standup – Nov 3 (Dhanraj)**
> **Done:** #12 merged (best card by category). #13 store search: PR #39, all checks green.
> **Next:** #14 end-to-end test, after #11 (wallet) and #13 merge.
> **Blockers:** Review on #39, and #11 for the end-to-end test.

## Nov 3 — Nakul (posted 1:51 PM)

> **Standup: Nov 3**
> **Done:** Closed all my Sprint 1 cards: #9 schema, #10 auth, #11 wallet, plus bugs #33 (layout), #34 (local dev server), and #35 (error messages). Added CSRF protection after the CodeQL alert.
> **To do:** @Dhanraj Pandya is on #14, the E2E test for the Sprint 1 flow (sign up → add card → search store → best card).
> **Next:** Sprint 1 review and retro on Nov 5.

## Nov 3 — Dhanraj (posted 11:45 PM)

> **Standup – Nov 3 (Dhanraj)**
> **Done:** #13 store search merged. #42 rate limit bug (found by the e2e test) fixed and merged. #14 end-to-end test: PR #44, all checks green, covering sign up → wallet → store search → best card on mobile and desktop.
> **Next:** Sprint 1 review once #44 merges.
> **Blockers:** Review on #44.
