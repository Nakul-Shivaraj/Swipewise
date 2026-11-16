<!--
  AGENTS.md — SwipeWise (P2): the one rules file every AI tool we use reads.
  Kept short on purpose (aim: about 200 lines of rules): it loads on every request, so details live
  in docs/ and are linked.
  Each section opens with a "Why". Change it only via its own PR, revisit it at every retro,
  and log each change in the revision history.
-->

# SwipeWise — Agent Rules

SwipeWise is a private card wallet: it shows which of the user's existing credit cards to use for a
purchase and reminds them before perks, bonuses, points, or payments slip. **It never moves money
and never stores full card numbers.**

> **Status: v0.6 (Nov 15, 2026).** Design docs and mockups are in `docs/`. Requirements are the GitHub issues.

**Source of truth:** the security and money rules here always win. Then: the GitHub issue and its
acceptance criteria → `docs/DESIGN.md` and `docs/ui-behavior.md` → the rest of this file.
If two conflict, stop and ask.

## 1. How to work
<!-- Why: left alone, agents build whole features at once and skip tests. -->
1. One issue at a time. Read it (`gh issue view <N>`); restate its acceptance criteria (ACs) and
   your plan in 3–6 lines before writing code.
2. Branch from `main`: `feature/<issue#>-<short-slug>`.
3. **Red:** write failing tests that map to the ACs, run them, commit `test(<scope>): … (#N)`.
4. **Green:** minimum code to pass, commit `feat(<scope>): … (#N)`. Refactor with tests green.
5. Before saying you're done, run the **full** `npm run lint && npm run typecheck && npm test && npm run build`,
   never a subset. Database tests skip without `DATABASE_URL_TEST`: list them as skipped, never as passed.
6. Before opening the PR, merge `origin/main` into the branch (no rebase, no force push) and rerun step 5.
7. Report: files changed, tests written, the exact test summary lines, what's left.
8. Never claim a test passes or a deploy works unless you ran it. Never push to `main`; ask before pushing.

## 2. Scope
<!-- Why: the agent extends whatever it sees. Explicit non-goals stop it from building them. -->
- **Build** only what the GitHub issues describe.
- **Non-goals — never build, not even partially:** card-data API sync, admin review queues (card
  data or store suggestions), Plaid or any bank linking, email notifications, social login. If an
  issue seems to need one, stop and ask.

## 3. Stack
<!-- Why: without this the agent guesses a stack. Versions are targets: confirm at scaffold; lockfile wins. -->
| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, TypeScript (`strict`, no `any`), Tailwind CSS 4, React Router, TanStack Query 5, React Hook Form |
| Backend | Node.js 24 LTS, Express 5, TypeScript |
| Database | PostgreSQL 17 + Prisma 7 — schema changes only through migrations |
| Validation | Zod 4 schemas in `packages/shared`, used by both client and server |
| Auth | JWT in an httpOnly cookie; passwords hashed with argon2id |
| Dates | Luxon with IANA time zones |
| Tests | Vitest 4, Supertest, React Testing Library, Playwright |
| CI | GitHub Actions; Husky + lint-staged pre-commit hook |
| Hosting | Vercel: React app + Express API (as functions) on one domain, with PR previews. Supabase Postgres: production, plus one shared dev/preview database |
| Scheduler | Vercel Cron calls `GET /api/v1/cron/reminders` daily with `CRON_SECRET` |

Allowed and avoided libraries: `docs/dependencies.md`. Anything not listed there: ask first.

## 4. Commands
<!-- Why: exact commands stop the agent from inventing ad-hoc ones. -->
| Task | Command |
|---|---|
| Install / database / dev | `npm install` / `docker compose up -d db` / `npm run dev` |
| Migrate / seed | `npm run db:migrate` / `npm run db:seed` |
| Unit + integration / coverage | `npm test` / `npm run test:coverage` |
| End-to-end | `npm run e2e` |
| Lint / format / types / build | `npm run lint` / `npm run format` / `npm run typecheck` / `npm run build` |

**Environment:** Nakul uses Windows + PowerShell; Dhanraj uses macOS + zsh. If `node` or `npm` isn't
found, stop and ask; don't search the disk. Run TypeScript scripts with `tsx`
(e.g. `npm run admin:promote -- <email>`). If `gh` isn't installed, read issues with
`curl.exe -s https://api.github.com/repos/Nakul-Shivaraj/Swipewise/issues/<N>`.

## 5. Architecture
<!-- Why: keeps business logic out of routes and React. -->
- Monorepo: `apps/web` (React), `apps/api` (Express), `packages/shared` (Zod schemas + types).
- API layers: routes → controller → service → `domain/` (pure logic) + repo (the only place that
  imports Prisma). Use only the shared Prisma client in `apps/api/src/db.ts`; never `new PrismaClient()`.
