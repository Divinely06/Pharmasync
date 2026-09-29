BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_active_username_lower_uidx ON users (lower(username)) WHERE status='ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS users_active_email_lower_uidx ON users (lower(email)) WHERE status='ACTIVE';

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE purchases SET created_at=COALESCE(created_at,purchase_date,now()),updated_at=COALESCE(updated_at,created_at,purchase_date,now()) WHERE created_at IS NULL OR updated_at IS NULL;
ALTER TABLE purchases ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE purchases ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash','GCash','Maya','QRPh','Card'));

ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_status TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_provider_reference TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS refund_requested_amount NUMERIC(12,2);
ALTER TABLE payment_records DROP CONSTRAINT IF EXISTS payment_records_refund_provider_reference_key;
ALTER TABLE backup_history ADD COLUMN IF NOT EXISTS file_format TEXT;

UPDATE users SET status='INACTIVE' WHERE status IS NULL;
UPDATE suppliers SET status='INACTIVE' WHERE status IS NULL;
UPDATE medicines SET status='INACTIVE' WHERE status IS NULL;
UPDATE payment_records SET refund_amount=0 WHERE refund_amount IS NULL;

ALTER TABLE users ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE suppliers ALTER COLUMN contact_person SET DEFAULT '';
ALTER TABLE suppliers ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE suppliers ALTER COLUMN email SET DEFAULT '';
ALTER TABLE suppliers ALTER COLUMN address SET DEFAULT '';
ALTER TABLE suppliers ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE medicines ALTER COLUMN prescription_required SET DEFAULT false;
ALTER TABLE medicines ALTER COLUMN description SET DEFAULT '';
ALTER TABLE medicines ALTER COLUMN dosage_information SET DEFAULT '';
ALTER TABLE medicines ALTER COLUMN precautions SET DEFAULT '';
ALTER TABLE medicines ALTER COLUMN contraindications SET DEFAULT '';
ALTER TABLE medicines ALTER COLUMN storage_information SET DEFAULT '';
ALTER TABLE medicines ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE medicines ALTER COLUMN reorder_level SET DEFAULT 0;
ALTER TABLE medicines ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE medicine_batches ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE sales ALTER COLUMN transaction_date SET DEFAULT now();
ALTER TABLE sales ALTER COLUMN discount SET DEFAULT 0;
ALTER TABLE sales ALTER COLUMN amount_received SET DEFAULT 0;
ALTER TABLE sales ALTER COLUMN change_amount SET DEFAULT 0;
ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'COMPLETED';
ALTER TABLE purchases ALTER COLUMN purchase_date SET DEFAULT now();
ALTER TABLE purchases ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE payment_records ALTER COLUMN refund_amount SET DEFAULT 0;
ALTER TABLE payment_events ALTER COLUMN occurred_at SET DEFAULT now();
ALTER TABLE payment_events ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE backup_history ALTER COLUMN requested_at SET DEFAULT now();
ALTER TABLE schema_migrations ALTER COLUMN applied_at SET DEFAULT now();
ALTER TABLE inventory_transactions ALTER COLUMN occurred_at SET DEFAULT now();
ALTER TABLE inventory_transactions ALTER COLUMN notes SET DEFAULT '';
ALTER TABLE audit_logs ALTER COLUMN occurred_at SET DEFAULT now();
ALTER TABLE audit_logs ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payment_records ALTER COLUMN refund_amount SET DEFAULT 0;

