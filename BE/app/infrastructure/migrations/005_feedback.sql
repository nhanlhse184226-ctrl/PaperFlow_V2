CREATE TABLE feedback_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('AI','PRODUCT')),
    module TEXT,
    result_id TEXT,
    project_id TEXT,
    helpful INTEGER CHECK(helpful IN (0,1)),
    reason TEXT,
    product_type TEXT CHECK(product_type IN ('BUG','SUGGESTION','OTHER')),
    comment TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','REVIEWED','RESOLVED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX feedback_ai_target_unique
    ON feedback_items(user_id, module, result_id)
    WHERE kind='AI';
CREATE INDEX feedback_admin_list_idx ON feedback_items(kind, status, created_at DESC);
CREATE INDEX feedback_module_idx ON feedback_items(module, helpful);
