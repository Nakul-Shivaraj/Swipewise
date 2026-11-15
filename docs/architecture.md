# SwipeWise architecture

## System architecture

```mermaid
flowchart LR
    user["User<br/>phone or laptop browser"]

    subgraph vercel["Vercel (one project, one domain)"]
        web["Web app<br/>React + Vite + Tailwind<br/>apps/web, served at /"]
        api["API<br/>Express 5 function<br/>apps/api, served at /api"]
        cron["Vercel Cron<br/>daily at 09:00 UTC"]
    end

    shared["packages/shared<br/>zod schemas + money utils"]

    subgraph supabase["Supabase Postgres"]
        prod[("Swipewise-prod<br/>production")]
        dev[("Swipewise-dev<br/>previews + local dev")]
    end

    subgraph github["GitHub"]
        repo["Repo + pull requests<br/>main is protected"]
        ci["GitHub Actions<br/>lint, typecheck, tests, build, audit<br/>CodeQL, Playwright E2E"]
    end

    user -- "HTTPS" --> web
    web -- "/api/v1, httpOnly cookie + CSRF" --> api
    cron -- "GET /api/v1/cron/reminders + CRON_SECRET" --> api
    api -- "Prisma 7 + pg adapter, pooled port 6543" --> prod
    api -. "PR preview deployments" .-> dev
    repo -- "every PR and push to main" --> ci
    repo -- "main to production, PR to preview" --> web
    shared -.-> web
    shared -.-> api
```

**Key decisions**

- **One Vercel project, one domain.** The website is served at `/` and the Express API at `/api`, so the login cookie (httpOnly, Secure, SameSite=Lax) works without cross-site setup.
- **Two databases.** Production uses Swipewise-prod. Every PR preview and local development use Swipewise-dev, so a test PR can never touch real data.
- **Migrations.** Production runs `prisma migrate deploy` only when `main` deploys. Previews never migrate. Dev migrations are applied by hand after pinging the partner.
- **Server-side rules.** All rewards math and date rules run on the API, in whole cents, in the user's time zone. Shared zod schemas validate the same input on the web and the API.
- **Reminders.** Vercel Cron calls the reminder job once a day. Each reminder type is a generator in one registry, and a unique dedupe key per reminder makes re-runs safe.
- **Quality gates.** Every PR runs lint, typecheck, unit and integration tests, build, a production `npm audit`, CodeQL, and Playwright end-to-end tests against a temporary Postgres. `main` requires a PR, one approval, and green checks.

## Database

All tables also have `created_at` and `updated_at`. Money is stored as whole cents (`*_cents`), and rates as `rate_x100` (points per dollar × 100).

### Card catalog

```mermaid
erDiagram
    REWARDS_PROGRAMS ||--o{ CARDS : "earns in"
    CARDS ||--o{ REWARD_RULES : "has"
    CARDS ||--o{ ROTATING_CATEGORIES : "has"
    CARDS ||--o{ PERKS : "offers"
    CARDS ||--o| BONUS_OFFERS : "has"
    STORES ||--o{ STORE_ALIASES : "also known as"

    REWARDS_PROGRAMS {
        string id PK
        string name UK
        int cents_per_100_points
    }
    CARDS {
        string id PK
        string name UK
        string issuer
        string program_id FK
        int annual_fee_cents
        int base_rate_x100
        boolean is_demo
        boolean is_retired
    }
    REWARD_RULES {
        string id PK
        string card_id FK
        enum category
        int rate_x100
        int cap_cents
    }
    ROTATING_CATEGORIES {
        string id PK
        string card_id FK
        string quarter
        enum category
        int rate_x100
        int cap_cents
    }
    PERKS {
        string id PK
        string card_id FK
        string name
        int amount_cents
        enum period
    }
    BONUS_OFFERS {
        string id PK
        string card_id FK
        int spend_requirement_cents
        int window_months
        int bonus_points
    }
    STORES {
        string id PK
        string name UK
        enum category
    }
    STORE_ALIASES {
        string id PK
        string store_id FK
        string alias
    }
```

### User data

```mermaid
erDiagram
    USERS ||--o{ WALLET_CARDS : "owns"
    CARDS ||--o{ WALLET_CARDS : "added as"
    WALLET_CARDS ||--o| WALLET_CARD_PAYMENT_SETTINGS : "has"
    WALLET_CARDS ||--o{ WALLET_CARD_PAID_CYCLES : "has"
    WALLET_CARDS ||--o{ WALLET_CARD_QUARTER_ACTIVATIONS : "has"
    WALLET_CARDS ||--o{ PERK_USAGES : "tracks"
    PERKS ||--o{ PERK_USAGES : "used in"
    WALLET_CARDS ||--o| WALLET_CARD_BONUS_OFFERS : "has snapshot"
    WALLET_CARDS ||--o{ SPEND_ENTRIES : "logs"
    WALLET_CARD_BONUS_OFFERS ||--o{ SPEND_ENTRIES : "counts toward"
    USERS ||--o{ PROGRAM_BALANCES : "holds"
    REWARDS_PROGRAMS ||--o{ PROGRAM_BALANCES : "values"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ NOTIFICATION_PREFERENCES : "sets"

    USERS {
        string id PK
        string email UK
        string password_hash
        string name
        string time_zone
    }
    WALLET_CARDS {
        string id PK
        string user_id FK
        string card_id FK
        string nickname
        date opened_date
    }
    WALLET_CARD_PAYMENT_SETTINGS {
        string id PK
        string wallet_card_id FK
        int due_day
        boolean is_autopay
    }
    WALLET_CARD_PAID_CYCLES {
        string id PK
        string wallet_card_id FK
        string cycle_year_month
        datetime paid_at
    }
    WALLET_CARD_QUARTER_ACTIVATIONS {
        string id PK
        string wallet_card_id FK
        string quarter
        datetime activated_at
    }
    PERK_USAGES {
        string id PK
        string wallet_card_id FK
        string perk_id FK
        string period_key
        int used_cents
    }
    WALLET_CARD_BONUS_OFFERS {
        string id PK
        string wallet_card_id FK
        int spend_requirement_cents
        int window_months
        int bonus_points
    }
    SPEND_ENTRIES {
        string id PK
        string wallet_card_id FK
        string wallet_card_bonus_offer_id FK
        int amount_cents
        date date
        string note
    }
    PROGRAM_BALANCES {
        string id PK
        string user_id FK
        string program_id FK
        int points_balance
        date expiry_date
    }
    NOTIFICATIONS {
        string id PK
        string user_id FK
        enum type
        string title
        date due_date
        string dedupe_key UK
        datetime dismissed_at
    }
    NOTIFICATION_PREFERENCES {
        string id PK
        string user_id FK
        enum type
        boolean enabled
    }
    CARDS {
        string id PK
    }
    PERKS {
        string id PK
    }
    REWARDS_PROGRAMS {
        string id PK
    }
```

**Notes**

- Deleting a user removes their wallet and all user data (cascade). A catalog card can't be deleted while it's in someone's wallet (restrict); it's retired instead.
- Unique keys stop duplicates: one reward rule per card and category, one activation per wallet card and quarter, one paid cycle per wallet card and month, one perk usage per wallet card, perk, and period, one balance per user and program, and one notification per dedupe key.
- `wallet_card_bonus_offers` is a copy of the card's bonus offer taken when the card is added, so later catalog changes don't change a user's deadline.
- `rate_limits` (key, total_hits, reset_time) stores login rate-limit counts in Postgres, because Vercel functions don't share memory. It isn't linked to other tables.