- The server is the only source of truth for reward math, statuses, and permissions. The frontend
  shows what the API returns and never recomputes it.
- `apps/api/src/domain/` is pure: no Express, no Prisma, and time is passed in
  (`{ now, timeZone }`). Never call `DateTime.now()` or `new Date()` inside it.
- Every user-data query is scoped to the logged-in user; someone else's record returns 404.
- The daily reminder job is idempotent (unique `dedupeKey`) and catches up on missed days.
- REST under `/api/v1`; errors as `{ "error": { "code", "message" } }`. The OpenAPI spec is generated
  from the Zod schemas (`apps/api/src/public/openapi-generator.ts`); a test fails if the committed
  `docs/api/openapi.yaml` is out of date.
- Public API (`/api/public/v1/*`; `/api/v1/public/*` is deprecated): read-only, never reads the auth
  cookie, never returns user data.
- Rate limits use the Postgres store (`PostgresRateLimitStore`), with `trust proxy` set for Vercel so
  limits are per visitor. All data-changing frontend calls go through `apiFetch` (it adds the CSRF token).
- Migrations: one per PR, each with a fresh, unique timestamp. Never edit a migration that has already
  run anywhere; add a new one. Ping your partner before applying to the shared dev database.
  Production migrations run in `vercel-build` on deploy from `main`.
- Env vars are validated with Zod at startup. `.env.example` lists names only, never values.

## 6. Money and dates (non-negotiable)
<!-- Why: floats and naive date math are the bugs most likely to break rankings and reminders. -->
| Concept | Representation | Example |
|---|---|---|
| Money | integer cents, field suffix `Cents` | `$1,500.00` → `capCents: 150000` |
| Earn rate | points per dollar × 100, `rateX100` | 5% cash back → `500`; 3x points → `300` |
| Point value | cents per 100 points, `centsPer100Points` | cash back → `100`; 1.5¢/pt → `150` |
| Instant | `DateTime` (UTC), suffix `At` | `createdAt` |
| Calendar date | `@db.Date` / `YYYY-MM-DD`, suffix `Date` | `openedDate`, `dueDate` |
| User time zone | IANA string on the user | `America/Los_Angeles` |

- Reward value in cents = `amountCents × rateX100 × centsPer100Points / 1_000_000`. Sum the
  integer numerators across cap segments, divide once, round half up.
- Cash back is a program worth 1¢ per point, so one formula covers every card.
- Never use floats for money. Only `formatCents()` divides by 100, for display. Parse typed dollars
  with `parseDollarsToCents()`.
- All period, quarter, due-date, deadline, and expiry logic goes through `apps/api/src/domain/dates/`
  with Luxon, in the user's time zone. Never do month math with `Date`.

## 7. Conventions
<!-- Why: consistent names keep AI-written code and ours readable side by side. -->
- Files `kebab-case.ts`; React components `PascalCase.tsx`, one per file. Tests sit next to the
  code as `*.test.ts(x)`; integration `*.int.test.ts`; E2E `e2e/*.spec.ts`.
- `camelCase` variables and functions, `PascalCase` types, `SCREAMING_SNAKE_CASE` constants,
  booleans start with `is/has/can/should`.
- Prisma models singular `PascalCase`, tables `snake_case` via `@@map`; API paths plural kebab-case.
- Use these words: wallet card, rewards program, reward rule, perk, bonus offer, rotating category,
  store alias. Every `TODO` references an issue: `// TODO(#23): …`.

## 8. Testing
<!-- Why: P2 grades failing tests committed first. Story IDs in test names show where each test came from. -->
- Test-first always. The failing test is committed before the code. Every bug gets a regression test.
- Unit: everything in `domain/`. Target 90% line and branch coverage (`npm run test:coverage`); it is
  not enforced in CI yet, so check it before saying a domain change is done.
- Integration: every endpoint, including auth and ownership, against a test database
  (`DATABASE_URL_TEST`). Every new route goes into the route list in `security.int.test.ts`; its
  coverage guard fails otherwise.
- E2E (Playwright): one spec per core flow, at mobile and desktop sizes. Error paths tested: empty
  input, bad input, database down.
- Names map to stories and ACs (`describe('rankCards (US-03)')`, `it('AC2: …')`). Fixed clock and
  named factories; no `Date.now()` or random data.

## 9. Design
<!-- Why: without a picture in words, agents invent their own look, copy, and extra features. -->
- **UI follows `docs/DESIGN.md` (look) and `docs/ui-behavior.md` (states, flows, exact error text).
  Mockups: `docs/design/mockup.png` (mobile) and `docs/design/mockup-desktop.png` (website).**
