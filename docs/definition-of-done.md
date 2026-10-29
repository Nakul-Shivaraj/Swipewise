# Definition of Done

Linked from `AGENTS.md` §15. An issue moves to **Done** only when all of these are true:

- [ ] Every acceptance criterion in the issue is checked off.
- [ ] The failing test was committed before the code, and tests map to the story's ACs.
- [ ] Tests pass locally and in CI; `domain/` coverage stays at or above 90%.
- [ ] `npm run lint`, `npm run format`, and `npm run typecheck` are clean.
- [ ] New views have loading, empty, and error states, work by keyboard, and match the mockup in
      browser mode.
- [ ] New or changed endpoints are documented in `docs/api/openapi.yaml`.
- [ ] Docs updated if behavior changed (README, architecture, sprint notes).
- [ ] The PR is approved by the partner, CI is green, it's merged, and the issue is closed.
