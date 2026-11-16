# Sprint 2 — Review

**Sprint:** Nov 9 – Nov 12, 2026 · **Goal:** users get reminded before they lose value (perks, bonuses, rotating categories, payment due dates, points expiry). Deployed by Nov 12.

> Compiled on Nov 15, 2026 from the "Sprint 2" milestone and the merged pull requests. Close dates are Pacific time.

## Result

**Goal met.** Reminders and tracking for all five areas (perks, sign-up bonuses, rotating categories, payment due dates, points expiry) were merged to `main`, and so deployed to production, by Nov 12. The final docs and demo (#28) did not finish inside the sprint, and neither stretch issue was done by the sprint end.

- **Committed:** 8 issues. 7 were done in the sprint; #28 carried over.
- **Added during the sprint:** #54, done the same day.
- **Stretch:** #25 and #26 were finished after the sprint, on Nov 14.

## Delivered in the sprint

| Issue | Title | Owner | PR | Closed |
|---|---|---|---|---|
| #19 | Daily reminder job and in-app notifications | Dhanraj | #45 | Nov 9 |
| #20 | Send payment due reminders | Dhanraj | #46 | Nov 9 |
| #24 | Add points expiry alerts | Dhanraj | #47 | Nov 9 |
| #23 | Show rotating bonus categories | Dhanraj | #48 | Nov 9 |
| #21 | Build the perks tracker | Nakul | #49 | Nov 10 |
| #22 | Build the sign-up bonus tracker | Nakul | #51 | Nov 12 |
| #27 | Add a security test suite | Dhanraj | #52 | Nov 12 |
| #54 | Security suite: cover #22 bonus tracker endpoints (added Nov 12) | Dhanraj | #55 | Nov 12 |

## Not finished in the sprint

| Issue | Title | Owner | What happened |
|---|---|---|---|
| #28 | Write final docs and record the demo | Nakul (docs shared) | Architecture diagrams, README, and contribution log merged Nov 14–15 |
| #25 | Build admin pages and audit log (stretch) | Nakul | Merged Nov 14 (PR #56) |
| #26 | Build the public API with OpenAPI docs (stretch) | Dhanraj | Merged Nov 14 (PR #58) |
| — | Full E2E coverage for the Sprint 2 flows and code cleanup | Dhanraj | Added to the sprint on Nov 10 as #50, not started; #50 was later reused for the public API v1 (PR #60, Nov 15). Listed as future work. |

## Notes

- **Nov 9 QA pass on production.** The Scrum Master tested the live app with a fresh account: health check, sign up and log in errors, the auth rate limit, wallet, best card values, store search, payment due settings, reminder toggles, points value, phone layout, and the cron endpoint returning `401` without its secret. All checks passed; one polish item was noted (card details table headers in all caps).

- **`main` went red on Nov 12.** #51 (bonus tracker) and #52 (security suite) merged one minute apart. Each was green on its own, but together the security suite's route-coverage guard failed, because the new bonus-tracker endpoints weren't in its route list yet. #54 added them and `main` was green again that evening.
