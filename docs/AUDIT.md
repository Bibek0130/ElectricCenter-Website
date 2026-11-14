# Electric Center — Codebase Audit

Phase 1 output. No code was changed while writing this document.

## 1. Stack

| Layer | Detail |
|---|---|
| Frontend framework | React 19 (JSX, no TypeScript) |
| Build tool | Vite 8, wired into an ASP.NET `.esproj` (VS SPA proxy + dev-cert script in `vite.config.js`) |
| Routing | `react-router-dom` v7 (`BrowserRouter`, nested `Route`/`Outlet`) |
| Styling | No design system. Mix of `react-bootstrap` (barely used), a handful of small `.css` files, and **inline `style={{...}}` objects on almost every element** |
| State management | `@reduxjs/toolkit` + `react-redux` are installed but **not used anywhere** in the app. Local state is `useState`/`useReducer`/React Context only |
| Data fetching | `axios` is installed but **not used**. All "APIs" are hand-written mock objects that `await delay(ms)` and return in-memory arrays |
| Data source | Fully static mock data, duplicated in two incompatible places (see §4) |
| Package manager | npm (`package-lock.json` present) |
| Backend | ASP.NET Core (.NET 10) minimal API. One controller (`EmailSenderController`) with a single hardcoded test endpoint. No product/electrician/booking API, no database |

## 2. User flow / route map

`App.jsx` wraps every route in one layout (`MainLayout` → bootstrap `Navbar` + `Footer` + `Outlet`):

- `/` → redirects to `/home`
- `/home` → `LandingPage` — hero image carousel, "why choose us" grid, embedded Google Map (`MapSection`/`PoiMarkers`)
- `/products` → `Product.jsx` — **a self-contained mini application**: it renders its own internal navbar, cart drawer, product grid, product modal, a 3-step checkout, and an order confirmation screen, all driven by local `useState` page-switching instead of routes
- `/about` → static "About Us" content
- `/services` → static services grid + WhatsApp/phone CTA
- `/faq` → searchable FAQ accordion (the most accessible page in the app)

Nothing else is routed. `ProductsPage.jsx`, `Slideshow.jsx`, and `Question.jsx` exist under `src/` but are never imported by `App.jsx` or by each other — they are dead code left over from earlier iterations.

## 3. Highest-priority bug found

**Visiting `/products` renders two navbars and two footers stacked on top of each other.** `MainLayout` already renders a bootstrap navbar + footer around every route's `<Outlet/>`. `Product.jsx`'s default export is a full `App()` component that renders **its own** sticky navbar (with its own logo, cart icon, promo banner) inside that outlet. The two pages were built independently and never integrated. This is a functional/visual defect, not just a style inconsistency, and should be the first thing fixed in the refactor.

## 4. Duplicated / dead code

- **Two incompatible product catalogs and two incompatible product-listing UIs** exist:
  - `Product.jsx` (routed at `/products`) — red theme, its own inline mock `MOCK_PRODUCTS`/`MOCK_CATEGORIES` pulled from `data/constants.js`, plus its own cart, checkout, and toast implementations built from scratch.
  - `ProductsPage.jsx` (orphaned, not routed) — a different dark-purple/yellow theme, a **third**, entirely separate mock product array, its own star rating and card components.
- `Slideshow.jsx` (uses `react-slideshow-image`, the only consumer of that dependency) is unused.
- `Question.jsx` is a placeholder (`<h1>Question</h1>`) left in the tree.
- `service.jsx` has ~60 lines of the previous implementation commented out below the live component.
- `react-hot-toast` is installed but `Product.jsx` reimplements its own toast context instead of using it.

## 5. UI / design inconsistencies

