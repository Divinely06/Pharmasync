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

ALTER TABLE sessions ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN created_at SET DEFAULT now();
UPDATE sessions SET created_at = now() WHERE created_at IS NULL;

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

ALTER TABLE medicine_batches ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE medicine_batches ALTER COLUMN updated_at SET DEFAULT now();
UPDATE medicine_batches SET created_at = now() WHERE created_at IS NULL;
UPDATE medicine_batches SET updated_at = now() WHERE updated_at IS NULL;

INSERT INTO medicine_batches (id,medicine_id,batch_number,expiration_date,quantity)
SELECT 'batch-' || seed.id,seed.id,seed.batch_number,seed.expiration_date,seed.quantity
FROM (
  SELECT DISTINCT ON (id) id,batch_number,expiration_date,quantity
  FROM medicines
  ORDER BY id,created_at,ctid
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM medicine_batches existing WHERE existing.id='batch-' || seed.id)
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
  refund_status TEXT CHECK (refund_status IS NULL OR refund_status IN ('NONE','PENDING','SUCCEEDED','FAILED')),
  refund_provider_reference TEXT UNIQUE,
  refund_requested_amount NUMERIC(12,2) CHECK (refund_requested_amount IS NULL OR (refund_requested_amount >= 0 AND refund_requested_amount <= amount)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0 AND refund_amount <= amount);
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_status TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_provider_reference TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_requested_amount NUMERIC(12,2);

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
WHERE NOT EXISTS (SELECT 1 FROM payment_events existing WHERE existing.id='payment-event-migrated-' || p.id)
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

ALTER TABLE schema_migrations ALTER COLUMN applied_at SET DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_version_uidx ON schema_migrations (version);

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

UPDATE users SET status='INACTIVE' WHERE status IS NULL;
UPDATE suppliers SET status='INACTIVE' WHERE status IS NULL;
UPDATE medicines SET status='INACTIVE' WHERE status IS NULL;

WITH safe_ids AS (
  SELECT id FROM users WHERE id IS NOT NULL GROUP BY id
  HAVING count(*) > 1 AND count(DISTINCT (username,full_name,email,role)) = 1
), ranked AS (
  SELECT ctid,row_number() OVER (PARTITION BY id ORDER BY (status='ACTIVE') DESC,created_at ASC,ctid ASC) AS duplicate_rank
  FROM users WHERE id IN (SELECT id FROM safe_ids)
)
DELETE FROM users duplicate USING ranked WHERE duplicate.ctid=ranked.ctid AND ranked.duplicate_rank>1;

WITH safe_ids AS (
  SELECT id FROM suppliers WHERE id IS NOT NULL GROUP BY id
  HAVING count(*) > 1 AND count(DISTINCT (supplier_name,contact_person,phone,email,address)) = 1
), ranked AS (
  SELECT ctid,row_number() OVER (PARTITION BY id ORDER BY (status='ACTIVE') DESC,created_at ASC,ctid ASC) AS duplicate_rank
  FROM suppliers WHERE id IN (SELECT id FROM safe_ids)
)
DELETE FROM suppliers duplicate USING ranked WHERE duplicate.ctid=ranked.ctid AND ranked.duplicate_rank>1;

WITH safe_ids AS (
  SELECT id FROM medicines WHERE id IS NOT NULL GROUP BY id
  HAVING count(*) > 1 AND count(DISTINCT (barcode,generic_name,brand_name,medicine_type,dosage_form,strength,prescription_required,description,dosage_information,precautions,contraindications,storage_information,supplier_id,unit_price,reorder_level,expiration_date,batch_number)) = 1
), ranked AS (
  SELECT ctid,row_number() OVER (PARTITION BY id ORDER BY (status='ACTIVE') DESC,created_at ASC,ctid ASC) AS duplicate_rank
  FROM medicines WHERE id IN (SELECT id FROM safe_ids)
)
DELETE FROM medicines duplicate USING ranked WHERE duplicate.ctid=ranked.ctid AND ranked.duplicate_rank>1;

WITH safe_ids AS (
  SELECT id FROM medicine_batches WHERE id IS NOT NULL GROUP BY id
  HAVING count(*) > 1 AND count(DISTINCT (medicine_id,batch_number,expiration_date)) = 1
), ranked AS (
  SELECT ctid,row_number() OVER (PARTITION BY id ORDER BY created_at ASC,ctid ASC) AS duplicate_rank
  FROM medicine_batches WHERE id IN (SELECT id FROM safe_ids)
)
DELETE FROM medicine_batches duplicate USING ranked WHERE duplicate.ctid=ranked.ctid AND ranked.duplicate_rank>1;

