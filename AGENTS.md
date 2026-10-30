<!--
  AGENTS.md — SwipeWise (P2): the one rules file every AI tool we use reads; CLAUDE.md points here.
  Under ~200 lines on purpose: it loads on every request, so details live in docs/ and are linked.
  Each section opens with a "Why". Change it only via its own PR, revisit it at every retro,
  and log each change in the revision history.
-->

# SwipeWise — Agent Rules

SwipeWise is a private card wallet: it shows which of the user's existing credit cards to use for a
purchase and reminds them before perks, bonuses, points, or payments slip. **It never moves money
and never stores full card numbers.**

> **Status: v0.4 (Oct 29, 2026).** Design docs and mockups are in `docs/`. Requirements are the GitHub issues.

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
5. Before saying you're done: `npm run lint && npm run typecheck && npm test`.
6. Report: files changed, tests written, commands run with their real output, what's left.
7. Never claim a test passes or a deploy works unless you ran it. Never push to `main`; ask before pushing.

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
| Hosting, scheduler | Not chosen — ask first |

Allowed and avoided libraries: `docs/dependencies.md`. Anything not listed there: ask first.

## 4. Commands
<!-- Why: exact commands stop the agent from inventing ad-hoc ones. -->
| Task | Command |
|---|---|
| Install / database / dev | `npm install` / `docker compose up -d db` / `npm run dev` |
| Migrate / seed | `npm run db:migrate` / `npm run db:seed` |
| Unit + integration / coverage | `npm test` / `npm run test:coverage` |
| End-to-end | `npm run e2e` |
| Lint / format / types | `npm run lint` / `npm run format` / `npm run typecheck` |

## 5. Architecture
<!-- Why: keeps business logic out of routes and React. -->
- Monorepo: `apps/web` (React), `apps/api` (Express), `packages/shared` (Zod schemas + types).
- API layers: routes → controller → service → `domain/` (pure logic) + repo (the only place that
  imports Prisma).
- The server is the only source of truth for reward math, statuses, and permissions. The frontend
  shows what the API returns and never recomputes it.
- `apps/api/src/domain/` is pure: no Express, no Prisma, and time is passed in
  (`{ now, timeZone }`). Never call `DateTime.now()` or `new Date()` inside it.
- Every user-data query is scoped to the logged-in user; someone else's record returns 404.
- The daily reminder job is idempotent (unique `dedupeKey`) and catches up on missed days.
- REST under `/api/v1`; errors as `{ "error": { "code", "message" } }`; every endpoint documented
  in `docs/api/openapi.yaml`.
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
- Unit: everything in `domain/`, at **90% line and branch coverage**, enforced in the Vitest config.
- Integration: every endpoint, including auth and ownership, against a test database
  (`DATABASE_URL_TEST`).
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
- **Sign-up flow (US-01):** Name, Email, Password, Confirm password in one glass group → validate
  on blur → password strength bar → "Create account" (disabled with a spinner while sending) →
  success goes to Wallet's empty state. Website: headline and floating card art on the left, form
  card on the right.
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
- One branch per issue: `feature|fix|chore|docs/<issue#>-<slug>`.
- Commits: `type(scope): imperative summary (#issue)`. Types: `feat`, `fix`, `test`, `refactor`,
  `chore`, `docs`, `ci`. `Co-authored-by:` only when both partners worked on it.
- PRs use the template (`Closes #N`, how it was tested, partner-review checkbox), need partner
  approval, and **merge only when CI is green** (branch protection). Merge commits, not squash.
- Rules changes (this file, `docs/DESIGN.md`) go in their own PR.
- Sprint records: `docs/sprints/sprint-N/` (`planning.md`, `standups.md`, `retro.md`). Never fabricate any.

## 11. CI
<!-- Why: a red CI on day one is cheap; on day ten it's a week of debugging. -->
- `.github/workflows/ci.yml` runs on every PR: lint + format → unit + integration → build → E2E,
  plus a security scan (`npm audit`, CodeQL).
- The pre-commit hook (Husky + lint-staged) runs lint and format locally.
- CI never uses production secrets. Never disable a test, lower coverage, or add `@ts-ignore` to get green.

## 12. Security
<!-- Why: SwipeWise handles financial data. These are our security requirements. -->
- argon2id passwords; JWT in an httpOnly, Secure, SameSite=Lax cookie; `helmet`; CORS allowlist;
  rate limits on `/api/v1/auth/*`; one generic message for wrong email or password.
- Account rules (US-01): passwords are at least 8 characters with at least one number; emails are
  unique, compared case-insensitively; registering an existing email returns 409 with a clear message.
- **Card-number guard:** every free-text field uses the shared `noCardNumber` Zod refinement (reject
  13–19 digit runs that pass a Luhn check). Log the field name only, never the value.
- Never ask for, store, or log card numbers, CVVs, expiration dates, statement balances, or bank details.
- Only admins change the catalog and stores (`requireAdmin`).
- No secrets in frontend code or `VITE_*` vars. Never commit `.env`; if it happens, rotate the keys.
  Logs redact tokens, cookies, and passwords. No `$queryRawUnsafe`.
- Seeded cards are labeled "Demo"; never invent real card terms. Retire, never delete, cards users hold.
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
- **Ask first:** hosting, the job scheduler, and deploy previews; schema changes beyond the issue;
  changes to this file or `docs/DESIGN.md`; anything near a non-goal.

## 15. Where docs live
Files marked *(later)* don't exist yet; don't look for or create them unless an issue asks.

| What | Where |
|---|---|
| Requirements (stories `US-xx`, ACs) | GitHub issues |
| Design tokens and rules / mockups | `docs/DESIGN.md` / `docs/design/` |
| Screen behavior (states, flows, errors) | `docs/ui-behavior.md` |
| Libraries | `docs/dependencies.md` |
| Sprint planning, standups, retros | `docs/sprints/sprint-N/` |
| API | `docs/api/openapi.yaml` *(later)* |
| Folder tree, decisions, Definition of Done | `docs/architecture.md`, `docs/decisions/`, `docs/definition-of-done.md` *(later)* |

`CLAUDE.md` contains only `@AGENTS.md`. Never copy rules into `.agents/`, `.cursor/`, or `.claude/`.

## 16. Revision history
<!-- Every rule change gets a row. This is our evidence of iteration for HW3. -->
| Version | Date | What changed | Why |
|---|---|---|---|
| v0.1 | 2026-10-28 | First draft from the idea doc | — |
| v0.2 | 2026-10-28 | Cut to under 200 lines and moved details to `docs/`; synced with PRD non-goals; story IDs instead of section numbers; UI points to `DESIGN.md`; paths match the lecture layout; added role rotation, `CLAUDE.md`, CI-green merges, and Husky | v0.1 was ~450 lines, referenced features the PRD dropped and colors we rejected, so the agent could have built the wrong things |
| v0.3 | 2026-10-28 | Added account rules (US-01); "Ask first" as a list; created `CLAUDE.md` and every linked `docs/` file | Pre-Run B review: missing linked files would make the agent stop and ask, and rules not written down can't be followed |
| v0.4 | 2026-10-29 | Paths match the repo (`docs/DESIGN.md`, `docs/ui-behavior.md`, mockup files); GitHub issues replace the PRD as requirements; design section now describes the mockups, both layouts, key components, and the sign-up flow; added Do's and Don'ts; marked docs that don't exist yet | Pre-Run B check: wrong paths and a thin design section would make the agent guess the look and flow |
