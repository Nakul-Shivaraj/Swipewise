<!--
  AGENTS.md — SwipeWise (P2)
  Read by AI coding agents (Antigravity, Claude Code, Cursor, Copilot) before every task.
  Humans: this doubles as our engineering handbook.

  How this file is organized:
    0. How to work            -> the step-by-step protocol the agent follows on every issue
    1. Project context        -> stack, structure, patterns, units, naming, commands, tests
    2. PRD & design           -> where the spec and mockups live, screens, components, flows
    3. Scrum & Git workflow   -> board, branches, commits, PRs, issue references
    4. Do's & don'ts          -> always/never, dependencies, security, accessibility
    5. Ask-first gates        -> decisions the agent must not make alone
    6. Definition of Done
    7. Open assumptions       -> things we decided but haven't confirmed
    8. Revision history       -> update every time a rule changes

  Rules tagged (why: ...) exist because ignoring them causes a real bug or a grading loss.
  Keep this file lean. If it grows past ~500 lines, move detail into docs/ and link to it here.
  Long rules files get skimmed by agents too.
-->

# SwipeWise — Agent Instructions

SwipeWise is a full-stack web app that helps people get the most out of credit cards they already
have: it tells them which card to use for each purchase, tracks perks and sign-up bonuses, reminds
them about payment due dates, and warns them before points expire. **It never moves money and never
stores full card numbers.**

> **Status: draft v0.1 (Oct 28, 2026).** Sections 0, 1, and 3–6 (stack, structure, workflow,
> do's and don'ts) are stable. **Section 2 (PRD & design) is provisional**: it is based on the
> SwipeWise idea doc (`docs/IDEA.md`) and gets updated once the PRD and mockup are ready. Until the PRD exists, "PRD §x.y" references point to the idea doc's sections.
> Issue numbers in examples are placeholders; real issues are created from the PRD.

**Source of truth, in order:** the security and money rules in this file always win. After that:
(1) the GitHub Issue you are working on, (2) `docs/PRD.md`, (3) the mockups in `docs/mockups/`,
(4) the rest of this file. If two sources conflict, stop and ask. Do not silently pick one.

---

## 0. How to work (follow on every task)

<!-- Why: agents left alone generate whole features at once and skip tests. This forces one issue, test-first, with an honest report at the end. -->

1. **One issue at a time.** Read it first (`gh issue view <N>`). Restate its acceptance criteria
   (ACs) and your plan in 3–6 lines before writing code. Never generate the whole app at once.
2. **Find the spec.** Open the PRD section the issue points to and the matching mockup. If the issue
   has no PRD section or mockup, say so and ask.
3. **Branch** from up-to-date `main`: `feature/<N>-<short-kebab-slug>` (see §3.2).
4. **Red:** write failing tests that map 1:1 to the ACs. Run them and show they fail.
   Commit: `test(<scope>): <what> (#N)`.
5. **Green:** write the minimum code to pass. Run tests. Commit: `feat(<scope>): <what> (#N)`.
6. **Refactor** with tests green. Then run the full check:
   `npm run lint && npm run typecheck && npm test`.
7. **Report** after every feature: files changed, tests written, commands run with their real
   output, results, and remaining work. (why: the PRD requires it, and it makes PR review fast)
8. **Never claim** a test passes, a build works, or a deployment is live unless you ran it in this
   session and saw it succeed.
9. Never push to `main`, never force-push, and ask before pushing any branch or opening a PR.

---

## 1. Project context

<!-- Why: without this, the agent guesses a stack and folder layout and every feature ends up looking different. -->

### 1.1 Tech stack

<!-- Targets chosen at kickoff. The lockfile is authoritative. Update this table in the same PR
     as any major-version upgrade. Agents: never bump a major version without an issue. -->

