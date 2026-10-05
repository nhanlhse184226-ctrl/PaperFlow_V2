ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','ADMIN'));
ALTER TABLE users ADD COLUMN google_subject TEXT;
CREATE UNIQUE INDEX users_google_subject_unique ON users(google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE billing_orders (
  id TEXT PRIMARY KEY,
  order_code BIGINT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  status TEXT NOT NULL CHECK(status IN ('PENDING','PAID','CANCELLED','EXPIRED')),
  payment_link_id TEXT,
  checkout_url TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  provider_reference TEXT
);
CREATE INDEX billing_orders_user_created_idx ON billing_orders(user_id, created_at DESC);
CREATE INDEX billing_orders_status_created_idx ON billing_orders(status, created_at DESC);
