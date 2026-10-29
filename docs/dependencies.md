# Dependencies

What SwipeWise uses, and what to avoid. AI agents must pick from this list. Adding anything new needs a PR that updates this file first.

One responsive web app serves both the mobile and website versions (no separate native app). Layout changes by screen size use Tailwind breakpoints only.

## Version rules

- **Node.js:** current LTS (22 or newer).
- Install the latest stable version of each package at setup, then pin exact versions (no `^` or `~`) and commit `package-lock.json`.
- Don't install a version published in the last 14 days.
- Major upgrades go in their own PR.

## Repo layout

npm workspaces: `apps/web` (frontend), `apps/api` (backend), `packages/shared` (shared types and Zod schemas).

## Frontend (`apps/web`)

| Package | Use it for |
|---|---|
| react, react-dom (19) | UI |
| vite, @vitejs/plugin-react | Dev server and build |
| typescript | Types everywhere |
| tailwindcss (4) | Styling; theme generated from DESIGN.md |
| react-router | Pages and navigation |
| @tanstack/react-query | Loading and caching API data |
| react-hook-form, @hookform/resolvers | Forms, with Zod validation |
| zod | Validation (shared schemas) |
| lucide-react | Line glyphs inside the liquid icons and tab bar |
| @fontsource-variable/inter | Inter fallback font (SF Pro is used on Apple devices) |

## Backend (`apps/api`)

| Package | Use it for |
|---|---|
| express (5) | HTTP server |
| prisma, @prisma/client | Database access and migrations (PostgreSQL) |
| zod | Request and env validation |
| argon2 | Password hashing |
| jose | Signing and checking JWTs |
| cookie-parser | Reading the auth cookie |
| helmet | Security headers |
| cors | Allow only our frontend origin |
| express-rate-limit | Rate limiting, especially auth routes |
| pino, pino-http | Logging, with passwords and tokens redacted |
| date-fns, @date-fns/tz | All date, period, and time-zone logic |
| @asteasolutions/zod-to-openapi, swagger-ui-express | OpenAPI docs from Zod schemas |
| node-cron | Daily reminder job (Sprint 2; may be replaced by the host's scheduler) |

## Testing

| Package | Use it for |
|---|---|
| vitest, @vitest/coverage-v8 | Unit and integration tests, coverage |
| @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom | Component tests |
| supertest | API route tests |
| msw | Faking API responses in frontend tests |
| @playwright/test | End-to-end tests |

## Tooling

| Package | Use it for |
|---|---|
| eslint, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y | Linting, including accessibility |
| prettier | Formatting |
| husky, lint-staged | Pre-commit lint and format |
| tsx | Running the TypeScript server in dev |
| @google/design.md | `npx @google/design.md lint DESIGN.md` |

## Avoid

- **UI kits** (MUI, Chakra, Bootstrap, shadcn themes): they fight our DESIGN.md look.
- **axios:** use `fetch`.
- **moment.js:** use date-fns.
- **bcrypt (native) and crypto-js:** use argon2.
- **jsonwebtoken:** use jose.
- **Storing tokens in localStorage:** use an httpOnly cookie.
- **Floating-point money or money libraries:** store whole cents as integers.
- **Any payment, bank, or card-number SDK** (Stripe, Plaid) in v1.
- **CSS-in-JS libraries** (styled-components, Emotion): use Tailwind.
