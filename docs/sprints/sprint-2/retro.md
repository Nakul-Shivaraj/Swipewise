# Sprint 2 — Retrospective

| | |
|---|---|
| **Sprint dates** | Nov 9 – Nov 12, 2026 (planned in Slack on Nov 9; milestone due Nov 12). Docs and stretch work continued to Nov 15 |
| **Goal** | Users get reminded before they lose value (perks, bonuses, rotating categories, payment due dates, points expiry). Deployed by Nov 12 |
| **Result** | Goal met: all five reminder areas were merged, and so deployed, by Nov 12. 10 of 11 milestone issues closed; #28 (final docs and demo) is still open. The stretch issues, #25 (admin) and #26 (public API), were finished on Nov 14 |
| **Scrum Master** | Dhanraj |
| **Product Owner** | Nakul |
| **Retro date** | **TO FILL (both):** the date the retro was actually held |
| **Attendees** | Nakul, Dhanraj |

"What happened" is taken from our issues, PRs, commits, and Slack. Partner feedback is in each partner's own words.

## What happened

- Dhanraj built the daily reminder job and notifications (#19) first, and the other reminder features reused it: payment due dates (#20), points expiry (#24), rotating categories (#23), and perks (#21).
- Nakul built the perks tracker (#21) and the bonus tracker (#22) in the sprint, then admin pages and the audit log (#25) and the public API v1 with Swagger docs (#50) after it.
- **Migration problems:**
  - The agent edited a migration after it had already run on the dev database. We reverted it and moved the change into a new backfill migration.
  - Two migrations ended up with the same timestamp (`20261109030000`). They still work, but new ones now always get a fresh timestamp.
- Production migrations now run automatically on deploy (`vercel-build`), so production no longer needs a manual migration step.
- Production had no demo cards ("No cards found in catalog") until we seeded it.
- Merge conflicts happened several times in shared files (`schema.prisma`, `seed.ts`, `notification.service.ts`, `security.int.test.ts`), since we were both adding features in the same places.
- **`main` went red on Nov 12.** #51 (bonus tracker) and #52 (security suite) merged one minute apart. Each was green on its own, but together the security suite's route-coverage guard failed, because the new bonus-tracker endpoints weren't in its list yet. #54 (PR #55) fixed it that evening.
- **CodeQL alerts:** a missing rate limit on admin routes, Swagger's security headers turned off, and open CORS on the public API. The first two were fixed; the CORS one is intentional and was dismissed with evidence.
- The `admin:promote` script was reported as working but failed the first time we ran it. It was fixed to use `tsx`.
- The agent sometimes ran only some tests instead of the full suite. The full suite now takes about 8 minutes.
- **Two public APIs:** #26 (Dhanraj, PR #58) and #50 (Nakul, PR #60) both exist, because we didn't check the board before starting #50.
- Issue #50 had been the E2E and cleanup card. Reusing it for the public API removed that card from the board; the work is listed as future work in the README.
- Points expiry got its own `/points` page instead of living on the Tracker, as in the mockup.
- **Standups:** the plan called for async standups in Slack on Nov 10, 11, and 12, but none were posted on those days. Catch-up standups for Nov 14 and 15 were posted on Nov 15.
- Some PRs were approved within minutes of being opened.
- #28 and the stretch work ran past the Nov 12 due date.
- **Sprint 1 actions:** the E2E check is still not required in branch protection.

## Went well

- Reusing the reminder job kept every reminder type consistent, with no duplicate reminders.
- Every committed feature in the sprint goal shipped by the due date.
- Security got stronger: rate limits per real visitor IP (`trust proxy`), CSRF everywhere, a transactional audit log, and a strict security policy for the docs page.
- When something went wrong (the migration edit, the broken script, the red `main`), we fixed it properly instead of working around it.
- Automatic production migrations removed our riskiest manual step.

## To improve

- Post the async standup every day, even on busy build days.
- Check the board for existing issues before creating new ones, and never repurpose an issue.
- Review PRs properly: open **Files changed** and check the commits for tests first, migrations, and new libraries.
- Keep shared files (schema, seed, notifications) to one change at a time, merge one PR at a time, and update each branch from `main` before merging.
- Plan sprint scope to fit the dates, or move the date honestly as soon as we know.
- Make the test suite faster.
- Record lessons in AGENTS.md during the sprint, not after.

## Action items

- [ ] Update AGENTS.md to v0.6 with this sprint's lessons (Nakul)
- [ ] Make E2E a required check in branch protection (Nakul)
- [ ] Sprint 2 E2E tests, shared navigation, and removing the duplicate routes (Dhanraj)
- [ ] Keep one public API and one OpenAPI spec (the older endpoints are marked deprecated)
- [ ] Let users set their own time zone (Nakul)
- [ ] Add PR and issue templates (Nakul)

## Partner feedback

**Nakul → Dhanraj**

**TO FILL (Nakul, in his own words):** what Dhanraj did that helped most this sprint, and one thing he could do differently.

**Dhanraj → Nakul**

**TO FILL (Dhanraj, in his own words):** what Nakul did that helped most this sprint, and one thing he could do differently.
