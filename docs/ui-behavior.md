# UI Behavior

How every screen should behave. Follow this together with `DESIGN.md` (look) and `docs/PRD.md` (requirements). Mockups: `docs/design/mockup.png` (mobile) and `docs/design/mockup-desktop.png` (laptop).

## Mobile vs website at a glance

| | Mobile (under 768px) | Website (1200px and up) |
|---|---|---|
| Navigation | Floating glass tab bar at the bottom | Sticky glass top bar with text links |
| Results on Home | Bottom sheet slides up | Shown on the page below the search |
| Wallet | Stacked cards | 4-column grid plus a details table |
| Tracker | Widget tiles | Stats row plus a "Coming up" table |
| Add and edit | Bottom sheet | Centered dialog |
| Footer | None | On every page |

Tablets (768–1199px) use the website top bar with a single-column layout.

## Global rules

- **App shell:** mobile first. Warm green background with blurred blobs behind glass.
  - Under 768px: floating tab bar at the bottom.
  - 768–1199px: the desktop top bar, with content in one column.
  - 1200px and up: a normal website. Sticky glass top bar with logo, text links (Home, Wallet, Tracker, Alerts), the alerts bell, and the profile menu (Settings, Log out). A footer on every page. No tab bar, sidebar, or bottom sheets.
- **Navigation:** Home, Wallet, Tracker, Alerts on all logged-in screens, hidden on sign up and log in.
- **Keyboard (website):** `/` focuses the store search, `Esc` closes any sheet or dialog, and Tab moves through items in order.
- **Auth guard:** logged-out users who open any app screen go to Log in, then return to where they were.
- **States:** every screen that loads data shows a loading state (glass skeleton rows), an empty state (short message and one action), and an error state ("Something went wrong. Try again." with a Retry button).
- **Money:** always `$0.00` format with two decimals.
- **No card numbers:** any field that receives something that looks like a card number shows "Don't enter card numbers. SwipeWise only needs the card name."
- **Accessibility:** every input has a visible label; errors are announced (`aria-live="polite"`) and linked to the field (`aria-describedby`); every action works with the keyboard and has a visible focus ring; icon-only buttons have `aria-label`; tap targets are at least 44px.
- **Motion:** sheets slide up in 250ms and the best card highlight fades in. With `prefers-reduced-motion`, there is no sliding, only an instant change. With `prefers-reduced-transparency`, glass becomes solid white.

## 1. Sign up (`/signup`)

**Fields (one glass group):** Name, Email, Password, Confirm password.

**Validation:** shown when a field loses focus, and for all fields on submit.
- Name: required, 1–60 characters → "Enter your name."
- Email: required, valid format → "Enter a valid email address."
- Password: at least 8 characters and 1 number → "Use 8 or more characters with at least one number."
- Confirm password: must match → "Passwords don't match."

**Strength bar:** 4 segments under Password that update as the user types, with helper text ("Weak", "Okay", "Strong password").

**Create account button:**
- Disabled while submitting, with a spinner and "Creating account…"
- Pressing Enter in any field submits the form.

**On success:** the server sets an httpOnly auth cookie, and the user goes to **Wallet** with an empty state: "Add your first card to get started."

**On error:**
- Email already used → "An account with this email already exists. Log in instead?" with a link.
- Too many attempts → "Too many tries. Wait a minute and try again."
- Server error → "Something went wrong. Try again."

**Other:** "Have an account? Log in" link; footer "We never ask for card numbers."

**Website:** the top bar shows only the logo and "Have an account? Log in." The page has two columns: the headline "Every swipe, the right card.", a short line, three feature points, and floating demo card art on the left, and the glass form card (440px) on the right. The form behaves exactly the same as on mobile.

## 2. Log in (`/login`)

- Same layout as Sign up, with Email and Password only.
- Wrong email or password always shows "Email or password is incorrect." Never say which one.
- On success: go to Home, or to the page the user was trying to open.
- Log out (mobile: Wallet → Settings; website: profile menu) clears the cookie and returns to Log in.

## 3. Home (`/`)

- **Large title** "Pay smarter."
- **Search pill:** type a store. Suggestions appear after 2 characters (debounced 250ms). Picking a store selects its category.
- **Category icons:** Groceries, Dining, Gas, Travel. Tapping one selects it (white ring around the icon).
- **Bottom sheet:** after a store or category is chosen, it slides up with "Your cards at [store or category]," ranked from highest reward to lowest, based on $100 by default.
  - The top row uses the best-row style with a "Best pick" label, the rate, and the dollar amount.
  - Ties follow the PRD: lower annual fee first, then name A–Z.
- **Store not found:** "We don't know this store yet. Pick a category." Category icons stay usable.
- **Empty wallet:** the sheet shows "Add cards to see your best pick" with a button to Wallet.
- **Website:** a centered hero: "Which card should you use?", a wide search bar, and category pills under it. Results appear right below on the same page (no sheet): the best card's art and amount on the left, and a table "All your cards at [store]" on the right with card, rate, and amount. Before anything is picked, the results area says "Search a store or pick a category."

## 4. Wallet (`/wallet`)

- **Large title** "Wallet" with a round glass + button (label "Add card").
- **Cards** show as a stack with the newest on top. Tapping a card expands it with nickname, payment due day, autopay, Edit, and Remove.
- **Add card** opens a sheet: search the catalog, pick a card, then optional nickname and open date. Save adds it to the top of the stack.
- **Remove** asks "Remove [card name] from your wallet?" with Cancel and Remove.
- **Website:** page heading "Your wallet" with an "Add card" button on the right. Cards show in a 4-column grid, with a dashed "Add a card" tile at the end and the nickname and due day under each card. A "Card details" table below lists annual fee, autopay, best category, and Edit. Add and Edit open a centered dialog instead of a sheet.

## 5. Tracker (`/tracker`) — Sprint 2

- Large title "Tracker" with "This month" above it.
- Widgets: Rewards earned, Sign-up bonus (progress ring with amount left and days left), Perks (amount left and days left), and Payment due.
- Tapping a widget opens its detail screen.
- **Website:** page heading "Your month so far." A row of big stats split by thin dividers (rewards earned with a small bar chart, bonus progress bar, perks left), then a "Coming up" table with due dates, perks, points, and activations, sorted soonest first.

## 6. Alerts (`/alerts`) — Sprint 2

- A list of in-app reminders, newest first. Unread items have a green dot.
- Tapping marks one as read. A "Mark all read" button sits at the top.
