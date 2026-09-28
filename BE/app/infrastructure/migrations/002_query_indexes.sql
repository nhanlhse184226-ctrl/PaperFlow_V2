CREATE INDEX evidence_source ON evidence(source_id);
CREATE INDEX drafts_project ON drafts(project_id);
CREATE INDEX claims_draft ON claims(draft_id);
CREATE INDEX matches_evidence ON matches(evidence_id);
CREATE INDEX sessions_expiry ON sessions(expires);
