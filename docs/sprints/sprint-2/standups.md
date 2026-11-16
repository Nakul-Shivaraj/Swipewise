# Sprint 2 — Standups

**Plan (Sprint 2 planning post, Nov 9):** "Standups: async here on Nov 10, 11, 12."

**What happened:** no standups were posted in Slack on Nov 10, 11, or 12. On Nov 9 the Scrum Master posted the sprint plan and a QA report on production (see `planning.md` and `review.md`). After the sprint ended, both partners posted catch-up standups for Nov 14 and Nov 15, on Nov 15 at Nakul's request. They are copied below word for word. The missed in-sprint standups are covered in the Sprint 2 retrospective.

To show what each partner worked on during the sprint days, the next section lists daily progress taken from GitHub. It is not a standup record.

## Daily progress during the sprint (from GitHub)

Dates are Pacific time and show when each PR merged. Every PR was approved by the other partner before it merged, as branch protection requires.

| Day | Dhanraj | Nakul |
|---|---|---|
| Nov 9 | Merged #19 reminder job (PR #45), #20 payment due reminders (PR #46), #24 points expiry alerts (PR #47), #23 rotating categories (PR #48). Ran a QA pass on production. | — |
| Nov 10 | — | Merged #21 perks tracker (PR #49). |
| Nov 11 | No merges. | No merges. |
| Nov 12 | Merged #27 security test suite (PR #52) and #54 security coverage for the #22 endpoints (PR #55), which turned `main` green again. | Merged #22 sign-up bonus tracker (PR #51). |

## After the sprint: catch-up standups (posted Nov 15)

### Nov 14 — Nakul (posted Nov 15, 9:20 PM)

> **Standup: Nov 14**
> **Done:** #22 bonus tracker merged. Moved the backfill into its own migration instead of editing one that had already run. Built #25 admin pages: user roles, the admin:promote script, the audit log, and retiring cards. Merged main into #25 and resolved the security test conflict.
> **Today:** Fix the CodeQL rate-limit alert on admin routes (mount the admin router after the limiter, plus a 429 test), merge #25, then start the #28 README.
> **Blockers:** None.
>
> @Dhanraj Pandya could you post yours for Nov 14 and Nov 15 as a catch-up

### Nov 14 — Dhanraj (posted Nov 15, 9:25 PM)

> **Standup – Nov 14 (Dhanraj, SM)**
> **Done**
> - #54 merged (PR #55): security checks for all 13 #22 endpoints, main CI is green again
> - #28 diagrams merged (PR #53): docs/architecture.md with the architecture + database diagrams
> - #26 public API + OpenAPI docs built after the sprint: PR #58, all checks green
> - Contribution log drafted (docs/contributions.md)
>
> **Today**
> - Get PR #58 reviewed and merged
> - Open the contribution log PR, start the README draft for #28
>
> **Blockers**
> - Need Nakul's review on #58
> - PR #56 (#25): run update-branch, then add admin routes to the security suite
> - Need the final submission date

### Nov 15 — Nakul (posted Nov 15, 9:25 PM)

> **Standup: Nov 15**
> **Done:** #25 merged, and the prod migration and admin role applied. Drafted the #28 README (diagrams, setup, deployment, security, contribution log) and fixed the heading and factual errors CI caught.
> **Today:** #50 public API with Swagger docs at /api/docs, trust proxy so rate limits work per visitor on Vercel, and the CodeQL security-header and CORS fixes.
> **Blockers:** #50 overlaps with the earlier public API from #26. Deciding how to document both.

### Nov 15 — Dhanraj (posted Nov 15, 9:25 PM)

> **Standup – Nov 15 (Dhanraj, SM)**
> **Done**
> - #26 merged (PR #58)
> - Contribution log merged (PR #59)
> - README fixes in PR #62 (draft)
>
> **Today**
> - Sprint 2 review + retro with Nakul
> - Sprint docs (standups, retro) and the demo video link in PR #62
> - Evidence document for the submission
>
> **Blockers**
> - Waiting on Nakul's demo video and the final deadline time
