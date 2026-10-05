CREATE UNIQUE INDEX billing_orders_one_pending_per_project ON billing_orders(project_id) WHERE status='PENDING' AND project_id IS NOT NULL;