- **No shared design tokens.** `data/constants.js` defines one `COLORS` object (red brand), but `Product.jsx` hardcodes its own near-duplicate red palette instead of importing it, and `ProductsPage.jsx` uses a completely unrelated purple/dark/yellow palette.
- **`index.css` is still the Vite starter template**: purple `--accent: #aa3bff` token that matches no brand color, and `#root { width: 1400px; }` left over from the template (harmless today because `max-width: 100%` is also set, but it's dead, confusing styling that should be removed rather than built on top of).
- **Four+ competing font stacks** with no consistent loading strategy: `'Georgia', serif` (most content pages), `'Barlow Condensed'` (`Product.jsx`), `'DM Sans'`/`'Sora'` (orphaned `ProductsPage.jsx`, loaded via a local `@import` that only that file has), and `system-ui` (`index.css`). None but `ProductsPage.jsx` actually load the font they reference, so most of these silently fall back to system fonts.
- **Every page hand-rolls its own buttons, cards, badges, and price tags** via inline styles — there is no `Button`, `Card`, or `Badge` component anywhere, so visual details (radius, shadow, hover state, focus state) differ page to page.
- The store phone number is formatted three different ways across the app (`+977 9841445050` in the navbar, `+977-9841445050` elsewhere).
- `MainLayout`/`Footer` use `react-bootstrap`; every other page ignores it entirely and hand-rolls markup — two competing component strategies in one app.
- No loading/error/empty states on `LandingPage`, `AboutPage`, `ServicePage`, or `FAQPage` (only the two competing product pages simulate loading).
- Accessibility gaps: `Product.jsx`'s cart drawer and product modal have no focus trap, no `Esc`-to-close, and no `aria-*` attributes; several icon-only buttons (✕, 🛒) have no `aria-label`. `FAQPage` is the one page already doing this correctly (`aria-expanded`, `aria-controls`, `role="region"`) and is a good pattern to copy forward.
- No responsive breakpoints anywhere: `Product.jsx`/`ProductsPage.jsx` use fixed two-column CSS grids (`"220px 1fr"`, `"1fr 1.15fr"`) with no mobile fallback.

## 6. Code-quality problems

- **`Product.jsx` is a ~760-line monolith** containing a navbar, cart drawer, products grid, product card, product modal, a 3-step checkout flow, and a confirmation screen, each with its own inline mock "API." It should be decomposed into the `features/electricians`-style structure the rest of the refactor will introduce for products/electricians.
- No custom hooks anywhere — data fetching and business logic (cart reducer, filter/sort logic) are written directly inside page components.
- No `services`/`api` layer with a swappable mock-vs-real interface; `Product.jsx` invents one locally (with `// REAL: fetch(...)` comments showing the right instinct) but it isn't reused by any other page.
- No PropTypes/TypeScript/JSDoc typing for any data shape (product, category, order).
- Folder/file names contain spaces (`features/About Us/About Us.jsx`, `features/FAQ/FAQ page.jsx`, `features/landing page/LandingPage.jsx`), which also forces an awkward, redundant import path in `App.jsx` (`'../../src/features/About Us/About Us.jsx'`).
- Nav items are passed into `MainLayout` as a literal array of arrays written inline in `App.jsx`'s JSX, rather than a central route/nav config.
- `electriccenter.client/.env` is committed to git (currently empty). Once a real key (e.g. `VITE_GOOGLE_MAPS_API_KEY`, already read via `import.meta.env` in `MapSection.jsx`) is put in it, it will be committed too. It should be git-ignored with a checked-in `.env.example` instead.
- Backend has no domain API: only a hardcoded test email endpoint. All "persistence" today is `localStorage` (cart) or purely in-memory state.

## 7. Prioritized improvement list for Phase 2+

1. Fix the double-navbar bug on `/products` by decomposing `Product.jsx` into route-driven pages that render inside `MainLayout`, not around it.
2. Delete dead code: `ProductsPage.jsx`, `Slideshow.jsx`, `Question.jsx`, the commented-out block in `service.jsx`.
3. Introduce one set of design tokens (CSS variables) replacing the leftover Vite template tokens in `index.css`, and delete the competing hardcoded palettes in `Product.jsx`/`ProductsPage.jsx`.
4. Build the shared UI component library (`Button`, `Card`, `Badge`, `Modal`, `Input`, etc.) and migrate existing pages onto it instead of inline styles.
5. Add a `services/` layer with one mock-backed interface per domain (products, electricians, bookings) and move all data fetching into hooks that call it.
6. Rename space-containing folders/files to kebab/camel case and fix the resulting imports.
7. Add `.env` to `.gitignore`, commit `.env.example` instead.
8. Build the new electricians listing → profile → booking flow (Phases 3–4 of this project) on top of the new component/service/hook layers so it is consistent with the rest of the app from day one, rather than becoming a third competing implementation.
