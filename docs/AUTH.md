# Authentication & authorization

JWT-based auth backed by MySQL. No ASP.NET Core Identity.

## How it works

| Piece | Where | Lifetime |
|---|---|---|
| Access token (JWT, HS256) | Response body → kept **in memory** by the SPA → sent as `Authorization: Bearer` | 15 min (`Jwt:AccessTokenMinutes`) |
| Refresh token (64 random bytes) | `ec_refresh` cookie: HttpOnly, Secure, SameSite=Strict, Path=`/api/auth`. Only its SHA-256 hash is stored in MySQL | 14 days sliding (`Jwt:RefreshTokenDays`) |

- **Page load:** the SPA calls `POST /api/auth/refresh` to restore the session from the cookie. It only does this if the browser has signed in before, which it tracks with a non-secret `ec_has_session` flag in localStorage.
- **Expired access token:** the axios interceptor in `src/services/httpClient.js` gets a 401. It refreshes once and retries the request. Concurrent refreshes share one request, and the Web Locks API serializes them across tabs.
- **Rotation:** every refresh replaces the refresh token. A rotated token replayed **after** a 30-second grace window is treated as stolen, and every token from that login is revoked. Within the window (two tabs refreshing at once), the caller just gets a new access token.
- **Logout:** this revokes the refresh token's whole login chain and clears the cookie. An access token already issued stays valid until it expires (at most 15 minutes), which is inherent to JWTs. Role changes and deactivation take effect at the next refresh.
- **CSRF:** API calls authenticate with the Bearer header, so they aren't CSRF-able. The cookie-based `/api/auth/*` endpoints also require an `X-Requested-With` header, which a cross-site form can't send.
- **Brute force:** after 5 failed logins an account is locked for 15 minutes. Login, register and change-password allow 10 requests per IP per minute. Refresh and logout allow 60.
- **Passwords:** BCrypt with cost 12, using SHA-384 pre-hashing so long passwords aren't truncated at 72 bytes. They must be 8–128 characters.

### Email verification (OTP)

Every account must prove it owns its email address with a 6-digit code before it can sign in.

- **Sign-up** (`/register`) doesn't create an account yet. It stores a *pending registration* (the password already BCrypt-hashed) and emails a code. The account is created, verified and signed in only when the code is entered on `/verify-email`.
- **Admin-created accounts** (electricians) start unverified. On first login with the correct password, the server emails a code instead of signing in (403 `email_not_verified`). After verifying once, later logins sign straight in. A wrong password never triggers an email.
- **Each challenge has two parts:**
  - an opaque verification id that only the requesting browser receives;
  - the code, which only the mailbox receives.

  Both are needed, so someone who starts a sign-up with another person's email can't use the code sent to that person.
- **Limits:**
  - Codes expire after 10 minutes.
  - 5 wrong attempts kill the code.
  - "Send a new code" has a 60-second cooldown and a cap of 5 sends per challenge.
  - One address receives at most 6 codes per hour, so the form can't be used to spam an inbox.
  - All of these are configurable under `EmailVerification:*`.
- **Storage:** codes are kept as HMAC-SHA256 hashes, keyed from the JWT signing key. A 6-digit code hashed with plain SHA-256 could be brute-forced from a database dump. Verification ids are stored as SHA-256 hashes.
- **Existing accounts:** accounts that existed before this feature (the seeded admin) were marked verified by the migration. The seeded admin is always created verified.

### Roles

A user can hold **several** roles (`UserRoles` table): `Customer`, `Electrician`, `Admin`.

- Self-registration (`/register`) always creates a **Customer**. Customers need an account to book an electrician; product checkout stays open to guests.
- **Electrician** and **Admin** accounts are created by an admin through `POST /api/admin/users`.
- The first admin is seeded at startup from `Seed:Admin:*` settings.
- Server side: `[Authorize]`, `[Authorize(Policy = Policies.AdminOnly)]`. Client side: `<ProtectedRoute roles={[...]}>` and `useAuth().hasRole(...)`. These are UX only; the API enforces the rules on every request.

