# Tests

Core-flow tests use Node's built-in test runner (`node --test`) against a real
database pointed to by `DATABASE_URL` (use a **separate test database** — the
suite truncates domain tables).

Run them with:

```bash
cd server
cp .env.example .env        # set DATABASE_URL to a test database
npm run migrate
npm test
```

Suites:
- `auth.test.js` — register, login, wrong password, JWT `/me`, RBAC enforcement.
- `checkout.test.js` — add-to-cart → checkout → order creation, stock decrement, payment-failure path.
- `return.test.js` — return request → admin approve → refund → restock.

Each suite seeds the minimal fixtures it needs inside its own transaction-friendly
setup and cleans up after itself.
