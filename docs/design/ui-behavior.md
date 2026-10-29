# UI behavior: screens, components, flows

Linked from `AGENTS.md` §9. Colors, type, and spacing come only from `DESIGN.md`; this file covers
behavior. **Draft:** check it against the PRD stories and the chosen mockup, and rewrite it once
the design is picked.

## Screens

1. **Card Helper** (home): store search, category chips, optional amount, ranked list of the user's
   cards with the top pick highlighted.
2. **Wallet:** the user's cards; "Add card" opens a catalog search.
3. **Card detail:** reward rules, current and next quarter's rotating categories, perks, bonus,
   payment settings, "last verified" date.
4. **Tracking:** Perks, Bonuses, Points, Payments.
5. **Alerts:** in-app notifications with an unread badge.
6. **Settings:** time zone, reminder toggles and timings, export my data, delete my account.
7. **Admin:** catalog management (programs, cards, reward rules, perks, offers, stores). No review
   queues; those are non-goals.

## Components

- **StoreSearch:** debounced, case-insensitive, tolerates small typos, matches aliases. No match →
  "Pick a category." A store in several categories asks which one.
- **CategoryChips:** single select; arrow keys move between chips.
- **AmountInput:** optional; accepts `12`, `12.5`, `12.50`; converts with `parseDollarsToCents`.
- **RecommendationList:** renders the API ranking as-is: dollar value, rate used, and notes from the
  API ("Assuming full cap is available," "Activate to earn 5%," "Cap reached"). Announced with
  `aria-live`.
- **CardTile:** card name, nickname, "Demo" badge for seeded cards, "No longer updated" badge for
  retired cards, last verified date.
- **PerkRow:** used / left this period; "Mark used" for a full or partial amount.
- **BonusProgress:** progress bar, amount left, days left, average needed per day, status (In progress
  / Earned / Missed) as text plus icon.
- **PaymentDueRow:** next due date, autopay badge, "Mark paid" for the current cycle.
- **PointsBalanceRow:** balance, dollar value, expiry date or "No expiry."
- **Disclaimer:** "Not financial advice. Not affiliated with any card issuer. Card terms can change."
  Shown under recommendations and in the footer.
- Every data view: skeleton while loading, an empty state with one clear action, an error state with retry.

## Flows

1. **Onboarding:** register → time zone pre-filled from the browser → add first card → Card Helper.
2. **At checkout:** open app → type a store → category resolved → optional amount → ranked list; the
   top pick is visible without scrolling on a phone.
3. **Add a card:** search catalog → pick → optional nickname, opened date, due day, autopay → saved;
   bonus offer snapshot copied.
4. **Use a perk:** Tracking → Perks → "Mark used" → amount left updates.
5. **Payment:** reminder in Alerts → card → "Mark paid" → that cycle's remaining reminders stop.
6. **Admin edit:** edit a catalog item → save → users see the change.
