# Dependencies

Linked from `AGENTS.md` §3. Everything below is pre-approved: install it without asking.
Anything not listed needs both partners' OK first. Add new approvals here in the same PR.

## Core (scaffold)

- **Web:** `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`,
  `@tailwindcss/vite`
- **API:** `express`, `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `tsx` (dev runner)
- **Repo:** `concurrently` (runs web + api with `npm run dev`)
- **Types:** any `@types/*` package for a library on this list

## Preferred libraries

- **Shared:** `zod`, `luxon`
- **API:** `argon2`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `cookie-parser`, `cors`, `pino`,
  `pino-http`, `@asteasolutions/zod-to-openapi`
- **Web:** `react-router`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`,
  `@radix-ui/*` primitives, `lucide-react`, `clsx`
- **Testing:** `vitest`, `@vitest/coverage-v8`, `supertest`, `@testing-library/react`,
  `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`,
  `msw` (web tests only)
- **Tooling:** `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-config-prettier`,
  `prettier`, `husky`, `lint-staged`, `@google/design.md` (dev)

## Avoid

- `moment`, and `dayjs` without its timezone plugin: use Luxon.
- `lodash`: use the standard library.
- `axios`: use `fetch`.
- `bcrypt`: use `argon2`.
- Component kits (MUI, Chakra, Bootstrap): they fight the `DESIGN.md` tokens.