## API

All endpoints are under `/api/auth` and need the `X-Requested-With` header.

| Method & path | Auth | Notes |
|---|---|---|
| `POST /register` | – | `{ fullName, email, phone?, password }` → **202** `{ code: "verification_sent", message, verification }`. Emails the code; no account or session yet. 409 if the email already has an account |
| `POST /verify-email` | – | `{ verificationId, code }` → `{ accessToken, expiresAt, user }` + cookie. 400 with a message (attempts left, expired, …) on failure |
| `POST /resend-verification` | – | `{ verificationId }` → a fresh `verification` with a new code. 429 during the cooldown |
| `POST /login` | – | `{ email, password }` → `{ accessToken, expiresAt, user }` + cookie. **403** `{ code: "email_not_verified", verification }` for an unverified account (code emailed). 401 with a generic message on any failure |
| `POST /refresh` | cookie | → same shape. 401 + cookie cleared if invalid |
| `POST /logout` | cookie | 204 |
| `POST /logout-all` | Bearer | Revokes every session of the user |
| `GET /me` | Bearer | → `user` |
| `POST /change-password` | Bearer | `{ currentPassword, newPassword }`. Signs out other devices and returns a fresh session |

Admin endpoints are under `/api/admin/users` and require the `Admin` role.

| Method & path | Notes |
|---|---|
| `GET /` | List users with roles and status |
| `POST /` | `{ fullName, email, phone?, password, roles: ["Electrician", ...] }` |
| `PUT /{id}/roles` | `{ roles: [...] }`. You can't remove your own Admin role |
| `PUT /{id}/active` | `{ isActive }`. Deactivating also ends their sessions. You can't deactivate yourself |
| `POST /{id}/reset-password` | `{ newPassword }`. Also clears lockout and ends their sessions |

Other protected endpoints:
- `POST /api/whatsapp/notify` requires any signed-in user.
- `POST /api/email/test` is admin-only. It sends a test email to the calling admin.

In development, try everything at `https://localhost:7023/api-docs` (Scalar). Log in, copy `accessToken`, and use it as the Bearer token.

## Local setup

1. **Create the database and app user.** Do this once, as MySQL root. With a locally installed MySQL (port 3306):
   ```sql
   CREATE DATABASE IF NOT EXISTS electriccenter CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER IF NOT EXISTS 'electriccenter'@'localhost' IDENTIFIED BY '<a strong password>';
   GRANT ALL PRIVILEGES ON electriccenter.* TO 'electriccenter'@'localhost';
   ```
   Alternatively, use Docker. Copy `.env.example` to `.env`, then run `docker compose up -d`. That gives MySQL 8.4 on 127.0.0.1:**3307**.
2. **Set secrets** in .NET user-secrets, never in appsettings or git:
   ```sh
   cd ElectricCenter.Server
   dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Port=3306;Database=electriccenter;User=electriccenter;Password=<that password>;"
   dotnet user-secrets set "Jwt:SigningKey" "<at least 32 random bytes, e.g. node -e \"console.log(require('crypto').randomBytes(64).toString('base64url'))\">"
   dotnet user-secrets set "Seed:Admin:Email" "admin@electriccenter.local"
   dotnet user-secrets set "Seed:Admin:Password" "<a strong password>"
   dotnet user-secrets list   # to look values up later
   ```
