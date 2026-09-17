\set ON_ERROR_STOP on

-- Executar somente em banco descartável após a migration 0010.
-- A role informada deve existir, não ser superuser e não possuir BYPASSRLS.
\if :{?app_role}
\else
  \set app_role money_manager
\endif

INSERT INTO public.users (id, name, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Schema Test', 'schema-test-1@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'Schema Test 2', 'schema-test-2@example.invalid');

INSERT INTO public.workspaces (id, name)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Schema Test A'),
  ('20000000-0000-0000-0000-000000000002', 'Schema Test B');

INSERT INTO public.workspace_memberships (user_id, workspace_id, role)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'owner');

INSERT INTO public.financial_profiles (id, workspace_id, name)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Profile A'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Profile B');

INSERT INTO finance.workspace_settings (workspace_id)
VALUES
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');

GRANT USAGE ON SCHEMA finance, ops TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finance, ops TO :"app_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, finance, ops TO :"app_role";

BEGIN;
SET ROLE :"app_role";
SET app.user_id = '10000000-0000-0000-0000-000000000001';
SET app.workspace_id = '20000000-0000-0000-0000-000000000001';

DO $test$
BEGIN
  IF (SELECT count(*) FROM finance.workspace_settings) <> 1 THEN
    RAISE EXCEPTION 'RLS returned rows from another workspace';
  END IF;
END
$test$;

DO $test$
BEGIN
  BEGIN
    INSERT INTO finance.ledger_accounts (
      id,
      workspace_id,
      profile_id,
      account_class,
      code,
      name
    ) VALUES (
      '40000000-0000-0000-0000-000000000099',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      'asset',
      'invalid-cross-workspace',
      'Invalid cross-workspace account'
    );

    RAISE EXCEPTION 'cross-workspace reference was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END
$test$;

INSERT INTO finance.ledger_accounts (
  id,
  workspace_id,
  profile_id,
  account_class,
  code,
  name
) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'asset',
    'asset.cash',
    'Cash'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'income',
    'income.salary',
    'Salary income'
  );

DO $test$
BEGIN
  BEGIN
    INSERT INTO finance.journal_entries (
      id,
      workspace_id,
      profile_id,
      status,
      entry_date,
      description
    ) VALUES (
      '50000000-0000-0000-0000-000000000099',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'posted',
      CURRENT_DATE,
      'Invalid unbalanced entry'
    );

    INSERT INTO finance.postings (
      workspace_id,
      journal_entry_id,
      ledger_account_id,
      amount_minor,
      base_amount_minor
    ) VALUES (
      '20000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000099',
      '40000000-0000-0000-0000-000000000001',
      10000,
      10000
    );

    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'unbalanced journal entry was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END
$test$;

SET CONSTRAINTS ALL DEFERRED;

INSERT INTO finance.journal_entries (
  id,
  workspace_id,
  profile_id,
  status,
  entry_date,
  description
) VALUES (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'posted',
  CURRENT_DATE,
  'Valid balanced entry'
);

INSERT INTO finance.postings (
  workspace_id,
  journal_entry_id,
  ledger_account_id,
  amount_minor,
  base_amount_minor
) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    10000,
    10000
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    -10000,
    -10000
  );

SET CONSTRAINTS ALL IMMEDIATE;

DO $test$
BEGIN
  IF (
    SELECT COALESCE(SUM(base_amount_minor), 1)
    FROM finance.postings
    WHERE journal_entry_id = '50000000-0000-0000-0000-000000000001'
  ) <> 0 THEN
    RAISE EXCEPTION 'balanced journal entry did not sum to zero';
  END IF;
END
$test$;

RESET app.workspace_id;

DO $test$
BEGIN
  IF (SELECT count(*) FROM finance.workspace_settings) <> 0 THEN
    RAISE EXCEPTION 'private rows are visible without workspace context';
  END IF;
END
$test$;

RESET ROLE;
COMMIT;

SELECT 'financial schema validation passed' AS result;