- **Look:** iOS-style Liquid Glass on a warm light green background. Frosted white panels, glossy
  "liquid" category icons, and one green primary button per screen.
- **One responsive app, two layouts** (Tailwind breakpoints only):
  - Mobile (under 768px): large iOS titles, floating glass tab bar (Home, Wallet, Tracker, Alerts),
    results in bottom sheets.
  - Website (1200px and up): a normal site with a sticky glass top bar, open pages and tables, and
    a footer. Never a stretched phone layout, sidebar, or tab bar. Tablets use the top bar.
- **Key components** (build once in `apps/web/src/components/`, reuse): glass panel, search pill,
  liquid icon, card art (card name only), best-card row, green pill button.
- Labels, buttons, and headings use sentence case ("Email", not "EMAIL"). Use only DESIGN.md colors;
  the password strength bar uses `primary` and `ink-muted`, never orange or red.
- Tailwind theme generated from `docs/DESIGN.md` (`npx @google/design.md export`), never hand-copied;
  no raw hex in components. Every data view has loading, empty, and error states. Check each page
  against the mockup in browser mode, at mobile and desktop sizes, before opening the PR.

## 10. Workflow (Scrum + Git)
<!-- Why: every line of code traces to a story, an issue, a branch, a commit, and a reviewed PR. -->
- Team: Dhanraj Pandya and Nakul Shivaraj. **Product Owner and Scrum Master rotate each sprint**;
  current roles are in `docs/sprints/sprint-N/planning.md`.
- Board: Backlog → Sprint Todo → In Progress → In Review → Done. One milestone per sprint.
  Labels: `feature`, `bug`, `chore`, `docs`, `priority: high|medium|low`.
- Issues come from the backlog via the issue template: story ID, ACs as a checklist, estimate. The
  agent may propose issues; partners approve them at Sprint Planning. No work without an issue.
  Check the board before creating one, and never rename or reuse an issue for different work.
- One branch per issue: `feature|fix|chore|docs/<issue#>-<slug>`.
- Commits: `type(scope): imperative summary (#issue)`. Types: `feat`, `fix` (every bug fix), `test`,
  `refactor`, `chore`, `docs`, `ci`. `#N` is the issue number, never the PR number.
  `Co-authored-by:` only when both partners worked on it.
- PRs use the template (`Closes #N`, how it was tested, partner-review checkbox), need partner
  approval, and **merge only when CI is green** (branch protection). Merge commits, not squash.
  Merge one PR at a time: update the next branch from `main` and wait for green before merging it.
- Rules changes (this file, `docs/DESIGN.md`) go in their own PR.
- Sprint records: `docs/sprints/sprint-N/` (`planning.md`, `standups.md`, `review.md`, `retro.md`). Never fabricate any.

## 11. CI
<!-- Why: a red CI on day one is cheap; on day ten it's a week of debugging. -->
- `.github/workflows/ci.yml` runs on every PR: lint + format → unit + integration → build → E2E,
  plus a security scan (`npm audit`, CodeQL).
- The pre-commit hook (Husky + lint-staged) runs lint and format locally.
- CI never uses production secrets. Never disable a test, lower coverage, or add `@ts-ignore` to get green.

## 12. Security
<!-- Why: SwipeWise handles financial data. These are our security requirements. -->
- argon2id passwords; JWT in an httpOnly, Secure, SameSite=Lax cookie; `helmet`; CORS allowlist (only
  `/api/public/*` allows any origin: GET only, no credentials); strict rate limits on sign-up and
  log-in; one generic message for wrong email or password.
- Account rules (US-01): passwords are at least 8 characters with at least one number; emails are
  unique, compared case-insensitively; registering an existing email returns 409 with a clear message.
- **Card-number guard:** every free-text field uses the shared `noCardNumber` Zod refinement (reject
  13–19 digit runs that pass a Luhn check). Log the field name only, never the value.
- Never ask for, store, or log card numbers, CVVs, expiration dates, statement balances, or bank details.
- Only admins change the catalog and stores (`requireAdmin`).
- Security alerts (CodeQL, `npm audit`): fix the real issue first. Dismiss one only with a test that
  proves it's safe and the reason written in the dismissal.
- No secrets in frontend code or `VITE_*` vars. Never commit `.env`; if it happens, rotate the keys.
  Logs redact tokens, cookies, and passwords. No `$queryRawUnsafe`.
- Demo cards use made-up names only ("Mint Everyday", "Harbor Travel"), never real card or bank names,
  even with "Demo" in front. Never invent real card terms. Retire, never delete, cards users hold.
- Required tests: User A can't read, change, or delete User B's data (including by guessing IDs); a
  regular user can't perform admin actions; card-number input is rejected and never reaches the
  database or logs.