3. **Email (for the OTP codes).** Without SMTP settings, Development writes each email, including the code, to the **server console** instead of sending it. That's handy for testing. To send real email through Gmail:
   1. Turn on 2-Step Verification for the Google account.
   2. Create an **App Password** at https://myaccount.google.com/apppasswords. It's 16 characters, and your normal Gmail password won't work.
   3. Set the SMTP secrets:
   ```sh
   dotnet user-secrets set "Email:Smtp:Host" "smtp.gmail.com"
   dotnet user-secrets set "Email:Smtp:Port" "587"
   dotnet user-secrets set "Email:Smtp:UserName" "<your-address@gmail.com>"
   dotnet user-secrets set "Email:Smtp:Password" "<the 16-character app password>"
   dotnet user-secrets set "Email:Smtp:FromAddress" "<your-address@gmail.com>"
   ```
   Any SMTP provider works (Brevo, Mailgun, Zoho, …). Outside Development, the server refuses to start without SMTP.
4. **Run the server.** In Development it applies migrations and seeds the admin on startup.

**Migrations:** the `dotnet-ef` tool is pinned in `dotnet-tools.json`. Run `dotnet tool restore` once.
```sh
dotnet ef migrations add <Name> --project ElectricCenter.Server --output-dir Data/Migrations
dotnet ef database update --project ElectricCenter.Server
```

**Tests:**
- `dotnet test ElectricCenter.Server.Tests` runs on SQLite in-memory, so no MySQL is needed.
- `npm test` in `electriccenter.client`.

## Production settings (environment variables)

| Variable | Value |
|---|---|
| `ConnectionStrings__Default` | Hosted MySQL connection string. Add `SslMode=Required;` |
| `Jwt__SigningKey` | ≥ 32 random bytes, different from development. Changing it signs everyone out |
| `Seed__Admin__Email` / `Seed__Admin__Password` | First admin. Only used if that email doesn't exist yet. Remove after first start if you like |
| `Database__MigrateOnStartup` | `true` to apply migrations on startup (simplest on free hosts). Otherwise run `dotnet ef database update` against the hosted DB |
| `Email__Smtp__Host`, `__Port`, `__UserName`, `__Password`, `__FromAddress` | **Required**: SMTP used to send verification codes. The server won't start without it outside Development |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` when behind a reverse proxy, so rate limiting sees real client IPs |

The app must be served over HTTPS in production. The refresh cookie is `Secure`.
**Free MySQL hosts:** the connection uses `EnableRetryOnFailure`, so a free-tier database waking from sleep doesn't fail the first request. The server version is fixed to 8.0.x. Any MySQL 8-compatible host works by changing only the connection string.

## Not done yet

- Self-service forgot/reset password. It can reuse the OTP challenge table. Until then an admin can reset passwords.
- Admin UI for managing users. Use the API through `/api-docs` for now.
- Bookings are still saved in browser localStorage. Moving them to MySQL (with `UserId`, "My bookings" and an electrician view of their jobs) is the next phase. `/api/whatsapp/notify` should then check that `to` is the booked electrician's number.

## Product catalog

