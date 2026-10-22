# AGENTS.md — Infinitum

> **Read this entire file before making any change, running any command, or answering any question about this
> repository.** It explains what this product is, why it's built the way it is, what's already been tested, what
> state the live system is currently in, and the gotchas that aren't obvious from the code alone. This is a real,
> live product with real (if currently test) data in a real database — treat it accordingly, not as a throwaway demo.

## 1. What this project is

**Infinitum** is a digital-menu platform for small cafes and restaurants (originally scoped for the Indian market —
see `Untitled document.pdf` at the repo root for the original, informally-written requirements doc this project was
built from). The pitch: a restaurant photographs their existing paper menu, the system turns it into a clean digital
menu page in minutes, and customers view that menu on their phones (mobile is the primary target device, not a
secondary concern).

Core features actually built and working today:
- **Two roles**: **Admin** (the company running Infinitum — full access, can delete anything) and **Restaurant**
  (a single cafe/restaurant's own login — can add/edit/reorder but **cannot delete**; only admins delete).
- **Menu editor** (`edit-menu.html`): categories as a reorderable horizontal strip, dishes as tiles underneath with
  inline editing, drag-free up/down reordering, a ⋮ menu to move a dish to a different category, and a toolbar
  "+ Add new dish" that works even with zero existing categories.
- **Draft vs. Published split**: all edits happen on a "draft" (normalized `categories`/`items` tables). Customers
  only ever see what's in `restaurants.published_menu` (a JSON snapshot), updated only when the owner/admin clicks
  **Publish**. This was an explicit requirement — edits must not go live until deliberately published.
- **Logo-based + manual color theming**: upload a logo and the whole site's background/accent colors are derived
  from its dominant color automatically; restaurants can also pick any color manually or fine-tune one of 5
  auto-generated shades. This was one of the user's headline requested features — treat it as important, not
  decorative.
- **Default dish photo + description matching by name**: if a restaurant doesn't supply a description or photo for
  a dish, the system matches the dish name (exact or substring) against a static dictionary (`DISH_DEFAULTS` in
  `prototype/js/menuData.js`) and fills in a generic description + a representative icon automatically. This was
  explicitly requested to work by **name-matching**, not just one generic fallback image for everything.
- **"Scan new menu" flow** (`scan-menu.html`): lets a restaurant (or admin, onboarding a new one) take multiple
  photos (or upload them) of a paper menu, then "analyzes" them. **Real OCR/photo-to-text is intentionally NOT
  implemented** — this was an explicit, discussed scope decision (see §5). The flow is fully real otherwise: photos
  really upload to Supabase Storage, and real category/item rows really get created in the draft menu, matched
  against `DISH_DEFAULTS` by name — only the "reading the photo" step is simulated with canned sample dishes.
- **Public menu page** (`menu-view.html`): no login required, mobile-first, horizontal image-left tiles (not a
  photo-grid — this was a deliberate redesign from an earlier card-grid layout), 2 columns on wider screens, and an
  expand/collapse "Show more" control so long names/descriptions don't force every tile to be the same oversized
  height (only appears when text actually overflows).

## 2. Why it's built the way it is (architecture)

- **No framework, no build step.** Plain HTML + CSS + vanilla JS, loaded directly by the browser. This was a
  deliberate choice because the user is non-technical and asked to minimize moving parts. Do not introduce a bundler,
  React, TypeScript, or a package.json-driven build unless the user explicitly asks for one — it would break the
  "just open the file / just deploy the folder" simplicity that was chosen on purpose.
- **Supabase is the entire backend** (Postgres database + Auth + file storage), called *directly from the browser*
  via `@supabase/supabase-js` (loaded from a CDN `<script>` tag — see every HTML file's bottom `<script>` block).
  There is no custom server and no API layer of our own.
- **The Supabase "publishable" (anon) key is intentionally hardcoded in `prototype/js/supabaseClient.js`.** This is
  not a leaked secret — it is *meant* to be public. All real data protection is enforced server-side by Postgres
  Row Level Security policies in `supabase/schema.sql`, not by hiding this key. Do not "fix" this by moving it to an
  env var/.env file unless you also set up a build step, and do not treat its presence in the repo as a security
  incident.
- **Multi-tenancy model**: `profiles` table links a Supabase Auth user to a `role` (`admin` | `restaurant`) and,
  for restaurant users, a `restaurant_id`. RLS policies (`is_admin()` / `my_restaurant_id()` SQL functions in
  `supabase/schema.sql`) enforce: admins see/edit/delete everything; a restaurant user only sees/edits their own
  `categories`/`items`; `restaurants` rows are publicly readable (needed for the public menu page) but only
  writable by their owner or an admin.
- **Draft vs. Published data shape**: `categories`/`items` are real normalized tables (so reordering/moving rows is
  simple `sort_order` updates). `restaurants.published_menu` is a denormalized JSONB snapshot in the exact nested
  shape the UI renders (`[{ id, name, items: [{ id, name, price, sizes, image, description }] }]`), rebuilt from the
  normalized tables every time "Publish" is clicked (`DataStore.publish()` in `menuData.js`).
- **JSONB key ordering gotcha (already hit and fixed once — watch for regressions):** Postgres JSONB does **not**
  preserve object key insertion order. Comparing a freshly-built draft against `published_menu` with plain
  `JSON.stringify(a) === JSON.stringify(b)` gives **false positives** for "unpublished changes" after a page
  reload, purely from key reordering, not real differences. The fix is `stableStringify`/`menusAreEqual` in
  `prototype/js/menuData.js` (sorts object keys recursively before comparing) — **always use `menusAreEqual()`**
  for this comparison, never raw `JSON.stringify` equality, anywhere this pattern is needed in the future.

## 3. Repository layout

```
/
├── Untitled document.pdf     # Original informal requirements doc (source of truth for "why")
├── supabase/
│   └── schema.sql            # Full DB schema: tables, RLS policies, storage buckets. Already applied to the live project.
└── prototype/                # The actual website — this is what gets deployed
    ├── index.html             # Public marketing homepage (static)
    ├── login.html             # Real email/password login (Supabase Auth) — no public sign-up page, by design
    ├── admin-dashboard.html   # Admin: lists all restaurants, "+ Scan new menu" creates a brand-new restaurant
    ├── restaurant-dashboard.html  # A restaurant's own home: profile, publish status, logo/theme panel
    ├── edit-menu.html + js/editMenu.js   # The shared menu editor (admin + restaurant; role query param gates delete)
    ├── scan-menu.html + js/scan.js       # Camera/upload flow → mocked "OCR" → merges into the draft menu
    ├── menu-view.html         # Public, no-login digital menu customers actually see
    ├── css/styles.css         # Design system: CSS variables, base components (buttons, cards, nav, forms)
    ├── css/pages.css          # Page-specific styles (homepage, dashboards, editor tiles, public menu, scan camera)
    ├── js/supabaseClient.js   # Creates the one shared Supabase client (URL + publishable key live here)
    ├── js/auth.js             # Thin Supabase Auth wrapper + role-based route guards (requireProfile/requireRole)
    ├── js/menuData.js         # All DB reads/writes (DataStore), DISH_DEFAULTS dictionary, stableStringify/menusAreEqual
    ├── js/theme.js            # Pure color math (hex/HSL conversions, shade generation, logo pixel-sampling) — no persistence
    ├── js/themePanel.js       # Reusable logo-upload + color-picker UI, mounted on both dashboard and editor
    ├── js/main.js             # Mobile nav hamburger toggle, footer year
    └── assets/                # Default dish icons (dish-pizza.svg, dish-south-indian.svg, etc.) + sample logos
```

## 4. Local development

- **No build step.** Serve the `prototype/` folder with any static file server and open it in a browser, e.g.:
  `cd prototype; python -m http.server 8765` then visit `http://localhost:8765/index.html`.
- **Camera access** (`scan-menu.html`) requires a secure context — works on `localhost`, will *not* work over plain
  `http://` on a real domain/IP. The page already has a graceful "Upload photo instead" fallback for this.
- **Known local-dev-only caching trap**: Python's `http.server` sends no `Cache-Control` header, and Chromium's
  heuristic caching can silently keep serving an old cached copy of a `.js`/`.css` file after you edit it — even
  across a hard reload or a brand-new page/tab in the same browser profile. If a fix "isn't taking effect" during
  manual testing, this is almost always why. Fixes that reliably work: open DevTools Network tab with "Disable
  cache" checked, or run `await (await page.context().newCDPSession(page)).send('Network.clearBrowserCache')` before
  reloading if testing via Playwright/CDP. **This is a local-testing artifact only** — it will not affect the real
  deployed site, since Vercel serves proper cache-control/ETag headers.

## 5. Explicit scope decisions (don't "fix" these without asking)

- **Real OCR is deliberately not implemented.** The user explicitly chose "keep it simple for launch: type dish
  names, auto-fill description/photo by name match" over "set up real photo-to-text OCR now" when asked directly.
  `scan.js`'s `buildScannedCategories()` returns a fixed set of canned sample dishes — this is correct, expected
  behavior for the current phase, not a bug or an unfinished stub to silently "complete."
- **No public restaurant sign-up page.** Restaurant and admin accounts are both created manually via the Supabase
  dashboard (Authentication → Add user) plus a one-line SQL insert into `profiles` to assign a role — this matches
  the original spec ("Admin login done by us only... Restaurant login..."). Don't add a public `/signup` page
  without the user asking for it.
- **Default dish images are original simple line-art SVG icons** (`assets/dish-*.svg`), not real food photography —
  deliberately, to avoid any copyright concern around sourcing stock photos. If asked to improve these, stay with
  original/generated art, not scraped or API-sourced stock photos, unless the user explicitly sources their own.
- **Vercel hosting is not yet connected.** GitHub and Supabase are both live and working; the user paused right
  before the Vercel import step. Picking this up again just means: Vercel dashboard → Add New Project → Import
  `SmashBlank/infinitum-menu` → **set Root Directory to `prototype`** (the site isn't at the repo root) → Framework
  Preset "Other" (static, no build command) → Deploy.

## 6. Current live state (as of last session — verify before assuming)

- GitHub: `https://github.com/SmashBlank/infinitum-menu`, branch `main`, up to date with local.
- Supabase project is live, schema from `supabase/schema.sql` has been applied.
- One real admin account exists (the user's own email — password known only to them).
- **Test data currently exists in the live database and was deliberately left in place at the user's request**:
  - `test-admin@example.com` / `TestPass123!` (role: admin)
  - `test-restaurant@example.com` / `TestPass123!` (role: restaurant, owns a restaurant called "Test Cafe")
  - "Test Cafe" has real draft categories/items created during testing (Starters/Main Course/Beverages from the
    scan flow, plus a "Pizza Margherita" item added manually, plus whatever the user added themselves while
    exploring — e.g. a "Lunch" category with "Dal Rice" was added by the user directly, not by an agent).
  - **Do not delete these without asking the user first** — they said "leave it for now, I'm still testing."
- No other "seed"/demo data exists — earlier in development there were 3-4 fake demo restaurants
  (Green Leaf Cafe, Spice Route, Blue Wave Pizzeria, Fresh Bites Diner) but those only ever existed in a
  **localStorage-based prototype** that has since been fully replaced by the real Supabase backend. If you see
  references to those names in old chat history or old code comments, they no longer exist in the live database.

## 7. What's been tested

Every page and the full primary flow (login → scan → edit → publish → public view) has been manually exercised
end-to-end against the **real** Supabase backend (not mocked), including: real photo upload to Storage, real logo
upload + color extraction, real theme persistence across reloads, role-based delete visibility (admin sees delete
controls, restaurant does not — verified both in the UI and that it's additionally enforced server-side via RLS),
publish/draft status accuracy, and mobile responsiveness at 360px/390px viewport widths with zero horizontal
overflow on every page. Bugs found during this testing were fixed, not left as known issues — see `git log` for the
specific fix commits (commit messages are descriptive and accurate; read them rather than assuming behavior).

## 8. Conventions

- Vanilla JS, no semicolon-free style — match the existing formatting (2-space indent, double quotes, semicolons).
- Every DB-backed page follows the same init pattern: an `async function init()` IIFE that calls
  `Auth.requireProfile()` / `Auth.requireRole(...)` first, then fetches data, then renders. Follow this pattern for
  any new authenticated page rather than inventing a new one.
- After any mutation in the editor, the pattern is "mutate via `DataStore`, then re-fetch the whole draft menu and
  re-render" (see `reload()` in `editMenu.js`) — not optimistic local-only state updates. This trades a little
  latency for correctness/simplicity; keep this pattern for consistency unless there's a real performance need to
  change it.
- CSS variables (`--bg`, `--accent`, etc., defined in `styles.css`) drive the entire theming system — never hardcode
  a color in new UI; use/extend these variables so logo-based theming keeps working everywhere.