| Layer | Choice | Version target |
|---|---|---|
| Runtime | Node.js | 24 LTS |
| Language | TypeScript, `strict: true`, no `any` | latest stable at scaffold |
| Frontend | React + Vite + React Router | React 19 |
| Styling | Tailwind CSS with design tokens (§2.2) | 4.x |
| Server state (web) | TanStack Query | 5.x |
| Forms | React Hook Form + Zod resolver | latest |
| Backend | Express + TypeScript | 5.x |
| Database | PostgreSQL + Prisma ORM (with `pg_trgm` extension) | PG 17, Prisma 7 |
| Validation & shared types | Zod schemas in `packages/shared` | 4.x |
| Dates & time zones | Luxon (IANA zones) | 3.x |
| Auth | JWT in httpOnly cookie, passwords hashed with argon2id | — |
| Unit/integration tests | Vitest, Supertest, React Testing Library | Vitest 4 |
| E2E tests | Playwright | latest |
| CI/CD | GitHub Actions | — |
| Scheduler & hosting | **Not chosen yet — ask first (§5)** | — |

### 1.2 Repository structure

<!-- Why: tells the agent where each kind of code goes, so domain logic doesn't leak into routes or React components. -->

```
swipewise/
├── AGENTS.md                  # this file
├── apps/
│   ├── web/                   # React + Vite frontend
│   │   └── src/
│   │       ├── app/           # router, providers, app shell, bottom nav
│   │       ├── features/      # one folder per feature: wallet/, helper/, perks/, bonuses/,
│   │       │                  #   payments/, points/, notifications/, settings/, admin/
│   │       │                  #   each has components/, hooks/, api.ts, *.test.tsx
│   │       ├── components/ui/ # shared presentational components (Button, Card, ProgressBar…)
│   │       └── lib/           # api client, formatCents, query keys
│   └── api/                   # Express backend
│       ├── prisma/            # schema.prisma, migrations/, seed.ts
│       ├── src/
│       │   ├── domain/        # PURE logic, no Express/Prisma imports, 90% coverage
│       │   │   ├── rewards/   #   ranking, cap splitting, tie-breakers, point value
│       │   │   └── dates/     #   quarters, perk periods, due dates, deadlines, expiry
│       │   ├── modules/       # one folder per resource: <name>.routes.ts, .controller.ts,
│       │   │                  #   .service.ts, .repo.ts, .schemas.ts
│       │   ├── jobs/          # daily reminder job, card-data sync job (idempotent)
│       │   ├── middleware/    # requireAuth, requireAdmin, validate, errorHandler, rateLimit
│       │   └── config/        # env.ts (Zod-validated), logger.ts (pino with redaction)
│       └── test/
│           ├── integration/   # *.int.test.ts with Supertest against a test database
│           ├── factories/     # test data builders (demo cards, users, wallet cards)
│           └── fixtures/      # recorded card-data API responses (never call the live API)
├── packages/
│   └── shared/                # Zod schemas, inferred TS types, money/Luhn helpers
├── e2e/                       # Playwright specs
├── docs/                      # PRD, mockups, sprint docs, API docs (see §2.1)
└── .github/                   # workflows/, pull_request_template.md, ISSUE_TEMPLATE/
```

### 1.3 Architecture and key patterns

<!-- Why: these patterns come straight from the idea doc's security and reliability rules (server is the source of truth, ownership checks, idempotent jobs). -->

- **Server is the only source of truth** for reward math, statuses, and permissions. The frontend
  displays what the API returns; it never re-computes rankings, deadlines, or statuses.
- **Layering in the API:** `routes → controller → service → domain (pure) + repo (Prisma)`.
  Controllers parse and validate input with Zod and shape responses. Services hold the use-case
  logic and permissions. Repos are the only files that import Prisma.
- **Domain functions are pure and take time as an argument:** `rankCards(input, { now, timeZone })`.
  Never call `DateTime.now()` or `new Date()` inside `domain/`. (why: date logic must be testable
  at quarter, month-end, and time-zone boundaries)
