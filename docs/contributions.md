# SwipeWise contribution log

Team: **Nakul Shivaraj** (`Nakul-Shivaraj`) and **Dhanraj Pandya** (`dhanraj176`).
Every change reached `main` through a pull request with one approval from the partner and green CI, CodeQL, and end-to-end checks. Each PR closes the issue in brackets.

## Roles

| Sprint | Dates | Scrum Master | Product Owner |
|---|---|---|---|
| Sprint 1 | Nov 2 – Nov 4, 2026 | Nakul | Dhanraj |
| Sprint 2 | Nov 9 – Nov 12, 2026 | Dhanraj | Nakul |

Nakul owns the GitHub repo, the Vercel project, and the Supabase databases.

## Sprint 1: working deployed MVP

| Owner | Issue | Work | PR |
|---|---|---|---|
| Nakul | #4 | Project structure, Prisma + Supabase setup | #17 |
| Nakul | #7 | Mockups, DESIGN.md, Tailwind theme | #18 |
| Nakul | #9 | Database schema and demo card data | #29 |
| Nakul | #10 | Sign up, log in, log out | #32 |
| Nakul | #11 | Wallet: add, rename, remove cards | #40 |
| Nakul | #33 | Bug fix: squished layout | #36 |
| Nakul | #34 | Bug fix: local API dev server | #38 |
| Nakul | #35 | Bug fix: auth error messages | #41 |
| Nakul | #8 | AGENTS.md updates and v0.5 from the rules test | #15, #16 |
| Dhanraj | #8 | AGENTS.md rules test (with vs. without rules) and trim to under 200 lines | #2 |
| Dhanraj | — | Design documentation update | #3 |
| Dhanraj | #5 | CI pipeline: GitHub Actions, CodeQL, Husky pre-commit, branch protection | #30 |
| Dhanraj | #6 | Deployment on Vercel and `/api/health` | #31 |
| Dhanraj | #12 | Best card by category (integer-cents ranking) | #37 |
| Dhanraj | #13 | Store search with aliases | #39 |
| Dhanraj | #14 | Playwright end-to-end test suite (desktop + mobile) | #44 |
| Dhanraj | #42 | Bug fix: auth rate limit locked out logged-in users (found by #14) | #43 |

## Sprint 2: reminders, trackers, and security

| Owner | Issue | Work | PR |
|---|---|---|---|
| Dhanraj | #19 | Daily reminder job and in-app notifications | #45 |
| Dhanraj | #20 | Payment due reminders | #46 |
| Dhanraj | #24 | Points balances and expiry alerts | #47 |
| Dhanraj | #23 | Rotating bonus categories and quarter activations | #48 |
| Dhanraj | #27 | Security test suite: multi-tenant isolation and card-number rejection across all endpoints | #52 |
| Dhanraj | #54 | Security suite coverage for the #22 endpoints (fixed red `main`) | #55 |
| Nakul | #21 | Perks tracker | #49 |
| Nakul | #22 | Sign-up bonus tracker | #51 |
| Both | #28 | Final docs and demo: architecture and database diagrams (Dhanraj); README, demo video (Nakul) | #53 + Nakul's PR |

## Process work

- **Nakul (Sprint 1 Scrum Master):** ran Sprint 1 planning and the Sprint 1 review, reviewed and merged Dhanraj's PRs, and managed the Vercel and Supabase setup.
- **Dhanraj (Sprint 2 Scrum Master):** created the Sprint 2 issues with estimates and acceptance criteria, ran Sprint 2 planning and async standups in Slack, reviewed Nakul's PRs, ran a full manual QA pass on production (Nov 9, all checks passed), and coordinated the `main` CI fix (#54).

## Not delivered (future work)

| Issue | Owner | Status |
|---|---|---|
| #25 Admin pages and audit log | Nakul | Stretch; PR #56 in review at sprint end |
| #26 Public API with OpenAPI docs | Dhanraj | Stretch; moved to backlog |
| #50 Full E2E coverage and code cleanup | Dhanraj | Moved to backlog |

## Totals (merged PRs as of Nov 14, 2026)

| Person | Merged PRs |
|---|---|
| Dhanraj | 15 |
| Nakul | 12 |
