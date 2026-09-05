CREATE TYPE workspace_type AS ENUM ('personal', 'shared', 'business');
CREATE TYPE membership_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE identity_provider AS ENUM ('discord', 'telegram', 'whatsapp');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type workspace_type NOT NULL DEFAULT 'personal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'owner',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workspace_memberships_user_workspace_unique ON workspace_memberships (user_id, workspace_id);
CREATE UNIQUE INDEX workspace_memberships_one_default_per_user ON workspace_memberships (user_id) WHERE is_default;

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_sessions_token_hash_unique ON user_sessions (token_hash);

CREATE TABLE external_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider identity_provider NOT NULL,
  external_user_id TEXT NOT NULL,
  conversation_id TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX external_identities_provider_user_unique ON external_identities (provider, external_user_id);
CREATE UNIQUE INDEX external_identities_user_provider_unique ON external_identities (user_id, provider);

CREATE TABLE identity_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider identity_provider NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX identity_link_codes_hash_unique ON identity_link_codes (code_hash);

INSERT INTO users (id, name, email)
VALUES ('00000000-0000-4000-8000-000000000001', 'Administrador', 'admin@money-manager.local');
INSERT INTO workspaces (id, name, type)
VALUES ('00000000-0000-4000-8000-000000000001', 'Pessoal', 'personal');
INSERT INTO workspace_memberships (user_id, workspace_id, role, is_default)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner', true);

ALTER TABLE wallets ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE account_categories ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE import_batches ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE account_occurrences ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE account_occurrences ADD COLUMN updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invoice_items ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notification_deliveries ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE assistant_sessions ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE assistant_sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assistant_commands ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE assistant_commands ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE import_issues ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

UPDATE wallets SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE account_categories SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE accounts SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE import_batches SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE account_occurrences SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE invoice_items SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE notification_deliveries SET workspace_id = '00000000-0000-4000-8000-000000000001';
UPDATE assistant_sessions SET workspace_id = '00000000-0000-4000-8000-000000000001', user_id = '00000000-0000-4000-8000-000000000001';
UPDATE assistant_commands SET workspace_id = '00000000-0000-4000-8000-000000000001', user_id = '00000000-0000-4000-8000-000000000001';
UPDATE import_issues SET workspace_id = '00000000-0000-4000-8000-000000000001';

ALTER TABLE wallets ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE account_categories ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE import_batches ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE account_occurrences ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE invoice_items ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE assistant_sessions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE assistant_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE assistant_commands ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE assistant_commands ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE import_issues ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE app_settings ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE app_settings SET workspace_id = '00000000-0000-4000-8000-000000000001';
ALTER TABLE app_settings ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE app_settings DROP COLUMN id;
ALTER TABLE app_settings ADD PRIMARY KEY (workspace_id);

ALTER TABLE account_categories DROP CONSTRAINT account_categories_name_key;
CREATE UNIQUE INDEX account_categories_workspace_name_unique ON account_categories (workspace_id, name);
ALTER TABLE import_batches DROP CONSTRAINT import_batches_checksum_key;
CREATE UNIQUE INDEX import_batches_workspace_checksum_unique ON import_batches (workspace_id, checksum);
DROP INDEX assistant_sessions_identity_unique;
CREATE UNIQUE INDEX assistant_sessions_identity_unique ON assistant_sessions (workspace_id, channel, conversation_key, user_key);

CREATE OR REPLACE FUNCTION current_workspace_id() RETURNS UUID
LANGUAGE SQL STABLE AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '')::uuid
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'wallets', 'account_categories', 'accounts', 'import_batches',
    'account_occurrences', 'invoice_items', 'app_settings',
    'notification_deliveries', 'assistant_sessions', 'assistant_commands', 'import_issues'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY workspace_isolation ON %I USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id())',
      table_name
    );
  END LOOP;
END $$;
