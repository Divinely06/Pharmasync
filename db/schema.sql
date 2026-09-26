CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PHARMACIST', 'CASHIER')),
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY, supplier_name TEXT NOT NULL, contact_person TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY, barcode TEXT NOT NULL UNIQUE, generic_name TEXT NOT NULL, brand_name TEXT NOT NULL, medicine_type TEXT NOT NULL, dosage_form TEXT NOT NULL, strength TEXT NOT NULL,
  prescription_required BOOLEAN NOT NULL DEFAULT false, description TEXT NOT NULL DEFAULT '', dosage_information TEXT NOT NULL DEFAULT '', precautions TEXT NOT NULL DEFAULT '', contraindications TEXT NOT NULL DEFAULT '', storage_information TEXT NOT NULL DEFAULT '', supplier_id TEXT REFERENCES suppliers(id),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0), reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0), expiration_date DATE NOT NULL, batch_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicine_batches (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  batch_number TEXT NOT NULL,
  expiration_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (medicine_id, batch_number)
);

INSERT INTO medicine_batches (id,medicine_id,batch_number,expiration_date,quantity)
SELECT 'batch-' || id,id,batch_number,expiration_date,quantity FROM medicines
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, cashier_id TEXT NOT NULL REFERENCES users(id), transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(), subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0), discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= subtotal), tax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0), total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0 AND total_amount = subtotal - discount + tax), payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'GCash', 'Maya', 'Card')), amount_received NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_received >= 0), change_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0), status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED', 'PENDING')), idempotency_key TEXT UNIQUE, CHECK (payment_method <> 'Cash' OR status <> 'COMPLETED' OR amount_received >= total_amount)
);

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check CHECK (status IN ('COMPLETED', 'VOIDED', 'PENDING'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_totals_check;
ALTER TABLE sales ADD CONSTRAINT sales_totals_check CHECK (discount <= subtotal AND total_amount = subtotal - discount + tax);
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash', 'GCash', 'Maya', 'Card'));
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cash_received_check;
ALTER TABLE sales ADD CONSTRAINT sales_cash_received_check CHECK (payment_method <> 'Cash' OR status <> 'COMPLETED' OR amount_received >= total_amount);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_number TEXT NOT NULL UNIQUE,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELLED')),
  created_by TEXT NOT NULL REFERENCES users(id)
);

UPDATE purchases SET status='RECEIVED' WHERE status='COMPLETED';
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELLED'));

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  batch_number TEXT NOT NULL,
  expiration_date DATE NOT NULL
);

ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_subtotal_check;
ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_subtotal_check CHECK (subtotal = quantity * unit_cost);

CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('CARD', 'E_WALLET')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED')),
  provider TEXT NOT NULL,
  provider_reference TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0 AND refund_amount <= amount),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0 AND refund_amount <= amount);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payment_records(id),
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED')),
  event_type TEXT NOT NULL,
  performed_by TEXT REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO payment_events (id,payment_id,previous_status,status,event_type,performed_by,metadata)
SELECT 'payment-event-migrated-' || p.id,p.id,NULL,p.status,'MIGRATED_ATTEMPT',s.cashier_id,'{}'::jsonb
FROM payment_records p JOIN sales s ON s.id=p.sale_id
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  file_name TEXT,
  file_format TEXT CHECK (file_format IS NULL OR file_format IN ('pg_dump-custom', 'logical-json-gzip')),
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  requested_by TEXT REFERENCES users(id),
  error_message TEXT
);

ALTER TABLE backup_history ADD COLUMN IF NOT EXISTS file_format TEXT CHECK (file_format IS NULL OR file_format IN ('pg_dump-custom', 'logical-json-gzip'));

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sales(id), medicine_id TEXT NOT NULL REFERENCES medicines(id), quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_subtotal_check;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_subtotal_check CHECK (subtotal = quantity * unit_price);

CREATE TABLE IF NOT EXISTS sale_item_batches (
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id),
  batch_id TEXT NOT NULL REFERENCES medicine_batches(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (sale_item_id, batch_id)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL REFERENCES medicines(id), transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'EXPIRED', 'DAMAGED')), quantity INTEGER NOT NULL, previous_quantity INTEGER NOT NULL, resulting_quantity INTEGER NOT NULL, reference_id TEXT NOT NULL, performed_by TEXT NOT NULL REFERENCES users(id), occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, success BOOLEAN NOT NULL
);

CREATE OR REPLACE FUNCTION pharmasync_prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION pharmasync_prevent_audit_mutation();

CREATE OR REPLACE FUNCTION pharmasync_guard_sale_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status OR (OLD.status = 'PENDING' AND NEW.status IN ('COMPLETED', 'VOIDED')) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid sale status transition from % to %', OLD.status, NEW.status USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS sale_status_transition_guard ON sales;
CREATE TRIGGER sale_status_transition_guard BEFORE UPDATE OF status ON sales FOR EACH ROW EXECUTE FUNCTION pharmasync_guard_sale_status_transition();

CREATE OR REPLACE FUNCTION pharmasync_guard_purchase_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status OR (OLD.status = 'PENDING' AND NEW.status IN ('RECEIVED', 'CANCELLED')) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid purchase status transition from % to %', OLD.status, NEW.status USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS purchase_status_transition_guard ON purchases;
CREATE TRIGGER purchase_status_transition_guard BEFORE UPDATE OF status ON purchases FOR EACH ROW EXECUTE FUNCTION pharmasync_guard_purchase_status_transition();

CREATE OR REPLACE FUNCTION pharmasync_guard_payment_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status
    OR (OLD.status = 'PENDING' AND NEW.status IN ('AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
    OR (OLD.status = 'AUTHORIZED' AND NEW.status IN ('PAID', 'FAILED', 'CANCELLED', 'EXPIRED'))
    OR (OLD.status = 'PAID' AND NEW.status = 'REFUNDED') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid payment status transition from % to %', OLD.status, NEW.status USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS payment_status_transition_guard ON payment_records;
CREATE TRIGGER payment_status_transition_guard BEFORE UPDATE OF status ON payment_records FOR EACH ROW EXECUTE FUNCTION pharmasync_guard_payment_status_transition();

CREATE INDEX IF NOT EXISTS medicines_search_idx ON medicines (generic_name, brand_name, barcode);
CREATE INDEX IF NOT EXISTS medicines_barcode_idx ON medicines (barcode);
CREATE INDEX IF NOT EXISTS medicines_expiration_idx ON medicines (expiration_date);
CREATE INDEX IF NOT EXISTS medicines_stock_idx ON medicines (quantity, reorder_level);
CREATE INDEX IF NOT EXISTS medicines_supplier_idx ON medicines (supplier_id);
CREATE INDEX IF NOT EXISTS medicine_batches_fefo_idx ON medicine_batches (medicine_id, expiration_date) WHERE quantity > 0;
CREATE INDEX IF NOT EXISTS sale_item_batches_batch_idx ON sale_item_batches (batch_id);
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales (transaction_date);
CREATE INDEX IF NOT EXISTS purchases_supplier_date_idx ON purchases (supplier_id, purchase_date);
CREATE INDEX IF NOT EXISTS payment_records_sale_idx ON payment_records (sale_id, created_at);
CREATE INDEX IF NOT EXISTS payment_events_payment_date_idx ON payment_events (payment_id, occurred_at);
CREATE INDEX IF NOT EXISTS audit_user_date_idx ON audit_logs (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS audit_date_idx ON audit_logs (occurred_at);