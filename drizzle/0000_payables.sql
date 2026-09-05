CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_nature AS ENUM ('fixed', 'variable', 'installment', 'one_off');
CREATE TYPE account_type AS ENUM ('regular', 'credit_card');
CREATE TYPE occurrence_declaration AS ENUM ('paid', 'no_charge');
CREATE TYPE expected_source AS ENUM ('manual', 'auto', 'import');

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE account_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES account_categories(id) ON DELETE RESTRICT,
  due_day INTEGER,
  planned_amount_cents BIGINT NOT NULL CHECK (planned_amount_cents >= 0),
  nature account_nature NOT NULL,
  account_type account_type NOT NULL DEFAULT 'regular',
  start_month DATE NOT NULL CHECK (date_trunc('month', start_month)::date = start_month),
  installments INTEGER CHECK (installments IS NULL OR installments > 0),
  archived_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  CHECK ((nature = 'installment' AND installments IS NOT NULL) OR (nature <> 'installment' AND installments IS NULL))
);

CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE account_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL CHECK (date_trunc('month', reference_month)::date = reference_month),
  expected_amount_cents BIGINT NOT NULL CHECK (expected_amount_cents >= 0),
  expected_source expected_source NOT NULL DEFAULT 'manual',
  declaration occurrence_declaration,
  paid_amount_cents BIGINT CHECK (paid_amount_cents IS NULL OR paid_amount_cents >= 0),
  paid_on DATE,
  legacy_payment_date_missing BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, reference_month),
  CHECK (
    (declaration IS NULL AND paid_amount_cents IS NULL AND paid_on IS NULL AND resolved_at IS NULL)
    OR (declaration = 'no_charge' AND paid_amount_cents IS NULL AND paid_on IS NULL AND resolved_at IS NOT NULL)
    OR (declaration = 'paid' AND paid_amount_cents IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES account_occurrences(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  due_soon_days INTEGER NOT NULL DEFAULT 5 CHECK (due_soon_days >= 0),
  inactive_after_months INTEGER NOT NULL DEFAULT 6 CHECK (inactive_after_months > 0),
  reminder_days_before INTEGER[] NOT NULL DEFAULT ARRAY[7, 1],
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'
);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES account_occurrences(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  sent_for_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL,
  UNIQUE (occurrence_id, rule, sent_for_date)
);

CREATE TABLE import_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  sheet TEXT NOT NULL,
  cell TEXT NOT NULL,
  raw_value TEXT,
  reason TEXT NOT NULL,
  resolved_at TIMESTAMPTZ
);

INSERT INTO app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
INSERT INTO wallets (name, color) SELECT 'Pessoal', '#06b6d4' WHERE NOT EXISTS (SELECT 1 FROM wallets);
INSERT INTO account_categories (name, sort_order) VALUES ('Importado', 0) ON CONFLICT DO NOTHING;