DO $primary_keys$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='p') THEN ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sessions'::regclass AND contype='p') THEN ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (token_hash); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.suppliers'::regclass AND contype='p') THEN ALTER TABLE suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicines'::regclass AND contype='p') THEN ALTER TABLE medicines ADD CONSTRAINT medicines_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicine_batches'::regclass AND contype='p') THEN ALTER TABLE medicine_batches ADD CONSTRAINT medicine_batches_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND contype='p') THEN ALTER TABLE sales ADD CONSTRAINT sales_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchases'::regclass AND contype='p') THEN ALTER TABLE purchases ADD CONSTRAINT purchases_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_items'::regclass AND contype='p') THEN ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND contype='p') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_events'::regclass AND contype='p') THEN ALTER TABLE payment_events ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_history'::regclass AND contype='p') THEN ALTER TABLE backup_history ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.schema_migrations'::regclass AND contype='p') THEN ALTER TABLE schema_migrations ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_items'::regclass AND contype='p') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_item_batches'::regclass AND contype='p') THEN ALTER TABLE sale_item_batches ADD CONSTRAINT sale_item_batches_pkey PRIMARY KEY (sale_item_id,batch_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_transactions'::regclass AND contype='p') THEN ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_logs'::regclass AND contype='p') THEN ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id); END IF;
END;
$primary_keys$;

CREATE UNIQUE INDEX IF NOT EXISTS users_active_username_lower_uidx ON users (lower(username)) WHERE status='ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS users_active_email_lower_uidx ON users (lower(email)) WHERE status='ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS medicines_barcode_uidx ON medicines (barcode);
CREATE UNIQUE INDEX IF NOT EXISTS medicine_batches_medicine_batch_uidx ON medicine_batches (medicine_id,batch_number);
CREATE UNIQUE INDEX IF NOT EXISTS sales_idempotency_key_uidx ON sales (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_reference_number_uidx ON purchases (reference_number);
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_provider_reference_uidx ON payment_records (provider_reference);
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_idempotency_key_uidx ON payment_records (idempotency_key);

DO $foreign_keys$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sessions'::regclass AND conname='sessions_user_id_fkey') THEN ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicines'::regclass AND conname='medicines_supplier_id_fkey') THEN ALTER TABLE medicines ADD CONSTRAINT medicines_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicine_batches'::regclass AND conname='medicine_batches_medicine_id_fkey') THEN ALTER TABLE medicine_batches ADD CONSTRAINT medicine_batches_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES medicines(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND conname='sales_cashier_id_fkey') THEN ALTER TABLE sales ADD CONSTRAINT sales_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchases'::regclass AND conname='purchases_supplier_id_fkey') THEN ALTER TABLE purchases ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchases'::regclass AND conname='purchases_created_by_fkey') THEN ALTER TABLE purchases ADD CONSTRAINT purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_items'::regclass AND conname='purchase_items_purchase_id_fkey') THEN ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_items'::regclass AND conname='purchase_items_medicine_id_fkey') THEN ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES medicines(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_sale_id_fkey') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_events'::regclass AND conname='payment_events_payment_id_fkey') THEN ALTER TABLE payment_events ADD CONSTRAINT payment_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payment_records(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_events'::regclass AND conname='payment_events_performed_by_fkey') THEN ALTER TABLE payment_events ADD CONSTRAINT payment_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_items'::regclass AND conname='sale_items_sale_id_fkey') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_items'::regclass AND conname='sale_items_medicine_id_fkey') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES medicines(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_item_batches'::regclass AND conname='sale_item_batches_sale_item_id_fkey') THEN ALTER TABLE sale_item_batches ADD CONSTRAINT sale_item_batches_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES sale_items(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_item_batches'::regclass AND conname='sale_item_batches_batch_id_fkey') THEN ALTER TABLE sale_item_batches ADD CONSTRAINT sale_item_batches_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES medicine_batches(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_transactions'::regclass AND conname='inventory_transactions_medicine_id_fkey') THEN ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES medicines(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_transactions'::regclass AND conname='inventory_transactions_performed_by_fkey') THEN ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_logs'::regclass AND conname='audit_logs_user_id_fkey') THEN ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_history'::regclass AND conname='backup_history_requested_by_fkey') THEN ALTER TABLE backup_history ADD CONSTRAINT backup_history_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id); END IF;
END;
$foreign_keys$;

