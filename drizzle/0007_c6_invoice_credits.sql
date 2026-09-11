ALTER TABLE invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_amount_cents_check;

ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_amount_cents_nonzero_check
  CHECK (amount_cents <> 0);
