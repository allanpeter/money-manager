CREATE TABLE financial_stores (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_stores FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON financial_stores
  USING (workspace_id = current_workspace_id())
  WITH CHECK (workspace_id = current_workspace_id());
