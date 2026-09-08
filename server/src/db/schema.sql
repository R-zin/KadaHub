-- ============================================================================
-- KadaHub E-Commerce Management System — Database schema (PostgreSQL/Supabase)
-- Idempotent: uses IF NOT EXISTS so it can be re-run safely.
-- ============================================================================

BEGIN;

-- ----- users: RBAC identity -------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','seller','delivery','admin')),
  phone         VARCHAR(40),
  store_name    VARCHAR(120),                 -- seller storefront name
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----- categories -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(80)  NOT NULL,
  slug        VARCHAR(80)  NOT NULL UNIQUE,
  description VARCHAR(255),
  image       VARCHAR(500),
  icon        VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_subcategories (
  id          BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  UNIQUE (category_id, name)
);

-- ----- products -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                          BIGSERIAL PRIMARY KEY,
  seller_id                   BIGINT NOT NULL REFERENCES users(id),
  category_id                 BIGINT NOT NULL REFERENCES categories(id),
  subcategory                 VARCHAR(80),
  name                        VARCHAR(180) NOT NULL,
  description                 TEXT,
  price                       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  original_price              NUMERIC(10,2),
  discount                    SMALLINT DEFAULT 0,
  brand                       VARCHAR(120),
  rating                      NUMERIC(2,1) DEFAULT 0,
  review_count                INT DEFAULT 0,
  stock                       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  specifications              JSONB,
  tags                        JSONB,
  is_featured                 BOOLEAN DEFAULT FALSE,
  is_new                      BOOLEAN DEFAULT FALSE,
  is_best_seller              BOOLEAN DEFAULT FALSE,
  is_virtual_try_on_supported BOOLEAN DEFAULT FALSE,
  product_type                VARCHAR(80),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller   ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);
-- Keyword search over name/description/brand (kept current by a trigger below).
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE TABLE IF NOT EXISTS product_images (
  id                   BIGSERIAL PRIMARY KEY,
  product_id           BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url                  VARCHAR(500) NOT NULL,
  sort_order           SMALLINT DEFAULT 0,
  is_try_on_reference  BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_pimg_product ON product_images(product_id);

-- ----- addresses ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(40) DEFAULT 'Home',
  name        VARCHAR(120),
  phone       VARCHAR(40),
  line1       VARCHAR(180),
  city        VARCHAR(80),
  region      VARCHAR(80),
  postal_code VARCHAR(20),
  is_default  BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_addr_user ON addresses(user_id);

-- ----- cart & wishlist -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INT NOT NULL CHECK (quantity > 0),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ----- orders ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               BIGSERIAL PRIMARY KEY,
  order_number     VARCHAR(20) NOT NULL UNIQUE,
  customer_id      BIGINT NOT NULL REFERENCES users(id),
  status           VARCHAR(30) NOT NULL DEFAULT 'Order Placed'
                   CHECK (status IN ('Order Placed','Payment Confirmed','Processing',
                                     'Dispatched','Shipped','Out for Delivery',
                                     'Delivered','Cancelled')),
  subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ship_name        VARCHAR(120),
  ship_phone       VARCHAR(40),
  ship_line1       VARCHAR(180),
  ship_city        VARCHAR(80),
  ship_region      VARCHAR(80),
  ship_postal_code VARCHAR(20),
  placed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    BIGINT NOT NULL REFERENCES products(id),
  quantity      INT NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL,
  product_name  VARCHAR(180) NOT NULL,
  product_image VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS idx_oi_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_product ON order_items(product_id);

-- ----- payments (charges + refunds) ------------------------------------------
-- One charge and at most one refund per order -> unique on (order_id, type).
CREATE TABLE IF NOT EXISTS payments (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders(id),
  provider       VARCHAR(40) NOT NULL DEFAULT 'stripe_test',
  provider_ref   VARCHAR(120),
  amount         NUMERIC(10,2) NOT NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  type           VARCHAR(10) NOT NULL DEFAULT 'charge' CHECK (type IN ('charge','refund')),
  status         VARCHAR(20) NOT NULL DEFAULT 'Pending'
                 CHECK (status IN ('Pending','Paid','Failed','Refunded')),
  failure_reason VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, type)
);
CREATE INDEX IF NOT EXISTS idx_pay_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status);

-- ----- deliveries -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT NOT NULL UNIQUE REFERENCES orders(id),
  agent_id       BIGINT REFERENCES users(id),
  status         VARCHAR(30) NOT NULL DEFAULT 'Assigned'
                 CHECK (status IN ('Assigned','Dispatched','Shipped',
                                   'Out for Delivery','Delivered','Failed')),
  tracking_notes VARCHAR(255),
  assigned_at    TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_agent  ON deliveries(agent_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON deliveries(status);

-- ----- returns -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
  id                BIGSERIAL PRIMARY KEY,
  order_id          BIGINT NOT NULL REFERENCES orders(id),
  order_item_id     BIGINT REFERENCES order_items(id),
  product_id        BIGINT NOT NULL REFERENCES products(id),
  customer_id       BIGINT NOT NULL REFERENCES users(id),
  reason            VARCHAR(255) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'Requested'
                    CHECK (status IN ('Requested','Approved','Pickup Scheduled','Returned',
                                      'Refund Processing','Refunded','Rejected')),
  refund_payment_id BIGINT REFERENCES payments(id),
  restocked         BOOLEAN DEFAULT FALSE,
  reviewed_by       BIGINT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_status   ON returns(status);

-- ----- virtual try-on results ---------------------------------------------------
CREATE TABLE IF NOT EXISTS tryon_results (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id    BIGINT NOT NULL REFERENCES products(id),
  source_image  VARCHAR(500) NOT NULL,
  preview_image VARCHAR(500) NOT NULL,
  size          VARCHAR(10),
  color         VARCHAR(40),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tryon_user ON tryon_results(user_id);

-- ----- notifications --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    VARCHAR(255) NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ----- keep products.search_tsv in sync for keyword search ------------------------
CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    to_tsvector('english',
      coalesce(NEW.name,'') || ' ' ||
      coalesce(NEW.description,'') || ' ' ||
      coalesce(NEW.brand,'') || ' ' ||
      coalesce(NEW.subcategory,''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsv_products_update ON products;
CREATE TRIGGER tsv_products_update BEFORE INSERT OR UPDATE
  ON products FOR EACH ROW EXECUTE FUNCTION products_search_trigger();

COMMIT;