## 13. Accessibility
<!-- Why: agents skip accessibility unless told. Target WCAG 2.2 AA. -->
- Keyboard-only use works with a visible focus ring; every input has a visible label; contrast ≥ 4.5:1.
- Respect `prefers-reduced-motion`. Never show status by color alone. Announce dynamic results with `aria-live`.

## 14. Do's, don'ts, and ask first
<!-- Why: a short checklist the agent can scan before every change. -->
- **Do:** small steps, one issue at a time, tests first; reuse shared Zod schemas, existing
  components, and DESIGN.md tokens; use the exact UI text from `docs/ui-behavior.md`.
- **Don't:** add libraries not in `docs/dependencies.md`; use floats for money or `Date` for month
  math; invent facts, stats, ratings, security claims, or real card brands in the UI; build
  non-goals or extras the issue didn't ask for; push to `main`; skip tests or loading/empty/error states.
- **Ask first:** schema changes beyond the issue; new libraries; changes to this file or
  `docs/DESIGN.md`; anything near a non-goal.

## 15. Where docs live
Files marked *(later)* don't exist yet; don't look for or create them unless an issue asks.

| What | Where |
|---|---|
| Requirements (stories `US-xx`, ACs) | GitHub issues |
| Design tokens and rules / mockups | `docs/DESIGN.md` / `docs/design/` |
| Screen behavior (states, flows, errors) | `docs/ui-behavior.md` |
| Libraries | `docs/dependencies.md` |
| Sprint planning, standups, reviews, retros | `docs/sprints/sprint-N/` |
| Contribution log | `docs/contributions.md` |
| API | `docs/api/openapi.yaml` (generated); Swagger UI at `/api/docs` |
| Architecture and database diagrams | `docs/architecture.md` |
| PR and issue templates | `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/` |
| Decisions, Definition of Done | `docs/decisions/`, `docs/definition-of-done.md` *(later)* |

Never copy rules into `.agents/`, `.cursor/`, or `.claude/`.

## 16. Revision history
<!-- Every rule change gets a row. This is our evidence of iteration for HW3. -->
| Version | Date | What changed | Why |
|---|---|---|---|
| v0.1 | 2026-10-28 | First draft from the idea doc | — |
| v0.2 | 2026-10-28 | Cut to under 200 lines and moved details to `docs/`; synced with PRD non-goals; story IDs instead of section numbers; UI points to `DESIGN.md`; paths match the lecture layout; added role rotation, `CLAUDE.md`, CI-green merges, and Husky | v0.1 was ~450 lines, referenced features the PRD dropped and colors we rejected, so the agent could have built the wrong things |
| v0.3 | 2026-10-28 | Added account rules (US-01); "Ask first" as a list; created `CLAUDE.md` and every linked `docs/` file | Pre-Run B review: missing linked files would make the agent stop and ask, and rules not written down can't be followed |
| v0.4 | 2026-10-29 | Paths match the repo (`docs/DESIGN.md`, `docs/ui-behavior.md`, mockup files); GitHub issues replace the PRD as requirements; design section now describes the mockups, both layouts, key components, and the sign-up flow; added Do's and Don'ts; marked docs that don't exist yet | Pre-Run B check: wrong paths and a thin design section would make the agent guess the look and flow |
| v0.5 | 2026-10-29 | Demo cards must use made-up names; sentence-case labels; DESIGN.md colors only (strength bar); added `npm run build` to the done check; added an Environment note for Node and reading issues without `gh`; removed `CLAUDE.md` | Run B results: it named a card "Demo Sapphire Reserve", used ALL CAPS labels and an orange color, had a failed build, and spent time searching for Node and the GitHub CLI |
| v0.6 | 2026-11-15 | Hosting and scheduler chosen (Vercel, Supabase, Vercel Cron) and removed from "Ask first"; migration rules (fresh unique timestamps, never edit an applied migration, prod migrations in `vercel-build`); shared Prisma client only, scripts run with `tsx`; `apiFetch` for CSRF; Postgres rate limits with `trust proxy`; public API rules; security alerts need a fix, or a test plus a written reason; full test suite with real output, skipped is not passed; merge `main` before the PR and merge one PR at a time; check the board before creating issues and never reuse one; new routes go in the security suite; `fix(...)` for bugs with the issue number; coverage target no longer claimed as enforced; docs table matches the repo; removed the built sign-up flow detail (screen behavior lives in `docs/ui-behavior.md`). Written by Dhanraj from both partners' Sprint 2 lessons | Sprint 2: an applied migration was edited, two migrations shared a timestamp, #50 was reused for work that duplicated #26, `main` went red when two PRs merged a minute apart, an agent reported skipped tests as passing, and the old coverage line described a threshold that doesn't exist |
