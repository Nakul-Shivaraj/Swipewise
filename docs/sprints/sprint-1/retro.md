# Sprint 1 — Retrospective

| | |
|---|---|
| **Sprint dates** | Oct 29 – Nov 5, 2026 |
| **Goal** | Sign up → add cards → see best card, deployed |
| **Result** | Goal met. Every issue in the milestone closed, including 4 bugs found during the sprint |
| **Scrum Master** | Nakul |
| **Product Owner** | Dhanraj |
| **Retro date** | Not recorded. The action items were recorded in the Sprint 2 planning post in Slack on Nov 9 |
| **Attendees** | Nakul, Dhanraj |

"What happened" is taken from our issues, PRs, commits, and Slack. The action items are copied from where they were recorded at the time: the Sprint 2 planning post in Slack (Nov 9). Partner feedback is in each partner's own words.

## What happened

- We split the work by feature, not by frontend and backend: Nakul took setup, schema, auth, and wallet (#4, #7, #9, #10, #11); Dhanraj took CI, deploy, best card, store search, and E2E (#5, #6, #12, #13, #14).
- We deployed to Vercel with PR previews, plus one Supabase database for dev and previews and another for production.
- #10 (auth) was blocked waiting for the shared Prisma client from #6. The agent first built its own client, which we replaced after #6 merged. That caused merge conflicts in 4 files.
- CodeQL flagged missing rate limiting and then missing CSRF protection. We added a Postgres-backed rate limiter and double-submit CSRF, with tests proving both, before dismissing anything.
- CI had no database, so integration tests failed. We added a temporary Postgres service to CI.
- The E2E suite (#14) found a real bug: the auth rate limit was locking out logged-in users (#42).
- Bugs found and fixed: squished layout from design tokens (#33), local API dev server not starting (#34), and the wrong error messages on log in (#35).
- One small fix was pushed straight to `main` without a PR (`35a1e52`).
- Estimates on the board were entered in mixed units: the board adds up to 12.5 instead of the 34 story points we planned.
- Windows setup slowed us down: Node.js wasn't installed at first, and the `design.md` CLI opened VS Code instead of running.

## Went well

- Writing failing tests first worked. Most features have a `test(...)` commit before the `feat(...)` commit.
- AGENTS.md (tested in HW3) clearly improved what the AI built: the right stack, the design, and tests.
- Checking security alerts properly instead of dismissing them made the app safer.
- Small, single-issue PRs with partner review kept `main` working.

## To improve

- Read the AI's report against the actual diff. Once it claimed a dependency that wasn't there, and once it ran only some of the tests.
- Agree on shared pieces (the database client, the schema) before building on top of them.
- Turn off branch-protection bypass so nobody can push to `main` directly.
- Use one estimate unit (story points) for every card.

## Action items for Sprint 2

As recorded in the Sprint 2 planning post in Slack (Nov 9):

> Retro actions: E2E becomes required, no bypassing branch protection, every PR says "Closes #N", Supabase access for Dhanraj

The same post also set the database rule: one migration per PR, merge one at a time, and ping before applying anything to dev. How each action turned out is in the Sprint 2 retrospective.

## Partner feedback

**Nakul → Dhanraj**

Dhanraj set up our CI pipeline and branch protection on day two (lint, typecheck, tests, build, audit, CodeQL, and a pre-commit hook), so every PR after that was checked automatically. He deployed the app on Vercel with PR previews and a health check, built best card and store search, and wrote the E2E suite, which caught a real bug before release: the auth rate limit was locking out logged-in users. He also created the Sprint 2 issues with acceptance criteria. One thing to do differently: set up the local database so integration and E2E tests run before pushing, instead of finding failures only in CI.

**Dhanraj → Nakul**

Nakul got the foundation in place fast: project structure, Supabase, the Prisma schema, and demo data. His Oct 30 update gave me the database setup steps and my next cards, so I could start deploy (#6) and best card (#12) without waiting. He also ran the planning meeting and posted the minutes the same day. One thing to do differently: send every change through a PR, even small fixes (one went straight to `main`), and post standups on the day instead of catching up two at once.