DO $check_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_role_check') THEN ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN','PHARMACIST','CASHIER')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_status_check') THEN ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('ACTIVE','INACTIVE')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.suppliers'::regclass AND conname='suppliers_status_check') THEN ALTER TABLE suppliers ADD CONSTRAINT suppliers_status_check CHECK (status IN ('ACTIVE','INACTIVE')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicines'::regclass AND conname='medicines_unit_price_check') THEN ALTER TABLE medicines ADD CONSTRAINT medicines_unit_price_check CHECK (unit_price >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicines'::regclass AND conname='medicines_quantity_check') THEN ALTER TABLE medicines ADD CONSTRAINT medicines_quantity_check CHECK (quantity >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicines'::regclass AND conname='medicines_reorder_level_check') THEN ALTER TABLE medicines ADD CONSTRAINT medicines_reorder_level_check CHECK (reorder_level >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicines'::regclass AND conname='medicines_status_check') THEN ALTER TABLE medicines ADD CONSTRAINT medicines_status_check CHECK (status IN ('ACTIVE','INACTIVE')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.medicine_batches'::regclass AND conname='medicine_batches_quantity_check') THEN ALTER TABLE medicine_batches ADD CONSTRAINT medicine_batches_quantity_check CHECK (quantity >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND conname='sales_subtotal_nonnegative_check') THEN ALTER TABLE sales ADD CONSTRAINT sales_subtotal_nonnegative_check CHECK (subtotal >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND conname='sales_discount_check') THEN ALTER TABLE sales ADD CONSTRAINT sales_discount_check CHECK (discount >= 0 AND discount <= subtotal); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND conname='sales_tax_nonnegative_check') THEN ALTER TABLE sales ADD CONSTRAINT sales_tax_nonnegative_check CHECK (tax >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND conname='sales_total_nonnegative_check') THEN ALTER TABLE sales ADD CONSTRAINT sales_total_nonnegative_check CHECK (total_amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sales'::regclass AND conname='sales_amounts_nonnegative_check') THEN ALTER TABLE sales ADD CONSTRAINT sales_amounts_nonnegative_check CHECK (amount_received >= 0 AND change_amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchases'::regclass AND conname='purchases_total_amount_check') THEN ALTER TABLE purchases ADD CONSTRAINT purchases_total_amount_check CHECK (total_amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_items'::regclass AND conname='purchase_items_quantity_check') THEN ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_quantity_check CHECK (quantity > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_items'::regclass AND conname='purchase_items_unit_cost_check') THEN ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_unit_cost_check CHECK (unit_cost >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_items'::regclass AND conname='purchase_items_subtotal_nonnegative_check') THEN ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_subtotal_nonnegative_check CHECK (subtotal >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_method_check') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_method_check CHECK (method IN ('CARD','E_WALLET')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_status_check') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_status_check CHECK (status IN ('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','EXPIRED','REFUNDED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_amount_check') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_amount_check CHECK (amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_refund_amount_check') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_refund_amount_check CHECK (refund_amount >= 0 AND refund_amount <= amount); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_refund_status_check') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_refund_status_check CHECK (refund_status IS NULL OR refund_status IN ('NONE','PENDING','SUCCEEDED','FAILED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_refund_requested_amount_check') THEN ALTER TABLE payment_records ADD CONSTRAINT payment_records_refund_requested_amount_check CHECK (refund_requested_amount IS NULL OR (refund_requested_amount >= 0 AND refund_requested_amount <= amount)); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_events'::regclass AND conname='payment_events_status_check') THEN ALTER TABLE payment_events ADD CONSTRAINT payment_events_status_check CHECK (status IN ('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','EXPIRED','REFUNDED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_events'::regclass AND conname='payment_events_previous_status_check') THEN ALTER TABLE payment_events ADD CONSTRAINT payment_events_previous_status_check CHECK (previous_status IS NULL OR previous_status IN ('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','EXPIRED','REFUNDED')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_items'::regclass AND conname='sale_items_quantity_check') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_quantity_check CHECK (quantity > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_items'::regclass AND conname='sale_items_unit_price_check') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_unit_price_check CHECK (unit_price >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_items'::regclass AND conname='sale_items_subtotal_nonnegative_check') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_subtotal_nonnegative_check CHECK (subtotal >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.sale_item_batches'::regclass AND conname='sale_item_batches_quantity_check') THEN ALTER TABLE sale_item_batches ADD CONSTRAINT sale_item_batches_quantity_check CHECK (quantity > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_transactions'::regclass AND conname='inventory_transactions_type_check') THEN ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_type_check CHECK (transaction_type IN ('PURCHASE','SALE','RETURN','ADJUSTMENT','EXPIRED','DAMAGED')); END IF;
END;
$check_constraints$;

ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE suppliers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE suppliers ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE medicines ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE medicines ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE sales ALTER COLUMN transaction_date SET DEFAULT now();
ALTER TABLE purchases ALTER COLUMN purchase_date SET DEFAULT now();
ALTER TABLE payment_records ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE payment_records ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE payment_events ALTER COLUMN occurred_at SET DEFAULT now();
ALTER TABLE backup_history ALTER COLUMN requested_at SET DEFAULT now();
ALTER TABLE inventory_transactions ALTER COLUMN occurred_at SET DEFAULT now();
ALTER TABLE audit_logs ALTER COLUMN occurred_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION pharmasync_prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.audit_cleanup', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
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
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items (sale_id, id);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON purchase_items (purchase_id, id);
CREATE INDEX IF NOT EXISTS inventory_transactions_date_idx ON inventory_transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales (transaction_date);
CREATE INDEX IF NOT EXISTS purchases_supplier_date_idx ON purchases (supplier_id, purchase_date);
CREATE INDEX IF NOT EXISTS payment_records_sale_idx ON payment_records (sale_id, created_at);
CREATE INDEX IF NOT EXISTS payment_events_payment_date_idx ON payment_events (payment_id, occurred_at);
CREATE INDEX IF NOT EXISTS audit_user_date_idx ON audit_logs (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS audit_date_idx ON audit_logs (occurred_at);