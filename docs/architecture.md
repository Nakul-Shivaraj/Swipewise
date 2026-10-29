# Architecture

Linked from `AGENTS.md` §5. Update this file in the same PR as any structural change.

## Repository layout

```text
swipewise/
├── AGENTS.md                 # shared AI rules (every tool reads it)
├── CLAUDE.md                 # only "@AGENTS.md"
├── DESIGN.md                 # UI tokens and rules
├── README.md
├── .env.example              # variable names only, never values
├── .husky/pre-commit         # lint + format via lint-staged
├── .github/
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── apps/
│   ├── web/src/
│   │   ├── app/              # router, providers, app shell, navigation
│   │   ├── features/         # one folder per feature (wallet/, helper/, perks/, bonuses/,
│   │   │                     #   payments/, points/, notifications/, settings/, admin/),
│   │   │                     #   each with components/, hooks/, api.ts, *.test.tsx
│   │   ├── components/ui/    # shared presentational components
│   │   └── lib/              # api client, formatCents, query keys
│   └── api/
│       ├── prisma/           # schema.prisma, migrations/, seed.ts
│       ├── src/
│       │   ├── domain/       # PURE logic, 90% coverage: rewards/, dates/
│       │   ├── modules/      # per resource: <name>.routes|controller|service|repo|schemas.ts
│       │   ├── jobs/         # daily reminder job
│       │   ├── middleware/   # requireAuth, requireAdmin, validate, errorHandler, rateLimit
│       │   └── config/       # env.ts (Zod-validated), logger.ts (pino with redaction)
│       └── test/
│           ├── integration/  # *.int.test.ts, Supertest against the test database
│           └── factories/    # named test-data builders (demoGroceryPlus(), …)
├── packages/shared/          # Zod schemas, inferred types, money and Luhn helpers
├── e2e/                      # Playwright specs
└── docs/
    ├── PRD.md                # user stories US-xx, ACs, non-goals
    ├── architecture.md       # this file
    ├── dependencies.md
    ├── definition-of-done.md
    ├── api/openapi.yaml
    ├── design/               # mockups, ui-behavior.md
    ├── decisions/            # one file per big choice, open-assumptions.md
    └── sprints/sprint-N/     # planning.md, standups.md, retro.md
```

## Patterns

- **Layers:** routes → controller (parse with Zod, shape the response) → service (use-case logic,
  permissions) → `domain/` (pure functions) + repo (the only files that import Prisma).
- **Server is the source of truth** for reward math, statuses, and permissions.
- **Pure domain:** `domain/` takes time as an argument (`{ now, timeZone }`), so quarter, month-end,
  and time-zone boundaries are testable.
- **Ownership:** repo helpers always filter by `userId`. Another user's record returns 404, not 403,
  so IDs can't be probed.
- **Idempotent reminders:** each reminder has a unique `dedupeKey`
  (`<type>:<targetId>:<cycle>:<offsetDays>`). The daily job creates every reminder whose send date
  is today or earlier and doesn't exist yet (`createMany({ skipDuplicates: true })`). Running twice
  adds nothing; a skipped day is caught up on the next run.
- **Offer snapshot:** when a user adds a card with a sign-up bonus, the offer is copied onto the
  wallet card. Later catalog edits never change it.
- **Retire, never delete** catalog cards that users hold; they show "No longer updated."
- **API shape:** REST under `/api/v1`, plural kebab-case resources. Errors are
  `{ "error": { "code": "NOT_FOUND", "message": "…" } }`. Status codes: 400 validation,
  401 not logged in, 403 not an admin, 404 missing or not yours, 409 conflict, 429 rate limited.
- **Config:** `config/env.ts` validates every variable at startup; the server refuses to start if
  one is missing.
