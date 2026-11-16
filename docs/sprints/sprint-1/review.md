# Sprint 1 — Review

**Sprint:** Oct 29 – Nov 5, 2026 · **Goal:** sign up → add cards → see best card, deployed.

> Compiled on Nov 15, 2026 from the "Sprint 1" milestone and the merged pull requests. Close dates are Pacific time.

## Result

**Goal met.** The app is deployed at https://swipewise-brown.vercel.app, and a new user can sign up, add cards from the demo catalog, search a store or pick a category, and see their best card. Every issue in the milestone is closed, with none left open.

- **Planned:** 11 issues, all completed.
- **Added during the sprint:** 4 bugs, all fixed.

## Delivered

| Issue | Title | Owner | PR | Closed |
|---|---|---|---|---|
| #4 | Set up project structure | Nakul | #17 | Oct 30 |
| #7 | Add mockups and DESIGN.md | Nakul | #18 | Oct 30 |
| #8 | Write AGENTS.md and templates | Dhanraj | #2, #15, #16 | Oct 30 |
| #9 | Create database schema and demo card data | Nakul | #29 | Oct 30 |
| #5 | Set up CI pipeline (GitHub Actions, CodeQL, Husky, branch protection) | Dhanraj | #30 | Oct 30 |
| #6 | Deploy the empty starter on Vercel with `/api/health` | Dhanraj | #31 | Nov 2 |
| #10 | Build sign up, log in, and log out | Nakul | #32 | Nov 2 |
| #12 | Show best card by category | Dhanraj | #37 | Nov 2 |
| #33 | Fix squished layout on sign up and wallet pages | Nakul | #36 | Nov 3 |
| #34 | Fix local API dev server | Nakul | #38 | Nov 3 |
| #11 | Build wallet: add, rename, and remove cards | Nakul | #40 | Nov 3 |
| #13 | Add store search | Dhanraj | #39 | Nov 3 |
| #35 | Show the right error message on log in and sign up | Nakul | #41 | Nov 3 |
| #42 | Auth rate limit counts /me and logout | Dhanraj | #43 | Nov 3 |
| #14 | Add end-to-end test for the Sprint 1 flow | Dhanraj | #44 | Nov 4 |

## Notes

- The end-to-end suite (#14) found a real bug before release: the strict auth rate limit also counted `/me` and logout, which could lock out logged-in users. It was fixed in #42 the same day.
