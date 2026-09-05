ALTER TYPE expected_source ADD VALUE IF NOT EXISTS 'assistant';

ALTER TABLE accounts
  ADD COLUMN closing_day INTEGER,
  ADD CONSTRAINT accounts_closing_day_check CHECK (closing_day IS NULL OR closing_day BETWEEN 1 AND 31);

ALTER TABLE invoice_items
  ADD COLUMN purchased_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN external_id TEXT,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX invoice_items_external_id_unique ON invoice_items (external_id);

CREATE TYPE assistant_command_status AS ENUM (
  'received',
  'pending',
  'confirmed',
  'executed',
  'rejected',
  'failed'
);

CREATE TABLE assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  conversation_key TEXT NOT NULL,
  user_key TEXT NOT NULL,
  pending_action JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX assistant_sessions_identity_unique
  ON assistant_sessions (channel, conversation_key, user_key);

CREATE TABLE assistant_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  status assistant_command_status NOT NULL DEFAULT 'received',
  interpreted_action JSONB,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX assistant_commands_message_unique
  ON assistant_commands (channel, external_message_id);

ALTER TABLE notification_deliveries
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'discord';

ALTER TABLE notification_deliveries
  DROP CONSTRAINT IF EXISTS notification_deliveries_occurrence_id_rule_sent_for_date_key;

CREATE UNIQUE INDEX notification_deliveries_once
  ON notification_deliveries (occurrence_id, channel, rule, sent_for_date);

UPDATE app_settings
SET reminder_days_before = array_append(reminder_days_before, 0)
WHERE NOT (0 = ANY(reminder_days_before));
