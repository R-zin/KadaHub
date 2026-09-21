# KadaHub — E-Commerce Management System and AI

A full-stack multi-category marketplace with role-based interfaces for
**Customers, Sellers, Delivery Agents, and Administrators**, plus a stubbed
**AI Virtual Try-On** for supported clothing.

- **Frontend** — React 19 + TypeScript + Vite + Tailwind (this repo root)
- **Backend** — Node.js + Express REST API (`server/`)
- **Database** — PostgreSQL via **Supabase** (`pg` driver, plain-SQL migrations)
- **Auth** — JWT with role-based access control + sliding 15-min inactivity logout
- **Payments** — mock gateway (Stripe-test-mode style) behind a swappable interface
- **Notifications** — console driver now, email/SMS provider pluggable
- **AI Try-On** — real IDM-VTON model on [Modal](https://modal.com) behind
  `tryOnService.generatePreview(...)` (`TRYON_DRIVER=modal`), with a `mock`
  fallback for dev/tests. See `modal/README.md` to deploy.

---

## Repository layout

```
.
├── src/                  # React SPA (pages, components, services, context)
├── server/
│   ├── src/
│   │   ├── index.js      # entrypoint
│   │   ├── app.js        # express app assembly
│   │   ├── config.js
│   │   ├── db/           # pool, migrate.js, schema.sql, seed.js
│   │   ├── middleware/   # auth (JWT+RBAC), validate, errorHandler
│   │   ├── services/     # swappable drivers: payment, storage, tryon, notification
│   │   │                 # + domain services: authDomain, productService, orderService,
│   │   │                 #   cartService, returnService, tryOnDomain, adminService, ...
│   │   ├── controllers/
│   │   └── routes/
│   └── tests/            # auth / checkout / return core-flow tests
├── modal/                # IDM-VTON virtual try-on deployed on Modal (modal/tryon_app.py)
└── README.md
```

---

## Prerequisites

- Node.js 18+
- A **Supabase** project (or any PostgreSQL database). Get the connection string from
  *Supabase → Project Settings → Database → Connection string (URI)*.

---

## 1. Backend setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

- `DATABASE_URL` → your Supabase Postgres URI
  (e.g. `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`).
  The pooler/“Session” URI works well. TLS is enabled automatically for Supabase hosts.
- `JWT_SECRET` → a long random string.

Start the API — it creates the schema automatically on boot, and on a fresh/empty
database also loads the sample data:

```bash
npm run dev       # http://localhost:4000  (health: /api/health)
```

On startup the server applies `server/src/db/schema.sql` (idempotent, safe on an
existing Supabase project) and seeds one user per role + 8 categories + 55 products
+ 2 sample orders **only if the `users` table is empty**. Control it with:

| Variable        | Effect                                                        |
|-----------------|---------------------------------------------------------------|
| `SEED_ON_INIT`  | `true` = always seed on boot · `false` = schema only          |
| `DB_INIT`       | `false` = skip all DB initialization at startup               |

You can also run the steps manually (useful for CI or a reset):

```bash
npm run migrate   # applies server/src/db/schema.sql
npm run seed      # truncates + reloads the demo data
```

### Demo logins (password `password123`)

| Role     | Email              |
|----------|--------------------|
| Customer | customer@demo.com  |
| Seller   | seller@demo.com    |
| Delivery | delivery@demo.com  |
| Admin    | admin@demo.com     |

---

## 2. Frontend setup

In a second terminal, from the repo root:

```bash
npm install
npm run dev       # Vite dev server, usually http://127.0.0.1:5173
```

The SPA calls the API at the base URL in `src/services/api.ts`
(default `http://localhost:4000/api`). Set `VITE_API_URL` in a root `.env`
to override.

---

## 3. Tests

```bash
cd server
cp .env.example .env    # point DATABASE_URL at a SEPARATE test database
npm run migrate
npm test                # node --test tests/  (auth, checkout, return flows)
```

> The test suite truncates the domain tables — never run it against production data.

---

## Swappable service interfaces

Each cross-cutting concern is isolated behind a driver selected by env var, so a real
provider can replace the dev stub without touching callers:

| Concern        | Interface (`server/src/services/`) | Dev driver | Swap in via |
|----------------|------------------------------------|------------|-------------|
| Payments       | `paymentService.charge/refund`     | `mock`     | `PAYMENT_DRIVER` |
| File storage   | `storageService.save`              | `local`    | `STORAGE_DRIVER` |
| Notifications  | `notificationService.notify`       | `console`  | `NOTIFICATION_DRIVER` |
| AI Try-On      | `tryOnService.generatePreview`     | `mock`     | `TRYON_DRIVER` (`modal` = IDM-VTON on Modal, see `modal/README.md`) |

---

## Security notes

- Passwords hashed with **bcrypt**; never logged.
- JWT auth on all private routes; **RBAC** enforced server-side per route.
- Sessions use a **sliding expiration**: each authenticated response returns an
  `X-Refresh-Token`; after 15 minutes of inactivity the token expires.
- Central error handler returns user-friendly messages and never leaks stack traces.
- `helmet` security headers, CORS restricted to `CLIENT_ORIGIN`, rate-limited auth
  endpoints, and parameterized queries throughout (no string-concatenated SQL).
- HTTPS redirect enforced in production (`NODE_ENV=production` behind a proxy).
