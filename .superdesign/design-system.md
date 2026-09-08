# Design System — E-Commerce Management System

## 1. Product context

Web-based marketplace platform (from the SRS). Users and what they do:

- **Customer** (primary focus of this design) — browse & search a catalog, open product details,
  add to cart, check out with secure payment, track orders, request returns, and use the
  **AI Virtual Try-On** for supported clothing/accessories.
- **Seller** — manage listings, inventory, orders; upload images to enable Try-On.
- **Delivery agent** — view and update deliveries.
- **Admin** — users, products, transactions, reports.

Signature feature: **AI Virtual Try-On**. Products that support it carry a clear
"Virtual Try-On Available" marker and a "Try On" action. Treat this as the product's
differentiator — give it elegant presence, not gimmick.

### Design goals (from the SRS, non-functional)
- Simplify online shopping; reduce purchase friction (target: checkout in ≤ 5 steps).
- Trustworthy, secure, legible. Clear navigation, confirmation dialogs, friendly error states.
- Responsive across desktop / tablet / mobile; fast and uncluttered load.

## 2. Styling — "Minimalist Editorial"

A clean, high-end e-commerce look: lots of whitespace, crisp type, one ink color, one
primary action style. Product imagery and typography carry the design — no heavy chrome,
no gradients-of-many-colors, no drop-shadow clutter, no decorative fonts.

### Typography
- **Display / headings:** `Instrument Serif`, weight 400.
  - H1 ~64–80px (mobile ~44–48px), line-height ~1.0, letter-spacing −2px to −2.5px.
  - H2 ~40px, H3 ~24px, all serif, tight tracking.
- **Body & UI:** `Inter`, sans-serif. 400 for copy, 500 for UI labels/buttons.
  - Body 16–18px, secondary/nav/buttons 14px, captions/labels 12px (letter-spacing ~0.02em).
- Use `<em>` / case sparingly for editorial emphasis on key words.

### Color palette
- Background: `#ffffff` (white); subtle section alt: `#f7f7f5` / `#fafafa`.
- Primary text: `#0f172a` (deep slate/ink).
- Muted text: `hsl(215 25% 32%)`; faint/borders: `hsl(220 13% 91%)`.
- Primary action: **black `#000000` button, white `#ffffff` text.**
- Accent: single restrained ink/navy for links and focus (same family as primary text — no brand rainbow).
- Status (success/info/warning/danger): quiet, desaturated tints used only where semantic
  (order status, stock, payment) — thin text/dots, not loud fills.

### Layout & spacing
- Max content width **1200–1280px**, generous gutters (~32px desktop), centered.
- Grid-based: 12-col mental model; catalog uses a clean product grid (3–4 up on desktop).
- Whitespace is the primary separator; hairline 1px borders (`#ececea`) for structure,
  8–12px radii on cards, 0–2px soft shadows only on floating elements (modals, sticky nav).
- 8px spacing scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96).

### Components
- **Pill primary button:** border-radius 9999px, black bg, white text.
  Padding ~10–12px 24px; hero/CTA up to ~16–20px 48–56px.
- **Secondary/ghost button:** transparent bg, 1px `#0f172a`/ink border or underline text, ink text.
- **Product card:** image (4:5 or 1:1, soft gray `#f2f1ef` backdrop), name (Inter 14–16px),
  price (ink, 500), optional subtle category; "Virtual Try-On Available" shown as a small dot/label.
- **Nav:** minimal top bar — brand (Instrument Serif) left, category/search center, cart/account right.
  Sticky, white, hairline bottom border.
- Price, quantities, SKUs in Inter tabular numerals.
- Forms: 1px hairline inputs, generous padding, clear focus ring (ink), inline error text.

### Motion
- Entrance: `fade-rise` — `opacity 0→1` + `translateY(24px→0)`, 0.8s ease-out, staggered 0.2s.
- Hover on primary buttons: subtle `scale(1.03)`, 200–300ms ease-in-out. Keep restrained.
- Product grid cards: gentle image zoom or lift on hover; nothing bouncy.

### Imagery
- Product photos: consistent aspect, soft neutral backdrop, centered. No loud lifestyle montages.
- Placeholder image blocks are fine; keep them light neutral.

## 3. Key screens (customer core flow)
1. **Storefront / Home** — editorial hero, featured categories, product highlights.
2. **Catalog / Browse** — product grid + search + category filter; Try-On badge on supported items.
3. **Product Detail** — gallery, name/price/size-colour, "Try On" + add-to-cart, Try-On badge.
4. **Cart** — line items, quantity edit, remove, order summary, proceed to checkout.
5. **Checkout** — address, payment, review; single-column, ≤ 5 steps, secure-payment reassurance.

## 4. Hard rules for generation
- Use ONLY the fonts, colors, spacing, and component styles defined here.
- Do NOT introduce other fonts, colors, gradients, shadows, or decorative styles.
- Keep everything minimal, airy, and editorial. When in doubt: more whitespace, less chrome.
