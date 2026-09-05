CREATE TYPE financial_profile_type AS ENUM ('person', 'business', 'dependent', 'other');

CREATE TABLE financial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type financial_profile_type NOT NULL DEFAULT 'person',
  color TEXT NOT NULL DEFAULT '#06b6d4',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX financial_profiles_workspace_name_unique ON financial_profiles (workspace_id, name);

INSERT INTO financial_profiles (workspace_id, name, type, color)
SELECT id, 'Pessoa Física', 'person', '#06b6d4' FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

ALTER TABLE wallets ADD COLUMN profile_id UUID REFERENCES financial_profiles(id) ON DELETE CASCADE;
ALTER TABLE account_categories ADD COLUMN profile_id UUID REFERENCES financial_profiles(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN profile_id UUID REFERENCES financial_profiles(id) ON DELETE RESTRICT;

-- O backfill precisa alcançar todos os workspaces existentes. A aplicação volta
-- a operar com FORCE RLS antes de a migration terminar.
ALTER TABLE wallets NO FORCE ROW LEVEL SECURITY;
ALTER TABLE account_categories NO FORCE ROW LEVEL SECURITY;
ALTER TABLE accounts NO FORCE ROW LEVEL SECURITY;

UPDATE wallets AS item SET profile_id = profile.id
FROM financial_profiles AS profile
WHERE profile.workspace_id = item.workspace_id AND profile.name = 'Pessoa Física';
UPDATE account_categories AS item SET profile_id = profile.id
FROM financial_profiles AS profile
WHERE profile.workspace_id = item.workspace_id AND profile.name = 'Pessoa Física';
UPDATE accounts AS item SET profile_id = profile.id
FROM financial_profiles AS profile
WHERE profile.workspace_id = item.workspace_id AND profile.name = 'Pessoa Física';

ALTER TABLE wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE account_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE wallets ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE account_categories ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN profile_id SET NOT NULL;

CREATE INDEX wallets_workspace_profile_idx ON wallets (workspace_id, profile_id);
CREATE INDEX account_categories_workspace_profile_idx ON account_categories (workspace_id, profile_id);
CREATE INDEX accounts_workspace_profile_idx ON accounts (workspace_id, profile_id);

ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON financial_profiles
  USING (workspace_id = current_workspace_id())
  WITH CHECK (workspace_id = current_workspace_id());
