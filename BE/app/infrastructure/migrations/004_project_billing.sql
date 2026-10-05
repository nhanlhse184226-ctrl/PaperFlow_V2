-- Existing projects remain grandfathered. Only newly created projects use plan limits.
ALTER TABLE projects ADD COLUMN billing_enforced INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_orders ADD COLUMN project_id TEXT;
ALTER TABLE billing_orders ADD COLUMN project_name TEXT;
CREATE INDEX billing_orders_project_status_idx ON billing_orders(project_id, status, created_at DESC);
