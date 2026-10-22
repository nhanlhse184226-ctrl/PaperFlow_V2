ALTER TABLE users ADD COLUMN created_at TEXT;

CREATE TABLE web_analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK(event_name IN (
    'page_view','login','sign_up','project_create','source_upload','topic_check_complete',
    'evidence_matrix_open','essay_check_complete','begin_checkout'
  )),
  occurred_at TEXT NOT NULL
);
CREATE INDEX web_analytics_events_occurred_event_idx ON web_analytics_events(occurred_at DESC, event_name);
CREATE INDEX web_analytics_events_user_occurred_idx ON web_analytics_events(user_id, occurred_at DESC);
CREATE INDEX web_analytics_events_project_occurred_idx ON web_analytics_events(project_id, occurred_at DESC);
