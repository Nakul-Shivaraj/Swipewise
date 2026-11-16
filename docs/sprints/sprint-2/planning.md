# Sprint 2 — Planning

**Dates:** Nov 9 – Nov 12, 2026 (GitHub milestone "Sprint 2", due Nov 12)
**Scrum Master:** Dhanraj · **Product Owner:** Nakul
**Planning:** Nov 9, 2026. Dhanraj posted the plan below in Slack at 2:21 PM. The Sprint 2 issues (#19–#28) had been created by Dhanraj on Oct 30, each linked to its user story in `docs/PRD.md`.

## Sprint goal

Users get reminded before they lose value (perks, bonuses, rotating categories, payment due dates, points expiry). Deployed by Nov 12.

## The plan, as posted in Slack

> **Sprint 2 Planning – Nov 9**
> Roles: Dhanraj = Scrum Master, Nakul = Product Owner
> Goal: users get reminded before they lose value (perks, bonuses, rotating categories, payment due dates, points expiry). Deployed by Nov 12.
> Order: #19 first (other reminders depend on it). #22, #25, #26 can start in parallel.
> Owners: Dhanraj #19, #20, #23, #24, #26, #27 · Nakul #21, #22, #25, #28
> Stretch (moved to backlog if behind on Nov 11): #25, #26
> Database: one migration per PR, merge one at a time, ping before applying to dev
> Standups: async here on Nov 10, 11, 12
> Retro actions: E2E becomes required, no bypassing branch protection, every PR says "Closes #N", Supabase access for Dhanraj

The retro actions are the action items from the Sprint 1 retrospective (see `../sprint-1/retro.md`).

## Committed issues

| Issue | Story | Title | Board estimate | Owner |
|---|---|---|---|---|
| #19 | US-05, US-09 | Daily reminder job and in-app notifications | 2 | Dhanraj |
| #20 | US-08 | Send payment due reminders | 1 | Dhanraj |
| #23 | US-05 | Show rotating bonus categories | 1 | Dhanraj |
| #24 | US-09 | Add points expiry alerts | 1 | Dhanraj |
| #27 | US-01, US-02 | Add a security test suite | 1 | Dhanraj |
| #21 | US-06 | Build the perks tracker | 2 | Nakul |
| #22 | US-07 | Build the sign-up bonus tracker | 2 | Nakul |
| #28 | — | Write final docs and record the demo | 1 | Nakul |

**Committed:** 8 issues, with board estimates adding up to 11 (Dhanraj 6, Nakul 5).

## Stretch issues

| Issue | Story | Title | Board estimate | Owner |
|---|---|---|---|---|
| #25 | US-10 | Build admin pages and audit log | 2 | Nakul |
| #26 | US-11 | Build the public API with OpenAPI docs | 1 | Dhanraj |

**Stretch:** 2 issues, with board estimates adding up to 3.
