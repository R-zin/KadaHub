# Testing Guide

How to verify the E-Commerce Management System (KadaHub) — automated tests, manual end-to-end flows, and raw API checks.

---

## 1. Prerequisites

- **Node.js 18+** (developed on Node 26)
- **PostgreSQL** — either a local instance (Homebrew `postgresql@16` on macOS) or a **Supabase** project
- Two terminals (one for the API, one for the frontend)

### Setup

```bash
# --- Backend ---
cd server
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET (see below)

npm run migrate   # create tables
npm run seed      # demo users, categories, products, orders
npm run dev       # API on http://localhost:4000

# --- Frontend (new terminal, repo root) ---
npm install
npm run dev       # SPA on http://localhost:5173
```

### Required `server/.env` values

| Variable | Local dev | Supabase |
|---|---|---|
| `DATABASE_URL` | `postgresql://<you>@localhost:5432/kadahub` | `postgresql://postgres:<pw>@<host>.supabase.co:5432/postgres` |
| `JWT_SECRET` | any long random string | same |
| `DB_SSL` | `false` (local) | `true` (Supabase requires TLS) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | your deployed frontend URL |

> Tests **truncate the database**, so never run `npm test` against a database you care about. Use a dedicated test DB.

---

## 2. Automated backend tests

```bash
cd server
npm test
```

Uses `node:test` against an ephemeral server. **Expected: 11/11 pass.**

| Suite | Covers |
|---|---|
| `auth.test.js` | register (201), duplicate email (409), login ok / wrong password (401), `/auth/me` with & without token, RBAC (customer→admin route = 403) |
| `checkout.test.js` | add-to-cart → checkout creates order + payment + delivery, stock decremented, cart cleared; payment-decline rolls everything back; oversell blocked (409) |
| `return.test.js` | customer requests return (201); admin approves → refund recorded + stock restored; customer cannot approve (403) |

Run one file: `node --test tests/checkout.test.js`

---

## 3. Frontend checks

```bash
# repo root
node node_modules/typescript/bin/tsc -b   # type-check (no emit)
node node_modules/vite/bin/vite.js build  # production build → dist/
```

> If `npm run build` fails with a Rollup `MODULE_NOT_FOUND`, your `node_modules` was copied from another OS — run `npm install` (or `npm install --no-save @rollup/rollup-<platform>`) to fetch the right native binary.

---

## 4. Manual end-to-end flows (browser)

Log in at `http://localhost:5173/login`. All demo accounts use password **`password123`**.

| Role | Email |
|---|---|
| Customer | `customer@demo.com` |
| Seller | `seller@demo.com` |
| Delivery | `delivery@demo.com` |
| Admin | `admin@demo.com` |

### Customer
1. Browse `/products`, use the search bar (try `shirt`) and category filters.
2. Open a product → **Add to Cart** → open `/cart` → change quantity / remove.
3. **Wishlist**: click the heart on a product → check `/wishlist`.
4. **Checkout** (`/checkout`): walk Address → Delivery → Payment → Review → **Pay and Place Order** → confirmation shows an `EC#####` order number.
5. **Orders** (`/orders`): the new order appears as *Payment Confirmed*.

### Virtual Try-On (SRS step 10)
1. Open a **Clothing** product that shows the *Virtual Try-On Available* badge (e.g. a t-shirt) → **Try It On**.
2. **Upload Image** (a real photo) or **Use Camera** (loads a stock portrait), pick a size and color.
3. **Generate Preview** → after a short simulated delay the preview appears.
4. **Save Result** → it shows under *Saved Try-Ons* on the Account page. (Preview is a **mock**: it returns the product image. No real ML.)

### Seller (`seller@demo.com` → `/seller`)
1. **Add Product**: fill the form (category, subcategory, price, stock) → it appears in the catalog.
2. **Inventory**: edit a product's stock inline → badge flips (Healthy / Low ≤20 / Out).
3. **Orders / Reports**: see orders containing your products and per-category counts.

### Delivery (`delivery@demo.com` → `/delivery`)
1. See orders auto-assigned at checkout.
2. Click **Update Status** to advance along the timeline (Processing → Dispatched → Out for Delivery → Delivered). Disabled once *Delivered*.

### Admin (`admin@demo.com` → `/admin`)
1. **Dashboard**: revenue / orders / users / sellers / low-stock / pending-returns cards.
2. **Users**: deactivate / reactivate an account.
3. **Returns**: **Approve & Refund** (issues mock refund + restocks) or **Reject** a requested return.
4. **Transactions / Reports**: payment ledger and 7-day sales + inventory-by-category charts.

### Session timeout
The JWT expires after **15 minutes of inactivity**. Each authenticated response returns an `X-Refresh-Token` that the client silently adopts, so you stay logged in while active but are logged out (and redirected to login) after 15 idle minutes.

---

## 5. API smoke test (curl)

With the server running:

```bash
# health
curl http://localhost:4000/api/health

# search (relevant, limited)
curl "http://localhost:4000/api/products?q=shirt&limit=3"

# login → token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@demo.com","password":"password123"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

# add to cart
curl -X POST http://localhost:4000/api/cart/items \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"productId":"2","quantity":1}'

# checkout
curl -X POST http://localhost:4000/api/orders/checkout \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"address":{"name":"Maya","line1":"42 Market St","city":"SF","region":"CA","postalCode":"94105"}}'

# admin stats
ATOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@demo.com","password":"password123"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl http://localhost:4000/api/admin/stats -H "authorization: Bearer $ATOKEN"
```

---

## 6. Deterministic test hooks

- **Payment failure**: the mock gateway declines any charge whose amount (in cents) ends in **`.99`** — e.g. make the cart total end in `.99` to exercise the rollback path.
- **Oversell**: request more of a product than its `stock` → `409` "not have enough stock".
- **RBAC**: call an admin/seller endpoint with a customer token → `403`.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `500` on register/login | `DATABASE_URL` wrong or DB not migrated — run `npm run migrate` |
| Login works but every request `401 "Session expired"` | System clock skew, or `JWT_SECRET` changed after the token was issued — log in again |
| `Route not found` on cart | cart endpoints live under `/api/cart/items` (POST/PATCH/DELETE) |
| Supabase connection error | set `DB_SSL=true` and use the `postgresql://...pooler...` URI |
| Search returns everything | ensure you're passing `q` (or `search`) — both are accepted |
| Rollup/esbuild `MODULE_NOT_FOUND` on build | `node_modules` copied from another OS → `npm install` fresh |

---

## 8. Continuous Integration

Every push/PR runs the same checks automatically — see **CI** below (`.github/workflows/ci.yml`): backend migrate + full test suite against a Postgres service, plus frontend type-check and production build.