ALTER TABLE users
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE suppliers
  ALTER COLUMN supplier_name SET NOT NULL,
  ALTER COLUMN contact_person SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN address SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE medicines
  ALTER COLUMN barcode SET NOT NULL,
  ALTER COLUMN generic_name SET NOT NULL,
  ALTER COLUMN brand_name SET NOT NULL,
  ALTER COLUMN medicine_type SET NOT NULL,
  ALTER COLUMN dosage_form SET NOT NULL,
  ALTER COLUMN strength SET NOT NULL,
  ALTER COLUMN prescription_required SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN dosage_information SET NOT NULL,
  ALTER COLUMN precautions SET NOT NULL,
  ALTER COLUMN contraindications SET NOT NULL,
  ALTER COLUMN storage_information SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN reorder_level SET NOT NULL,
  ALTER COLUMN expiration_date SET NOT NULL,
  ALTER COLUMN batch_number SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE medicine_batches
  ALTER COLUMN medicine_id SET NOT NULL,
  ALTER COLUMN batch_number SET NOT NULL,
  ALTER COLUMN expiration_date SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE sales
  ALTER COLUMN cashier_id SET NOT NULL,
  ALTER COLUMN transaction_date SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN discount SET NOT NULL,
  ALTER COLUMN tax SET NOT NULL,
  ALTER COLUMN total_amount SET NOT NULL,
  ALTER COLUMN payment_method SET NOT NULL,
  ALTER COLUMN amount_received SET NOT NULL,
  ALTER COLUMN change_amount SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE purchases
  ALTER COLUMN supplier_id SET NOT NULL,
  ALTER COLUMN purchase_date SET NOT NULL,
  ALTER COLUMN reference_number SET NOT NULL,
  ALTER COLUMN total_amount SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE purchase_items
  ALTER COLUMN purchase_id SET NOT NULL,
  ALTER COLUMN medicine_id SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit_cost SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN batch_number SET NOT NULL,
  ALTER COLUMN expiration_date SET NOT NULL;
ALTER TABLE payment_records
  ALTER COLUMN sale_id SET NOT NULL,
  ALTER COLUMN method SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN refund_amount SET NOT NULL;
ALTER TABLE payment_events
  ALTER COLUMN payment_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN occurred_at SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;
ALTER TABLE backup_history
  ALTER COLUMN requested_at SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE schema_migrations
  ALTER COLUMN version SET NOT NULL,
  ALTER COLUMN applied_at SET NOT NULL;
ALTER TABLE sale_items
  ALTER COLUMN sale_id SET NOT NULL,
  ALTER COLUMN medicine_id SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE sale_item_batches
  ALTER COLUMN sale_item_id SET NOT NULL,
  ALTER COLUMN batch_id SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL;
ALTER TABLE inventory_transactions
  ALTER COLUMN medicine_id SET NOT NULL,
  ALTER COLUMN transaction_type SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN previous_quantity SET NOT NULL,
  ALTER COLUMN resulting_quantity SET NOT NULL,
  ALTER COLUMN reference_id SET NOT NULL,
  ALTER COLUMN performed_by SET NOT NULL,
  ALTER COLUMN occurred_at SET NOT NULL,
  ALTER COLUMN notes SET NOT NULL;
ALTER TABLE audit_logs
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN entity_type SET NOT NULL,
  ALTER COLUMN entity_id SET NOT NULL,
  ALTER COLUMN occurred_at SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN success SET NOT NULL;

DO $backup_history_checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_history'::regclass AND conname='backup_history_status_check') THEN
    ALTER TABLE backup_history ADD CONSTRAINT backup_history_status_check CHECK (status IN ('PENDING','COMPLETED','FAILED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_history'::regclass AND conname='backup_history_file_format_check') THEN
    ALTER TABLE backup_history ADD CONSTRAINT backup_history_file_format_check CHECK (file_format IS NULL OR file_format IN ('pg_dump-custom','logical-json-gzip'));
  END IF;
END;
$backup_history_checks$;

DO $payment_record_checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_refund_amount_check') THEN
    ALTER TABLE payment_records ADD CONSTRAINT payment_records_refund_amount_check CHECK (refund_amount >= 0 AND refund_amount <= amount);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_refund_status_check') THEN
    ALTER TABLE payment_records ADD CONSTRAINT payment_records_refund_status_check CHECK (refund_status IS NULL OR refund_status IN ('NONE','PENDING','SUCCEEDED','FAILED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payment_records'::regclass AND conname='payment_records_refund_requested_amount_check') THEN
    ALTER TABLE payment_records ADD CONSTRAINT payment_records_refund_requested_amount_check CHECK (refund_requested_amount IS NULL OR (refund_requested_amount >= 0 AND refund_requested_amount <= amount));
  END IF;
END;
$payment_record_checks$;

CREATE UNIQUE INDEX IF NOT EXISTS payment_records_refund_provider_reference_uidx ON payment_records (refund_provider_reference);

COMMIT;