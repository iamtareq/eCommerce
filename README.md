# Deenbox — Store & Order Management

Deenbox is a Bangla, mobile-first online store for Islamic gift boxes and home decor. Customers arrive mostly from the
[Deenbox Facebook page](https://www.facebook.com/profile.php?id=61582403091716). They open a product landing page, place an
order (cart, Bangladesh location picker, live price summary) and get an order number. The shop confirms every order by
phone. Orders go to **PostgreSQL**, which is the source of truth, and are then copied to **Google Sheets**. Staff manage
everything from an admin panel at `/admin`.

---

## দ্রুত শুরু (বাংলায়)

1. `npm install`
2. `.env.example` কপি করে `.env` নাম দিন এবং `DATABASE_URL` আর `APP_SECRET` পূরণ করুন (নিচে দেখুন)।
3. `npm run db:deploy` দিয়ে database-এ টেবিল তৈরি করুন।
4. `ADMIN_USERNAME` ও `ADMIN_PASSWORD` বসিয়ে `npm run db:seed` চালান। এতে ডেলিভারি জোন আর প্রথম admin account তৈরি হবে।
5. `npm run dev` চালিয়ে ব্রাউজারে http://localhost:3000 (স্টোর) এবং http://localhost:3000/admin (অ্যাডমিন) খুলুন।
6. Admin → **Delivery** থেকে আসল ডেলিভারি চার্জ, **Products** থেকে আসল পণ্য-ছবি-দাম, **Site settings** থেকে ফোন নম্বর, FAQ ও রিটার্ন নীতি দিন।
7. Google Sheet যুক্ত করতে নিচের **Google Sheets** অংশ অনুসরণ করুন।

> এই কম্পিউটারে ডেভেলপমেন্টের জন্য প্রজেক্টের নিজস্ব PostgreSQL (port 5433) সেট করা আছে। কম্পিউটার চালু করার পর
> প্রথমে `npm run db:start` চালান, তারপর `npm run dev`।

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Admin accounts](#admin-accounts)
- [Google Sheets](#google-sheets)
- [Images](#images)
- [Analytics & notifications](#analytics--notifications)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Before going live](#before-going-live)

---

## Features

**Storefront (Bangla)**
- Home page with featured products, categories, "Why Deenbox", reviews, FAQ and a final call to action.
- A landing page for every product at `/products/<slug>`. It has a gallery with zoom, a variant picker (size/colour), a
  quantity stepper, quantity-discount hints, benefits, details (what's in the box, specifications, how to use, important
  notes), a photo showcase, reviews and FAQ. The order form sits on the same page, and phones get a sticky "অর্ডার করুন" bar.
- Customers can order several products at once through a browser cart (`/checkout`).
- The order form has name and mobile number (accepts `01…`, `+880…`, `880…` and Bangla digits). For location it has
  Division → District → Area/Thana: all 8 divisions, 64 districts and 494 upazilas, plus Dhaka's 50 city thanas and an
  "other area" free-text option. It also has a full address field, an optional note and a coupon code.
- The live order summary is always calculated by the server: subtotal, quantity discount, coupon, delivery charge and total.
- The confirmation page `/order/<token>` shows the order number and full breakdown. The link is unguessable and expires
  after 60 days.
- SEO: per-page titles and descriptions, canonical URLs, Open Graph and Facebook previews, Product and Organization JSON-LD,
  `sitemap.xml`, `robots.txt`.

**Ordering rules (server-side, never trusted from the browser)**
- The server calculates prices, discounts and delivery from the database. The browser sends only variant ids,
  quantities, location and coupon code.
- **Discounts:**
  - previous/sale price per variant
  - "buy N+ get X% or ৳X off" quantity tiers per product
  - coupons: percent, fixed, or free delivery, with minimum order, cap, validity window, usage limit and per-phone limit
- **Delivery:** zones with a charge each (default: *ঢাকা সিটির ভেতরে* = the 50 Dhaka city thanas, *ঢাকা সিটির বাইরে* =
  everything else). The owner can reassign any district or thana and optionally set a free-delivery threshold.
- **Stock:** optional per variant, reserved atomically. It is never oversold and is returned on cancellation.
- **Limits:** a maximum quantity per order (per product, or a site-wide default).
- **Duplicate protection:** an idempotency key per submission means double-clicks and retries never create two orders.
  Orders from the same phone within a window (default 24h) are flagged for a check.
- **Order numbers:** `DBX-YYYYMMDD-NNNN` by Bangladesh date, allocated atomically.
- **Other:** rate limits on ordering, price quotes, coupon guessing and admin login. The owner can pause ordering with a
  message (holidays).

**Admin panel (`/admin`, English)**
- **Dashboard:** today's orders and revenue (Bangladesh time), counts by status, warnings (Sheets not configured, sync
  failures, ৳0 delivery charges).
- **Orders:**
  - search by order number, name or phone (any format)
  - filter by status, sheet sync status, date range, or flagged
  - CSV export of the filtered list
- **Order detail:**
  - call or WhatsApp the customer
  - change status: Pending → On Hold → Confirmed → Processing → Shipped → Delivered / Cancelled (cancelling returns stock and coupon use)
  - internal notes and full history
  - Google Sheet sync status with a **Retry sync** button
- **Products:** images (upload, reorder, alt text), variants (price, previous price, stock, SKU), quantity discounts,
  benefits, details, product FAQ, SEO, publish status, featured flag.
- **Other sections:**
  - Categories
  - Coupons
  - Reviews (genuine customer reviews only, optional screenshot)
  - Delivery zones and coverage
  - Site settings: ordering on/off, cash on delivery on/off, gift wrapping price, low-stock alert level, contact
    numbers, announcement, home headline, "Why Deenbox", FAQ, return policy
  - Sales report: revenue, orders, average order, items sold, revenue per day, top products, orders by status
  - Users (Owner / Staff roles)
  - My account (change password)
- **Roles:** Staff can use the dashboard, orders and their own account. Everything else is Owner-only.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) with TypeScript |
| Styling | Tailwind CSS v4, fonts Hind Siliguri + Noto Serif Bengali (self-hosted via `next/font`) |
| Database | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) |
| Validation | Zod 4, with the same schemas on the client and server |
| Auth | Database sessions (hashed tokens, HTTP-only cookies), bcrypt password hashes |
| Google Sheets | Sheets REST API with a service account (JWT signed server-side) |
| Images | `sharp` (resize to 1600px, WebP, strip metadata), local disk or Cloudinary |
| Tests | Vitest (unit + integration against a real test database), Playwright (end-to-end) |

## Project structure

```text
app/
  (store)/                 storefront: /, /products, /products/[slug], /checkout, /order/[token], /policy
  admin/login/             sign-in page + login/logout actions
  admin/(panel)/           admin pages (dashboard, orders, products, categories, coupons, reviews,
                           delivery, settings, users, account) and their server actions
  api/orders/              POST (place order), GET (admin list), [id] GET/PATCH, [id]/sync-google-sheet, export, sync-pending
  api/checkout/quote/      live price quote for the order summary
  api/admin/uploads/       image upload (owner)
  api/cron/sheets-sync/    optional scheduled Google Sheet catch-up
  media/[...path]/         serves locally stored images
components/
  store/ product/ checkout/ cart/   storefront UI
  admin/                            admin UI kit, product form, order actions
config/                    brand constants (site.ts) and order statuses (order.ts)
data/bd-locations.json     divisions, districts, upazilas, Dhaka city thanas
lib/
  pricing.ts               pure pricing engine
  orders/                  cart loading, coupons, quotes, order creation, admin operations
  google-sheets/           REST client, column mapping, sync (lease + version protocol)
  auth/                    passwords, sessions, guards
  storage/                 image processing and storage drivers
  settings.ts catalog.ts   admin-editable settings; cached storefront queries
prisma/                    schema, migrations, seed scripts
scripts/                   create-admin, remove-demo
tests/                     unit/, integration/, e2e/
```

Product information does **not** live in code. Everything a shop owner changes (products, prices, discounts, delivery
charges, FAQ, contact details) is edited in the admin panel and stored in the database. Only brand constants (name,
tagline, order-number prefix) are in `config/site.ts`.

## Installation

Requirements: **Node.js 22.12+** and **PostgreSQL 14+**.

```bash
npm install          # also runs `prisma generate`
cp .env.example .env # then fill in the values (see below)
npm run db:deploy    # create tables
npm run db:seed      # delivery zones + first owner account
npm run dev          # http://localhost:3000
```

Optional demo data for trying the site locally. It adds clearly labelled "[ডেমো]" products with "DEMO IMAGE"
placeholders and a `DEMO10` coupon:

```bash
npm run db:seed:demo     # add
npm run db:demo:remove   # remove before going live
```

Useful scripts:

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | develop / production build / run production build |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm test` | unit + integration tests (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright end-to-end tests (see [Testing](#testing)) |
| `npm run db:migrate` | create a new migration after editing `prisma/schema.prisma` (development) |
| `npm run db:deploy` | apply migrations (production) |
| `npm run db:studio` | browse the database |
| `npm run admin:create` | create an admin or reset a password |
| `npm run db:start` / `db:stop` | start/stop the project-local PostgreSQL on port 5433 (this development machine) |

## Environment variables

All variables are documented in [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_SECRET` | yes | 32+ random characters; used to hash customer IPs for rate limiting |
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | public URL for canonical links, sitemap and Open Graph |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | first setup | used only by `db:seed` / `admin:create` to create the first owner |
| `NEXT_PUBLIC_FACEBOOK_PAGE_URL` | no | fallback Facebook link (also editable in Site settings) |
| `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_TAB`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | recommended | Google Sheets copy of orders |
| `STORAGE_DRIVER`, `UPLOAD_DIR`, `CLOUDINARY_*` | no | image storage (`local` by default) |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | no | analytics; nothing loads when empty |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | no | new-order and low-stock alerts |
| `CRON_SECRET` | no | protects `/api/cron/sheets-sync` |
| `CLIENT_IP_HEADER`, `TRUSTED_PROXY_HOPS` | no | which proxy header holds the visitor IP for rate limiting (see [Deployment](#deployment)) |
| `TEST_DATABASE_URL`, `E2E_BASE_URL`, `DATABASE_POOL_SIZE`, `SEED_DELIVERY_*` | no | testing and tuning |

Secrets (database URL, Google key, Cloudinary secret, Telegram token) are only read on the server. None of them start
with `NEXT_PUBLIC_`, so none reach the browser. `.env` is git-ignored.

## Database

PostgreSQL is the primary store. Main tables:

- `Order`, with snapshot fields such as prices, names and address as ordered, and sheet sync state
- `OrderItem`, `OrderEvent` (history)
- `Product`, `ProductVariant`, `ProductImage`, `QuantityDiscount`, `Category`
- `Coupon`, `Review`, `DeliveryZone`, `DeliveryZoneArea`
- `AdminUser`, `AdminSession`
- `Setting`, `RateLimit`, `OrderCounter`

Indexes cover order number, mobile number, creation date, order status and sync status.

- **Any PostgreSQL works:** local, a VPS, or a hosted service such as Neon or Supabase. Put its URL in `DATABASE_URL`.
- **Migrations:** after pulling changes run `npm run db:deploy`. After editing the schema during development run
  `npm run db:migrate -- --name <change>`.
- **This development machine** runs a project-local PostgreSQL in `.local-postgres/` on port 5433 (user `deenbox`,
  password in `.env`). Start it with `npm run db:start`. It has two databases: `deenbox` (development) and
  `deenbox_test` (wiped by the integration tests).
- **Money** is stored as whole taka (integers). Times are stored in UTC and shown in Bangladesh time (UTC+6).

## Admin accounts

- The first **Owner** comes from `ADMIN_USERNAME`/`ADMIN_PASSWORD` via `npm run db:seed`, or at any time via:

  ```bash
  npm run admin:create -- <username> "<password>"          # owner (or reset password)
  npm run admin:create -- <username> "<password>" --staff  # staff account
  ```

  Passwords need at least 10 characters, with letters and numbers. After the first account exists, remove
  `ADMIN_PASSWORD` from `.env`.
- Add more people in Admin → **Users**. Use **Staff** for people who only handle orders and phone calls.
- **Sign-in:**
  - Sessions last 7 days, are stored hashed, and live in an HTTP-only, `SameSite=Lax` cookie (`Secure` in production).
  - Login is rate-limited so guessing is slow but nobody can lock you out:
    - A browser you have signed in with before remembers it (a signed cookie, 180 days) and gets its own allowance of 10
      attempts per 15 minutes, which other people's attempts do not use up.
    - Other browsers get 10 attempts per IP and 5 per username and IP per 15 minutes, plus at most 30 attempts per hour
      per username across all IPs.
    - Changing or resetting a password makes every browser unfamiliar again until its next successful sign-in.
  - Changing a password or deactivating a user signs that user out everywhere.
- **Forgot the owner password?** Run `npm run admin:create -- <username> "<new password>"` on the server.

## Google Sheets

Every order is saved to the database first and then copied to a Google Sheet, one row per order, with these columns:

`Order Number · Order Date · Customer Name · Mobile Number · Division · District · Area / Thana · Full Address ·
Product Name · Quantity · Unit Price · Subtotal · Delivery Charge · Discount · Total Amount · Order Status · Customer Note`

For orders with several products, the Product Name, Quantity and Unit Price cells list one item per line. Values are
written as plain values (`RAW`), so phone numbers keep their leading zero and customer text is never run as a formula.

### Setup (service account)

1. **Create the sheet.** Create a Google Sheet, e.g. "Deenbox Orders". Copy its ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`<THIS PART>`**`/edit`.
2. **Create a Google Cloud project.** Go to https://console.cloud.google.com → project picker → **New project**.
3. **Enable the API.** Go to **APIs & Services → Library** → search "Google Sheets API" → **Enable**.
4. **Create a service account.** Go to **APIs & Services → Credentials → Create credentials → Service account**. Give it a
   name (no roles needed) and finish.
5. **Create a key.** Open the service account → **Keys → Add key → Create new key → JSON**. A JSON file downloads; keep it
   private.
6. **Share the sheet.** Share the Google Sheet with the service account's email (`…@….iam.gserviceaccount.com`) as
   **Editor**.
7. **Configure `.env`** (or your hosting provider's environment settings):

   ```env
   GOOGLE_SHEET_ID="1AbC…"
   GOOGLE_SHEET_TAB="Orders"
   GOOGLE_SERVICE_ACCOUNT_EMAIL="deenbox-sheets@your-project.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE…\n-----END PRIVATE KEY-----\n"
   ```

   Copy `private_key` from the JSON exactly, keeping the `\n` sequences, and wrap it in double quotes.
8. **Restart and test.** Restart the app, place a test order, and check the sheet. The app creates the `Orders` tab and
   header row automatically if they are missing. The order's sync status in Admin → Orders should show **Synced**.

### How sync behaves

- **Sheet unavailable:** the customer still gets their confirmation, because the order is already in the database. The
  order is marked **Failed**, the error is stored, and the dashboard shows a warning.
- **Retry:** use **Retry sync** on an order, or **Sync pending to Sheet** on the Orders page.
  - Before writing, the app looks up the order number in column A. An existing row is updated instead of duplicated, even
    if an earlier attempt crashed half-way.
  - Already-synced, up-to-date orders are left untouched.
- **Status changes** made in the admin update the same row.
- **Concurrency:** a short lease plus a version number means concurrent syncs never write the same order twice, and a
  status change during a sync is never lost.
- **Optional scheduled catch-up:** set `CRON_SECRET` and call `GET /api/cron/sheets-sync` with
  `Authorization: Bearer <CRON_SECRET>` every few minutes, e.g. from Vercel Cron or a server crontab.
- **Do not reorder or rename column A** ("Order Number") in the sheet. Adding your own columns to the right is fine.

## Images

- Uploads are checked by decoding the image, not by file name. They are auto-rotated, resized to at most 1600px and saved
  as WebP. EXIF/GPS data is removed.
- `STORAGE_DRIVER=local` (default) saves under `UPLOAD_DIR` (`./storage/uploads`) and serves files at `/media/...`. This
  works on a VPS or any server with a persistent disk; back that folder up.
- `STORAGE_DRIVER=cloudinary` is needed on serverless hosting (e.g. Vercel), where the disk is temporary. Set
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
  - `CLOUDINARY_CLOUD_NAME` must be set when building **and** when running.
  - Product images are only optimised from that account's `/image/upload/` path; images from other Cloudinary
    accounts are refused.
  - If you move away from Cloudinary, keep `CLOUDINARY_CLOUD_NAME` set while old images still point there.
- Product pages use `next/image` (responsive sizes, lazy loading, AVIF/WebP).

## Analytics & notifications

- **Google Analytics 4** (`NEXT_PUBLIC_GA_ID`) and **Meta Pixel** (`NEXT_PUBLIC_META_PIXEL_ID`) load after the page becomes
  interactive, and only when set.
- **Tracked events:**
  - page view (not on order confirmation pages)
  - hero/CTA click
  - product view
  - add to cart
  - order form started (`begin_checkout` / `InitiateCheckout`)
  - order form submitted
  - order success (`purchase` / `Purchase`, with value in BDT and the order number as event id)
- **Order confirmation pages are private.** `/order/…` pages are secret links (they show the customer's name, phone and
  address), so GA4 and the Meta Pixel are never loaded on them.
  - With analytics configured, opening an order page from the shop, or leaving one, is a full page load.
  - The site sends its own page views, and the Meta Pixel's automatic events (button clicks, microdata) are off.
- **Recommended GA4 setting:** Admin → Data streams → your web stream → Enhanced measurement → ⚙, turn off "Page changes
  based on browser history events". Otherwise GA counts client-side page changes twice.
- **Telegram:** set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to get a message for every new order, and one when an
  order takes a product to the low-stock level (Admin → Site settings). A failed alert never affects the order.

## Testing

```bash
npm run typecheck && npm run lint
npm test                 # unit + integration (Vitest)
```

- **Unit tests:** phone normalisation, pricing engine, Dhaka dates, locations, delivery zones.
- **Integration tests:** run against a real PostgreSQL named by `TEST_DATABASE_URL`. **That database is wiped**, so never
  point it at real data. They cover:
  - order creation with server-side prices
  - idempotency under concurrent double-submits
  - unique order numbers under concurrency
  - no overselling
  - coupon limits, flags, store closed, free delivery
  - cancel/restore bookkeeping, search
  - Google Sheet sync with an in-memory sheet: success, outage then retry, crash recovery without duplicates, status
    updates, racing syncs, not-configured
  - rate limiting, passwords, CSV escaping

**End-to-end tests** (`npm run test:e2e`, Playwright) drive a real browser against a running dev server with demo data.
They cover:
- Bangla validation errors
- a full order from a product page (including a double click)
- admin login → find order → confirm → CSV export

```bash
npx playwright install --only-shell chromium   # one-time: Playwright's headless Chromium shell only
npm run dev                                     # in another terminal (with demo data loaded)
npm run test:e2e
```

> ⚠️ **Windows: only the headless Chromium shell.** Full Chrome builds from version 153 check whether the Windows account
> has a blank password. On the first tab of every fresh browser profile they call `LogonUser` with an empty password.
> "Full Chrome builds" means the installed Google Chrome or Edge (`channel: "chrome"`/`"msedge"`), Playwright's
> `channel: "chromium"`, and any headed, `--debug`, `--ui` or `PWDEBUG` run.
>
> On an account with a password, every test-browser launch becomes a failed Windows logon (Security event 4625 from
> `chrome.exe`). Ten of them within 10 minutes lock the Windows account; this happened while building this project.
>
> Playwright's headless shell (`chrome-headless-shell.exe`) does not contain that code.
>
> - `playwright.config.ts` uses the headless shell, and `tests/e2e/global-setup.ts` refuses any channel, headed run or
>   `PWDEBUG` on Windows.
> - Do not run a plain `npx playwright install`, which also downloads full Chrome for Testing.
> - The same applies to other browser automation on this PC, such as a Playwright MCP server driving the installed Chrome.

## Deployment

The app needs a Node.js server (or serverless functions) plus PostgreSQL. Two common setups:

**A. VPS (e.g. a Bangladeshi or international VPS with Ubuntu)**
1. Install Node.js 22+, PostgreSQL (or use a hosted database) and Nginx.
2. `git clone`, `npm ci`, create `.env` (`NEXT_PUBLIC_SITE_URL=https://your-domain`), then `npm run db:deploy`,
   `npm run db:seed`, `npm run build`.
3. Run `npm start` under a process manager (pm2 or systemd) on port 3000.
4. Put Nginx in front with HTTPS (Let's Encrypt). Forward the client IP with
   `proxy_set_header X-Real-IP $remote_addr;` and `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
   Rate limiting relies on these headers.
   - Rate limits use the visitor's IP from a header your proxy **overwrites**. The default (`CLIENT_IP_HEADER` empty)
     reads `X-Real-IP`, which is right for this Nginx setup and for Vercel.
   - **Caddy:** set `CLIENT_IP_HEADER=x-forwarded-for` (Caddy passes a client's own X-Real-IP through).
   - **Cloudflare in front of Nginx:** either let Nginx restore the visitor IP
     (`set_real_ip_from <each Cloudflare IP range>; real_ip_header CF-Connecting-IP;`, see https://www.cloudflare.com/ips/)
     and keep the default, or set `CLIENT_IP_HEADER=cf-connecting-ip` and firewall the server so only Cloudflare can
     reach it. Otherwise every visitor shares Cloudflare's IP.
   - **Cloudflare → Nginx using X-Forwarded-For:** `CLIENT_IP_HEADER=x-forwarded-for` and `TRUSTED_PROXY_HOPS=2`.
   - Never expose `npm start` directly to the internet: Next.js keeps the client's own X-Real-IP / X-Forwarded-For.
5. Keep `STORAGE_DRIVER=local` and back up `storage/uploads` and the database.

**B. Serverless (e.g. Vercel + Neon/Supabase + Cloudinary)**
1. Create a hosted PostgreSQL and set `DATABASE_URL`. Use the provider's pooled connection string.
2. Set `STORAGE_DRIVER=cloudinary` and the Cloudinary variables.
3. Add all environment variables in the hosting dashboard.
4. Build command `npm run build`. Run `npm run db:deploy` once per release against the production database.
5. Optionally add a cron job calling `/api/cron/sheets-sync` with `CRON_SECRET`.

Either way:
- Set `NEXT_PUBLIC_SITE_URL` to the real domain (used for canonical links and Facebook previews).
- Use HTTPS, which also enables secure cookies and HSTS.
- Never run `db:seed:demo` in production.
- Run `npm run db:deploy` before starting each new build, so the database has every migration (for example
  `order_item_stock_reserved`, which backfills existing orders).

## Security notes

- **Customers cannot change the amount they pay.** Prices, discounts, delivery and totals are calculated on the server
  from the database. The customer confirms the displayed total, and if it changed meanwhile the order is refused with a
  message instead of being saved at a different price.
- **Validation:**
  - The same Zod schemas run in the browser and on the server.
  - Free text is stripped of control characters.
  - All database access uses Prisma or parameterised SQL.
  - React escapes output, and JSON-LD is escaped.
- **Admin access:**
  - Every admin page, server action and admin API checks the session and role.
  - Admin API mutations also check the request origin (CSRF).
  - Server actions are protected by Next.js's own origin check.
- **Rate limits:** orders (per IP and per phone), price quotes, failed coupon attempts, admin login. They are stored in
  PostgreSQL, so they also work with several servers.
- **Headers:** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy, a permissions
  policy, and HSTS in production. Admin pages and order confirmations are `noindex`. Order pages also send
  `Referrer-Policy: strict-origin`, so their secret link never leaks as a referrer.
- **Public JSON endpoints** only accept `Content-Type: application/json` and stream the body with a 32 KB cap, so other
  websites cannot post orders through their visitors' browsers.
- **Error messages:** customers only see friendly Bangla messages. Technical errors are logged on the server, and Google
  errors are shown only to admins.
- **Google Sheets:** cells are written as `RAW` values, so formulas are never run. CSV exports neutralise `=`, `+`, `-`
  and `@` prefixes.

## Before going live

Business information still needed (enter it in the admin panel):

- [ ] Real products: names, photos, descriptions, variants and prices (Admin → Products). Then `npm run db:demo:remove`.
- [ ] Delivery charges for inside and outside Dhaka city, plus delivery times (Admin → Delivery).
- [ ] Contact phone, WhatsApp number, Messenger link, business address (Admin → Site settings).
- [ ] Cash on delivery: if customers pay on arrival, turn it on (Admin → Site settings). The home page and product pages
      then say so; while it is off they never mention it.
- [ ] FAQ answers: Cash on Delivery, return/exchange, delivery areas. Unanswered questions stay hidden. Also add the return
      policy text.
- [ ] Genuine customer reviews, if any (Admin → Reviews).
- [ ] Google Sheet connected and a test order confirmed in the sheet.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain; analytics IDs (optional).
- [ ] A strong owner password; remove `ADMIN_PASSWORD` from the server environment.
