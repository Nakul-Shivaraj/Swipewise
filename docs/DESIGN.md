---
version: alpha
name: SwipeWise
description: iOS-style Liquid Glass on a warm light green background. Frosted panels, glossy category icons, and one green action per screen.
colors:
  primary: "#2F7D4F"
  primary-pressed: "#256640"
  primary-tint: "#D6E8D9"
  on-primary: "#FFFFFF"
  background: "#E7EED8"
  background-deep: "#DCE6CB"
  glass: "#FFFFFF"
  ink: "#1C2A1E"
  ink-muted: "#5D6B5B"
  error: "#B3261E"
  cat-groceries: "#2F8C55"
  cat-dining: "#E9772E"
  cat-gas: "#2F74D0"
  cat-travel: "#7454CF"
typography:
  large-title:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  title:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.45
  callout:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.3
  amount:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "'tnum'"
  amount-hero:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
rounded:
  sm: 9px
  md: 16px
  lg: 22px
  xl: 34px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  page-gradient-end:
    backgroundColor: "{colors.background-deep}"
    textColor: "{colors.ink}"
  glass-panel:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 12px
  glass-row:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 44px
  search-pill:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    height: 38px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.full}"
    height: 50px
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  tab-bar:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    height: 62px
  tab-active:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
  bottom-sheet:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 16px
  top-nav:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    height: 64px
  top-nav-active:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
  footer:
    backgroundColor: "{colors.background-deep}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.callout}"
    height: 46px
  best-row:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 10px
  badge:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
  helper-text:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.callout}"
  error-text:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.error}"
    typography: "{typography.callout}"
  icon-groceries:
    backgroundColor: "{colors.cat-groceries}"
    rounded: "{rounded.md}"
    size: 52px
  icon-dining:
    backgroundColor: "{colors.cat-dining}"
    rounded: "{rounded.md}"
    size: 52px
  icon-gas:
    backgroundColor: "{colors.cat-gas}"
    rounded: "{rounded.md}"
    size: 52px
  icon-travel:
    backgroundColor: "{colors.cat-travel}"
    rounded: "{rounded.md}"
    size: 52px
---

## Overview

SwipeWise is one responsive web app with two faces:

- **Mobile:** looks and feels like a native iOS app in Apple's Liquid Glass style, with frosted panels, glossy liquid icons, a floating tab bar, and bottom sheets.
- **Website (laptop and desktop):** a normal website with a glass top bar, open page layouts, tables, and a footer, using the same colors, glass, and icons.

Both use a warm light green background with soft color blobs behind the glass. People often open it at the checkout counter, so the answer ("use this card") must be readable in one second.

Mockups (Sign up, Home, Wallet, Tracker):
- Mobile: `docs/design/mockup.png` (source `mockup.html`)
- Desktop/laptop: `docs/design/mockup-desktop.png` (source `mockup-desktop.html`)

## Colors

- **Background:** warm light green (#E7EED8) fading to #DCE6CB, with 2–3 large blurred blobs in sage, butter, and mint behind the content so the glass has something to show through.
- **Glass:** white at about 46% opacity with a 22px background blur, 180% saturation, a 1px white rim at 80% opacity, and a soft green-tinted shadow. Bottom sheets use about 58% opacity.
- **Primary (#2F7D4F):** green for the one main action, the active tab, badges, and the best-card highlight.
- **Ink (#1C2A1E):** main text. **Ink muted (#5D6B5B):** labels and helper text.
- **Error (#B3261E):** error messages only, always with text.
- **Category colors:** groceries green, dining orange, gas blue, travel purple. Used only on liquid icons.
- **Card colors** come from each card's catalog data, not from this file.

## Typography

- Font stack: `-apple-system, "SF Pro Text", "Inter", sans-serif`, so iPhones and Macs show SF Pro and other devices show Inter.
- Mobile: large titles (30px bold) on every main screen, like iOS.
- Website: page headings at 40–46px bold, section headings at 22px bold.
- Money always uses `amount` or `amount-hero` with tabular numbers.

## Layout

Mobile first, with three sizes:

- **Mobile (under 768px):** one column, 16px side padding, floating glass tab bar 22px above the bottom edge. Leave 100px of bottom padding so nothing hides behind it. Results open in a bottom sheet.
- **Tablet (768–1199px):** the same website top bar as desktop, with content in one column, max 720px.
- **Laptop and desktop (1200px and up): a normal website, not a stretched phone app.**
  - A sticky glass top bar (64px): logo on the left, text links (Home, Wallet, Tracker, Alerts) next to it with a green underline on the active page, and the alerts bell and profile on the right. Logged-out pages show "Log in" on the right instead.
  - Page content sits in a centered 1120px container with open layouts: big headings, tables, and grids directly on the background. Use glass only for the search bar, forms, and pills, not for wrapping every section.
  - A simple footer on every page: © SwipeWise, Privacy, Terms, Help, and "Not financial advice."
  - No tab bar, no bottom sheets, and no sidebar on desktop.
- Page headings grow from 30px (mobile) to 40–46px (desktop).
- Spacing comes from the scale only.

## Elevation & Depth

Depth comes from glass layers, not dark shadows. There are three levels: background, glass panels, and the floating layer (bottom sheets and the tab bar on mobile; the top bar and dialogs on the website). Each glass layer has a top inner highlight (1px white) to look like real glass.

## Shapes

- Panels 22px, rows and icons 16px, sheets 34px top corners.
- Buttons, search, chips, and the tab bar are full pills.
- Credit card art always uses a 1.586 aspect ratio (a real card) with 14px corners.

## Components

- **Liquid icon:** a rounded square in the category color with a top shine (a white gradient over the top 45%) and a white line glyph. Sizes 52px (home), 40px (widgets), 30px (list rows).
- **Glass panel:** on mobile, the main container. Grouped form fields and list rows sit inside one panel with thin dividers, like iOS settings. On the website, use it only for forms and dialogs.
- **Bottom sheet (mobile):** a grab handle on top, then the ranked card list. The best card row uses `best-row` with a green outline and a "Best pick" label.
- **Card art:** a gradient in the card's color, a gold chip, a diagonal shine, and the name. Never a card number.
- **Top bar (desktop):** the same four destinations as the tab bar, as text links. The active link is darker with a 2.5px green underline.
- **Tables (desktop):** comparisons and lists use open tables with thin dividers, a small card thumbnail in the first column, and amounts right-aligned.
- **Tab bar (mobile):** a floating glass pill with Home, Wallet, Tracker, and Alerts. The active tab gets a brighter glass bubble and green color.
- **Widgets (mobile Tracker):** glass tiles for rewards earned, bonus progress (ring), perks, and due dates.
- **Stats row (website Tracker):** big numbers split by thin dividers instead of tiles.
- **Footer (website):** © SwipeWise, Privacy, Terms, Help, and "Not financial advice."

## Do's and Don'ts

- Do keep one green primary action per screen.
- Do always put something colorful behind glass. Glass over a flat color looks grey.
- Do keep text on glass at least ink-muted, never lighter.
- Do show money in dollars with two decimals and tabular numbers.
- Do give every icon-only button an accessible label.
- Do respect `prefers-reduced-motion` and `prefers-reduced-transparency`. Use solid white panels when transparency is reduced.
- Don't use dark mode in v1.
- Don't stretch the mobile layout onto the website, or use the tab bar, bottom sheets, or a sidebar there.
- Don't use category colors for text or buttons.
- Don't show or ask for card numbers anywhere.
- Don't add colors, sizes, or radii outside this file; update DESIGN.md first.