- **Every query that touches user data is scoped by the logged-in user:**
  `where: { id, userId: req.user.id }`. A record that exists but belongs to someone else returns
  **404**, not 403. (why: prevents ID enumeration; mandatory security test #1)
- **Jobs are idempotent and catch up.** Each reminder has a unique `dedupeKey`
  (`<type>:<targetId>:<cycle>:<offsetDays>`). The daily job creates every reminder whose send date
  is on or before today and doesn't exist yet, using `createMany({ skipDuplicates: true })`.
  Running it twice creates nothing new; skipping a day is caught up on the next run.
- **Card-data sync never runs in a request.** The sync job writes proposed changes to a review
  queue with before/after JSON. Nothing goes live until an admin approves. On API failure or bad
  data, keep the last good data and create an admin alert.
- **Catalog snapshots:** when a user adds a card with a bonus offer, copy the offer onto the wallet
  card. Later catalog edits never change that copy.
- **Retire, never delete,** catalog cards that users hold. Users keep them, marked
  "No longer updated."
- **Every admin write creates an audit log row** (who, what, before, after, when) in the same
  database transaction as the change.
- **API shape:** REST under `/api/v1`, plural kebab-case resources (`/api/v1/wallet-cards/:id`).
  Errors are always `{ "error": { "code": "NOT_FOUND", "message": "…" } }`.
  Status codes: 400 validation, 401 not logged in, 403 not an admin, 404 missing or not yours,
  409 conflict (e.g. duplicate nickname), 429 rate limited. Document routes with OpenAPI generated
  from the Zod schemas.
- **Environment variables** are validated with Zod in `apps/api/src/config/env.ts`. The server
  refuses to start if one is missing. Every variable is listed in `.env.example`.

### 1.4 Units for money, rates, and dates (non-negotiable)

<!-- Why: floats and naive date math are the two bugs most likely to break reward rankings, deadlines, and reminders. -->

| Concept | Representation | Example |
|---|---|---|
| Money | integer cents, field suffix `Cents` | `$1,500.00` → `capCents: 150000` |
| Earn rate (cash back or points) | points per dollar × 100, field `rateX100` | 5% cash back → `500`; 3x points → `300` |
| Point value | cents per 100 points, field `centsPer100Points` | cash back → `100`; 1.5¢/pt → `150` |
| Instant in time | `DateTime` (timestamptz, UTC), field suffix `At` | `createdAt`, `sentAt` |
| Calendar date | `@db.Date` / ISO `YYYY-MM-DD`, field suffix `Date` | `openedDate`, `dueDate` |
| User time zone | IANA string on the user | `America/Los_Angeles` |

- Reward value in cents = `amountCents × rateX100 × centsPer100Points / 1_000_000`.
  Sum the integer numerators across cap segments, divide **once**, round half up.
- Cash back is modeled as a program worth 1¢ per point, so one formula covers every card.
- Never use floating-point numbers for money. The only place cents are divided by 100 is
  `formatCents()` for display. Parse user-typed dollars with `parseDollarsToCents()` (string math).
- All period, quarter, due-date, deadline, and expiry logic goes through `apps/api/src/domain/dates/`
  using Luxon in the user's time zone. Never do month arithmetic with `Date`.
  Luxon's `plus({ months: 1 })` clamps Jan 31 → Feb 28/29, which is the PRD rule for deadlines.

### 1.5 Naming conventions

<!-- Why: consistent names make AI-written code and our own code readable side by side. -->

- Files: `kebab-case.ts`; React components `PascalCase.tsx`; tests next to the code as
  `*.test.ts(x)`; integration tests `*.int.test.ts`; E2E `*.spec.ts`.
- Variables and functions `camelCase`; types and components `PascalCase`; constants
  `SCREAMING_SNAKE_CASE`; booleans start with `is/has/can/should`.
- Prisma models singular `PascalCase` (`WalletCard`), tables mapped to `snake_case` with `@@map`.
- Zod schemas end in `Schema` (`addWalletCardSchema`); inferred types drop it (`AddWalletCard`).
- React hooks `useThing`; query keys come from `lib/query-keys.ts`, never inline strings.
- Name things in the PRD's vocabulary: wallet card, rewards program, reward rule, perk, bonus
  offer, rotating category, store alias, review queue. Don't invent synonyms.

### 1.6 Commands

<!-- Defined in the root package.json by the repo-setup issue. Agents: use these, not ad-hoc ones. -->

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev (web + api) | `npm run dev` |
| Database up (Docker) | `docker compose up -d db` |
| Migrate / seed | `npm run db:migrate` / `npm run db:seed` |
| Unit + integration tests | `npm test` |
| Coverage | `npm run test:coverage` |
| E2E | `npm run e2e` |
| Lint / types | `npm run lint` / `npm run typecheck` |

### 1.7 Testing strategy

<!-- Why: the idea doc requires TDD and specific test types. Test names tied to ACs show the grader that tests came from the issues. -->

- **TDD always** (Red → Green → Refactor). Add a regression test for every bug before fixing it.
  The `test(...)` commit must come before the `feat(...)` commit in the branch history.
- **Unit (Vitest):** everything in `domain/`. Cover the PRD §6 edge cases that apply to the issue.
  Coverage threshold on `apps/api/src/domain/**`: **90% lines and 90% branches**, enforced in
  the Vitest config. Overall API: 70%.
- **Integration (Vitest + Supertest):** auth, every endpoint, persistence, and authorization,
  against a separate test database (`DATABASE_URL_TEST`), reset between files.
- **Jobs:** test duplicate runs (run twice → no new rows) and missed runs (skip a day → caught up).
- **Card-data sync:** tests use recorded fixtures in `apps/api/test/fixtures/`. Never the live API.
- **Frontend (React Testing Library + user-event):** key interactions, plus loading, empty, and
  error states. Query by role and label, not by test IDs or CSS classes.
- **E2E (Playwright):** register, log in, add a card, use the card helper and store search, mark a
  perk used, complete a bonus, mark a payment paid, update a points balance.
- **Test names map to ACs:** `describe('rankCards (#N)')`, `it('AC3: splits a purchase that crosses the cap')`.
- Use a fixed clock and named factories (`demoGroceryPlus()`), never `Date.now()` or random data.

---

## 2. PRD & design references (provisional)

<!-- Everything in this section comes from the idea doc. Rewrite it from the PRD and mockup once
     they are ready. The workflow rules in sections 0, 1, 3–6 don't depend on it. -->

### 2.1 Documents

| What | Where |
|---|---|
| Idea doc (current reference) | `docs/IDEA.md` — the SwipeWise project idea, section numbers preserved |
| PRD (features, user stories, ACs) | `docs/PRD.md` — issues are created from it |
| Mockups / prototype | `docs/mockups/*.png` and the live prototype: <!-- TODO: paste Claude artifact or Figma link --> |
| Backlog and sprints | GitHub Project board + `docs/PRODUCT_BACKLOG.md`, `docs/SPRINT_1.md`, `docs/SPRINT_2.md` |
| Retros, pairing, DoD | `docs/SPRINT_RETROSPECTIVES.md`, `docs/PAIR_PROGRAMMING.md`, `docs/DEFINITION_OF_DONE.md` |
| API docs | generated OpenAPI at `docs/api/openapi.json` |

Before implementing UI, open the mockup for that screen. If a screen has no mockup, copy the
patterns of the closest existing screen and flag it in the PR description.

### 2.2 Design system

Clean, modern fintech look: deep navy background, mint-green accents, large readable numbers.
Mobile-first, because people open it at the checkout counter.

<!-- Hex values below must match the mockups. If they differ, the mockups win; update this table. -->

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A1628` | app background |
| `surface` / `surface-2` | `#10213D` / `#172C4F` | cards, sheets / raised elements |
| `border` | `#24406B` | dividers, inputs |
| `text` / `text-muted` | `#E8EEF7` / `#9FB0C8` | body / secondary |
| `accent` | `#3DDC97` | primary buttons, top pick, focus ring, progress |
| `warning` / `danger` | `#FBBF24` / `#F87171` | due soon, expiring / missed, errors |

- Use Tailwind theme tokens only. No raw hex values or arbitrary colors in components.
- Money and dates use `tabular-nums`. Dollar values are the largest text in any card row.
- Layout: single column under 640px with a bottom nav (Helper, Wallet, Tracking, Alerts, Settings);
  sidebar at 1024px and up. Touch targets at least 44×44px.

### 2.3 Screens (from the idea doc until the mockup exists)

<!-- Update each line to describe what our mockup actually shows. -->

1. **Card Helper ("Which card?")** — the home screen. Store search box at the top, category chips
   below, optional amount field. Results list ranks wallet cards; the top pick is highlighted in
   mint with its estimated dollar value.
2. **Wallet** — grid of card tiles (card art color, name, nickname, issuer). "Add card" opens a
   catalog search sheet.
3. **Card detail** — reward rules, current and next quarter's rotating categories, perks, bonus,
   payment settings, "last verified" date and source link.
4. **Tracking** — tabs for Perks, Bonuses, Points, Payments.
5. **Alerts** — in-app notification list with unread badge on the bell.
6. **Settings** — time zone, reminder toggles and timings, export my data, delete my account.
7. **Admin** — programs, cards, reward rules, perks, offers, stores, store-suggestion queue,
   card-data review queue (before/after diff), audit log.

### 2.4 Key UI components and expected behavior

<!-- Why: describes behavior, not just looks, so the agent builds the states (loading, empty, error, notes) a mockup image can't show. -->

- **`StoreSearch`** — debounced (250ms), case-insensitive, tolerates small typos (server uses
  `pg_trgm`). Matches aliases ("safeway.com" → Safeway). No match → "Pick a category" and
  "Suggest this store" (goes to the admin queue). Store in several categories → ask which one.
- **`CategoryChips`** — single select; keyboard arrows move between chips.
- **`AmountInput`** — optional; accepts `12`, `12.5`, `12.50`; converts with `parseDollarsToCents`.
- **`RecommendationList`** — renders the API's ranking as-is. Each row shows the dollar value,
  the rate used, and notes from the API: "Assuming full cap is available," "Activate to earn 5%,"
  "Cap reached — earning base rate." Results are announced with `aria-live="polite"`.
- **`CardTile`** — card art color, name, nickname, "No longer updated" badge for retired cards,
  "Demo card" badge for seeded demo cards, last verified date.
- **`PerkRow`** — amount used / left this period, "Mark used" (full or partial amount).
- **`BonusProgress`** — progress bar, amount left, days left, average needed per day, status pill
  (In progress / Earned / Missed). Status always has text plus an icon, never color alone.
- **`PaymentDueRow`** — next due date, autopay badge, "Mark paid" for the current cycle.
- **`PointsBalanceRow`** — balance, dollar value, expiry date or "No expiry," last updated.
- **`Disclaimer`** — "Not financial advice. Not affiliated with any card issuer. Card terms can
  change." Visible in the footer and under the Card Helper results.
- Every data view has a skeleton loading state, an empty state with one clear action, and an
  error state with a retry button.

### 2.5 User flows to follow

<!-- Why: the agent implements screens one at a time. Flows keep the pieces connected the way a real user moves through the app. -->

1. **Onboarding:** register → time zone pre-filled from the browser (editable) → add first card →
   land on Card Helper.
2. **At checkout:** open app → type store ("safewy") → category resolved → optional amount →
   ranked list → top pick visible without scrolling on a 375px-wide screen.
3. **Add a card:** search catalog → pick card → optional nickname, opened date, payment due day,
   autopay → saved; bonus offer snapshot copied if the card has one.
4. **Use a perk:** Tracking → Perks → "Mark used" → full or partial → amount left updates.
5. **Payment:** reminder appears in Alerts → open card → "Mark paid" → remaining reminders for that
   cycle stop.
6. **Admin edit:** edit a card → save → audit log entry visible. Sync change → review queue →
   approve or reject.

---

## 3. Scrum & Git workflow

<!-- Why: links every line of code to an issue, a branch, a commit, and a PR, so sprint progress is traceable on the board. -->

### 3.1 Board and issues

- Board columns: **Backlog → Sprint Todo → In Progress → In Review → Done.**
- Milestones: **Sprint 1** (Foundation) and **Sprint 2** (Tracking and Delivery). Plaid is a
  stretch goal for a later sprint and needs approval.
- Every issue has: an action-oriented title, a user story, the PRD section, an estimate, ACs as a
  checklist, one type label (`feature`, `bug`, `chore`, `docs`), one priority label, a milestone.
- Move the issue to *In Progress* when you create its branch and to *In Review* when the PR opens.
  Merge moves it to *Done*.
- No work without an issue. If you find needed work that has no issue, stop and propose one
  (title, ACs, labels) instead of doing it silently.
- Issues come from the PRD, not the idea doc. The AI drafts them from the PRD's user stories and
  acceptance criteria; both partners review and edit them together at Sprint Planning before they
  go on the board. The agent proposes issues; it never creates them on its own.

### 3.2 Branches

<!-- Why: the issue number in the branch name links work back to the board. -->

`<type>/<issue-number>-<short-kebab-slug>`, where type is `feature`, `fix`, `chore`, `docs`, or
`test`. Example: `feature/12-card-helper-ranking`. One issue per branch.

### 3.3 Commits

<!-- Why: Conventional Commits plus the issue number make the history readable and show test-first order. -->

Conventional Commits with the issue number:
`<type>(<scope>): <imperative summary, ≤72 chars> (#<issue>)`

- Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `ci`.
- Scopes: `api`, `web`, `shared`, `domain`, `db`, `jobs`, `admin`, `ci`, `docs`.
- Example: `feat(domain): split purchase across spending cap (#12)`
- Add `Co-authored-by:` only when both partners genuinely worked on that commit.

### 3.4 Pull requests

<!-- Why: pair project, so every change gets a second pair of eyes before main. -->

- Title in commit format. Body follows `.github/pull_request_template.md`: `Closes #<N>`, what
  and why, screenshots for any UI change, test evidence (command + summary of real output), DoD
  checklist.
- At least one approving review from the partner. CI must be green. No self-merging.
- Merge with a merge commit, not squash, so the test-first history stays visible.
- One feature per PR where practical. Keep PRs under ~400 changed lines; split otherwise.

### 3.5 Referencing issues in code

<!-- Why: orphan TODOs get forgotten. Tying them to issues keeps them on the board. -->

- `TODO` comments must reference an issue: `// TODO(#23): handle expired bank logins`.
  No orphan TODOs.
- When code implements a specific PRD rule, cite it once at the top of the function:
  `// PRD §2.4: tie-breakers are dollar value, then lower annual fee, then name A–Z.`

### 3.6 Pair programming and honesty

<!-- Why: the idea doc forbids fabricated contributions or results. Agents must not invent them either. -->

- Team: **Dhanraj Pandya** and **Nakul Shivaraj**. Responsibilities are decided at Sprint Planning
  and recorded in `docs/PAIR_PROGRAMMING.md`. If that file isn't filled in, ask for both names and
  roles before writing any contribution record.
- Never fabricate contributions, sprint results, meetings, test results, or deployment status.

---

## 4. Do's and don'ts

<!-- Why: short, scannable rules the agent checks its output against before reporting done. -->

### 4.1 Always

- Keep reward math and date logic in `apps/api/src/domain/` and import it everywhere else.
- Validate every request body, query, and param with a Zod schema from `packages/shared`.
- Use the same Zod schema on the client form and the server route.
- Handle the PRD §6 edge cases that touch your issue, and list in the PR which ones you covered.
- Label seeded catalog cards "Demo." Show the "last verified" date on every card.
- Show the disclaimer wherever a recommendation appears.

### 4.2 Never

- Never use floats for money (`parseFloat`, `toFixed`, `Number("12.34") * 100`, Prisma `Float`).
- Never use `Date` arithmetic or `DateTime.now()` inside `domain/`.
- Never call the card-data API inside a request handler, and never in tests.
- Never ask for, store, or log full card numbers, CVVs, expiration dates, statement balances, or
  bank details.
- Never invent real card terms. Real cards only with a verified source URL and date.
- Never delete a catalog card that users hold. Retire it.
- Never put secrets in frontend code or in `VITE_*` variables. Never log tokens or passwords.
- Never use `$queryRawUnsafe` or string-built SQL. Use Prisma or tagged `$queryRaw`.
- Never store auth tokens in `localStorage`.
- Never disable a test, lower a coverage threshold, or add `// @ts-ignore` to get CI green.

### 4.3 Dependencies

<!-- Why: stops the agent from pulling in random packages that duplicate what we already chose. -->

- **Preferred:** `zod`, `luxon`, `argon2`, `jsonwebtoken`, `helmet`, `express-rate-limit`,
  `cookie-parser`, `cors`, `pino`, `pino-http`, `@asteasolutions/zod-to-openapi`,
  `@tanstack/react-query`, `react-router`, `react-hook-form`, `@hookform/resolvers`,
  `@radix-ui/*` primitives, `lucide-react`, `clsx`, `msw` (frontend tests only).
- **Avoid:** `moment`, `dayjs` without the timezone plugin, `lodash`, `axios` (use `fetch`),
  component kits (MUI, Chakra, Bootstrap) that fight our design tokens.
- **Anything not on the preferred list: ask first** and say why it's needed.

### 4.4 Security requirements

<!-- Why: SwipeWise handles financial data. These map directly to the idea doc's security section and its four mandatory tests. -->

- Passwords hashed with argon2id. JWT in an httpOnly, Secure, SameSite=Lax cookie, short expiry.
- `helmet` security headers, strict CORS allowlist, rate limits on `/api/v1/auth/*`.
- Generic auth errors ("Email or password is incorrect"). No user enumeration.
- **Card-number guard:** every free-text field (nicknames, spending notes, store suggestions,
  anything typed) uses the shared `noCardNumber` Zod refinement: reject any run of 13–19 digits
  (spaces or dashes allowed) that passes a Luhn check. Log the field name only, never the value.
- Admin-only routes use `requireAdmin`. Only admins change the catalog, stores, or review queues.
- pino redacts `authorization`, `cookie`, `password`, `token`, `accessToken`, and `*.secret`.
- Mandatory security tests (PRD §5) must exist and pass before Sprint 2 closes:
  1. User A can't read, change, or delete User B's data through any endpoint, including by
     guessing IDs.
  2. A regular user can't perform any admin action.
  3. Card-number-like input is rejected and never appears in the database or logs.
  4. (If Plaid is built) access tokens never appear in any response or log; unsigned or invalid
     webhooks are rejected.

### 4.5 Accessibility requirements (WCAG 2.2 AA)

<!-- Why: the idea doc requires keyboard support, contrast, and reduced motion. Agents skip these unless told. -->

- Everything works with keyboard only, with a visible mint focus ring.
- Every input has a visible label. Errors are linked with `aria-describedby`.
- Text contrast at least 4.5:1 (3:1 for large text). Check muted text on `surface-2`.
- Respect `prefers-reduced-motion`: no animated progress bars or transitions when it's set.
- Status is never shown by color alone.
- Dynamic results (rankings, saves, errors) are announced with `aria-live`.

---

## 5. Ask first — do not decide alone

<!-- Why: the idea doc says hosting, card-data API, email provider, and Plaid need our approval first. -->

Stop and present options (with trade-offs, cost, and limits) before:

- Choosing hosting, the scheduled-job runner, or deploy-preview setup.
- Choosing a card-data API or source (and its license terms).
- Choosing an email provider (email is a stretch goal).
- Starting anything Plaid, and before using any Plaid plan other than Sandbox.
- Adding a dependency not on the preferred list, or changing the Prisma schema beyond what the
  issue needs.
- Changing a rule in this file or a PRD rule.

---

## 6. Definition of Done

<!-- Why: one shared checklist for when an issue can move to Done, for both us and the agent. -->

An issue is Done when all of these are true:

- [ ] Every AC in the issue is checked off.
- [ ] Tests were written first, map to the ACs, and pass locally and in CI.
- [ ] Domain coverage stays at or above 90%.
- [ ] `npm run lint` and `npm run typecheck` are clean.
- [ ] Loading, empty, and error states exist for any new view; keyboard and screen-reader check done.
- [ ] Docs updated (README, API docs, sprint doc) if behavior changed.
- [ ] PR reviewed and approved by the partner, merged, issue closed, card in *Done*.

---

## 7. Open assumptions (confirm before building the affected feature)

<!-- The PRD says to document assumptions before building. Move each to "Confirmed" once agreed. -->

- Card Helper with no amount entered: rank by value per $100 and label it "per $100 spent."
- User changes time zone: future periods and reminders use the new zone; reminders already
  created are not recreated.
- Perk amount changed by an admin mid-period: the current period keeps the amount it started with.
- Bonus deadline and expiry dates are inclusive through 11:59 pm in the user's time zone.
- User marks a cycle paid, then changes the due day: that month's cycle stays paid; the new due
  day applies from the next cycle.

---

## 8. Revision history

<!-- Every rule change gets a row. This is our evidence of iteration for HW3. -->

| Version | Date | What changed | Why (what went wrong without it) |
|---|---|---|---|
| v0.1 | 2026-10-28 | First draft from the idea doc; stack, structure, and workflow rules | — |
| v1 | | Section 2 rewritten from the PRD and mockup | |
| v2 | | Changes after the HW3 before/after test | |