Products now live in MySQL (`Products`, `Categories`) instead of `src/data/products.js`.

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/products` | – | Query: `search` (name, brand or SKU), `categoryId`, `minPrice`, `maxPrice` (on the **selling** price after discount), `sort` = `price_asc` \| `price_desc` \| `name` (default: newest). `includeDeleted=true` only takes effect for admins |
| `GET /api/products/{id}` | – | 404 for deleted products, except for admins |
| `GET /api/categories` | – | The six seeded categories. There's no category management yet |
| `POST /api/products` | Admin | 201 + product |
| `PUT /api/products/{id}` | Admin | Body must include the `version` the admin loaded. **409** if someone saved in between (optimistic concurrency) |
| `DELETE /api/products/{id}` | Admin | **Soft delete.** Sets `IsDeleted`, `DeletedAtUtc` and `DeletedByUserId`. Returns the product so the UI can offer Undo |
| `POST /api/products/{id}/restore` | Admin | Un-deletes |

**Products are never hard-deleted.** Three layers enforce this:
1. There is no hard-delete endpoint.
2. A global query filter hides deleted rows from every normal query. Use `IgnoreQueryFilters()` for admin views.
3. `AppDbContext.SaveChanges` converts any EF `Remove()` of a soft-deletable entity into a soft delete.

Bulk `ExecuteDelete()` bypasses EF's change tracking, so never use it on products. SKUs stay unique across deleted products too, so restoring one can never collide with a newer product.

**Sample data:** in Development, `Seed:SampleProducts` (on in `appsettings.Development.json`) inserts the 12 products the site used to hard-code. It only does this when the `Products` table has never had a row. It never runs in other environments.

**Not done yet:** image upload (products take an image **URL** for now), category management, stock reservation at checkout (checkout is still a client-side mock), and server-side orders.

## Electrician directory

Electricians live in MySQL (`Electricians`, `ElectricianSpecialties`) instead of `src/data/electricians.js`. The rules are the same as for products.

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/electricians` | – | Query: `search` (name, location or specialty), `specialty`, `sort` = `availability` \| `experience` \| `price_asc` \| `price_desc` (default: the order they were added). `includeDeleted=true` only takes effect for admins |
| `GET /api/electricians/specialties` | – | The fixed list of 11 specialties admins choose from |
| `GET /api/electricians/{id}` | – | 404 for deleted electricians, except for admins |
| `POST /api/electricians` | Admin | 201 + electrician |
| `PUT /api/electricians/{id}` | Admin | Body must include `version`; **409** on a concurrent edit |
| `DELETE /api/electricians/{id}` | Admin | **Soft delete**: hidden from the directory and can't be booked |
| `POST /api/electricians/{id}/restore` | Admin | Un-deletes |

- **WhatsApp booking notifications** now send only `{ electricianId, booking }`. The server looks up the electrician's stored WhatsApp number and refuses deleted or unknown electricians, so the endpoint can't be used to message arbitrary numbers.
- **Ratings and reviews** were removed from the UI: there is no review system yet, and showing invented ratings would mislead customers.
- **Sample data:** in Development, `Seed:SampleElectricians` inserts Udhav Mainali once, into an empty table. Production starts empty, so the admin adds electricians.

## Image uploads (Cloudinary)

Product photos, electrician photos and past-work photos are uploaded from the admin forms. The browser sends the file to **our server**, the server uploads it to Cloudinary, and only the returned `https://res.cloudinary.com/…` URL is saved in MySQL (in the existing `ImageUrl` / `PhotoUrl` fields, so no migration).

`POST /api/uploads/image` is **Admin only** and takes `multipart/form-data` with one `file` field. It returns `{ url, width, height }`. Rules:
- JPG, PNG or WebP, up to **5 MB**. The type is detected from the file's actual bytes, not the file name or the browser's claim. SVG, GIF and anything else is refused.
- Cloudinary shrinks anything over 1600×1600 px, so phone photos aren't stored at full size.
- 30 uploads per minute per user.
- The signed request is made server-side, so the API secret never reaches the browser.
- Without Cloudinary settings, upload returns **503** "Image uploads aren't set up yet" and the forms show that message. Products and electricians can still be saved without photos.

### Setup
1. Create a free account at https://cloudinary.com. From the dashboard copy the **Cloud name**, **API key** and **API secret**.
2. Set them as secrets. In development:
   ```sh
   cd ElectricCenter.Server
   dotnet user-secrets set "Cloudinary:CloudName" "<cloud name>"
   dotnet user-secrets set "Cloudinary:ApiKey" "<api key>"
   dotnet user-secrets set "Cloudinary:ApiSecret" "<api secret>"
   ```
   In production (Render) set the environment variables `Cloudinary__CloudName`, `Cloudinary__ApiKey` and `Cloudinary__ApiSecret`. Optionally set `Cloudinary__Folder` (default `electriccenter`).

**Known limits:** replacing or removing a photo, or deleting a product, leaves the old file in Cloudinary. It's harmless and counts only against your free storage quota. Clean up from the Cloudinary Media Library if it ever matters. Existing products with pasted image links keep working.
