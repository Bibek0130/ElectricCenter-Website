# Panchamukhi Electric Center

Electrical products, supplies, and electrician booking for Kathmandu, Nepal —
a React + Vite single-page app served by an ASP.NET Core backend.

## Stack

- **Frontend:** React 19, Vite, React Router, `react-hot-toast`, `axios`, `@vis.gl/react-google-maps`. Plain CSS with a design-token system — no UI framework (react-bootstrap was removed during the rebuild; see `docs/AUDIT.md`).
- **Backend:** ASP.NET Core (.NET 10) minimal API. Currently exposes a WhatsApp-notification endpoint; product/electrician data is served from the client's mock service layer so a real API can be swapped in later without touching UI code.
- **Testing:** Vitest, for pure-function logic (form validation, WhatsApp message building).

## Architecture

```
src/
  app/                 Routes (App.jsx) and the shared page layout
  components/
    ui/                Design-system primitives: Button, Card, Badge, Modal, Input, …
    layout/            Navbar, Footer, PageContainer, Section
    Maps/              Google Maps store-locator widget
  features/
    landing/           Home page
    about/, services/, FAQ/
    products/          Listing, product modal, cart, checkout
    electricians/       Listing, profile, past-work gallery, booking modal
  hooks/               Cross-feature hooks (useDisclosure, useFormValidation)
  services/            Data-access layer (productsService, electriciansService,
                       bookingService, whatsappService, httpClient) — swap a
                       mock body for a real `httpClient` call without touching
                       any component
  data/                Mock datasets behind the service layer
  styles/              Design tokens (tokens.css), base styles, and one
                       stylesheet per major surface (components/products/electricians)
  types/models.js      JSDoc type definitions for the core data models
```

Each feature follows the same shape: a `pages/` (or top-level page) component
that renders UI, a `hooks/` folder that owns data-fetching and state, and a
`services/` module that owns the actual data access. Components never call a
service directly — they go through a hook, so swapping mock data for a real
API only means editing the service file.

## Running locally

```bash
cd electriccenter.client
npm install
npm run dev       # https://localhost:60083 (proxies /api and /weatherforecast to the .NET backend)
```

Or open `ElectricCenter.slnx` in Visual Studio and run — it starts both the
.NET backend and the Vite dev server together.

Other scripts: `npm run build`, `npm run preview`, `npm run lint`, `npm test`.

## Adding a new electrician

Electricians are mock data today (`src/data/electricians.js`), sitting behind
`electriciansService` exactly like a real API response would. To add one,
append an object matching the `Electrician` shape documented in
`src/types/models.js` (id, name, photo, specialties, rate, demand, rating,
reviewCount, yearsExperience, location, whatsappNumber in **E.164 format**,
e.g. `+9779841445050`, bio, and pastWorks). New specialty strings are picked
up automatically by the listing page's filter pills.

## Adding a new product

Same pattern: append to `src/data/products.js` (id, categoryId matching one
of `CATEGORIES`, name, price, discountPercent, stock, brand, sku,
descriptions, specs, isFeatured).

## Environment variables

Copy `.env.example` to `.env` (git-ignored) and fill in:

| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Powers the store-locator map on the home page. Without it, the map section shows a "map unavailable" placeholder instead of failing. |
| `VITE_API_BASE_URL` | Base URL for backend API calls. Leave as `/api` in development — Vite proxies it to the ASP.NET server. |
| `VITE_WHATSAPP_STRATEGY` | `click-to-chat` (default) or `cloud-api` — see below. |

## Configuring WhatsApp booking notifications

`src/services/whatsappService.js` supports two strategies:

1. **`click-to-chat` (default, no backend setup needed).** Booking opens a
   `https://wa.me/<electrician-number>?text=<booking details>` link in a new
   tab, sent from the *customer's own* WhatsApp. Works out of the box.
2. **`cloud-api` (automatic, no customer action needed).** Set
   `VITE_WHATSAPP_STRATEGY=cloud-api`, then set these as real **environment
   variables** on the machine/host running the ASP.NET server (not in a
   committed file — ASP.NET Core reads process environment variables
   automatically; for local development use `dotnet user-secrets` or your
   shell's env vars instead of appsettings.json):
   - `WHATSAPP_TOKEN` — a WhatsApp Business Cloud API access token
   - `WHATSAPP_PHONE_NUMBER_ID` — the sender's phone number ID
   - `WHATSAPP_TEMPLATE_NAME` — optional, defaults to `booking_notification`

   The server endpoint is `POST /api/whatsapp/notify`
   (`ElectricCenter.Server/Controllers/WhatsAppController.cs`). If the token
   or phone number ID aren't set, it returns 503 and the client automatically
   falls back to the `click-to-chat` strategy — a booking is never silently
   lost.

## Known follow-ups

See `docs/AUDIT.md` for the original architecture audit. Remaining
suggestions: add TypeScript (JSDoc typedefs currently stand in for it), wire
`productsService`/`electriciansService`/`bookingService` up to real ASP.NET
Core endpoints once they exist, and consider React Query if data-fetching
needs (caching, refetch-on-focus) grow beyond the current hooks.
