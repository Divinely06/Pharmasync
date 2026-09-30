BEGIN;

CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items (sale_id, id);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON purchase_items (purchase_id, id);
CREATE INDEX IF NOT EXISTS inventory_transactions_date_idx ON inventory_transactions (occurred_at DESC);

COMMIT;