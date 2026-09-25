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

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_number TEXT NOT NULL UNIQUE,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  batch_number TEXT NOT NULL,
  expiration_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, cashier_id TEXT NOT NULL REFERENCES users(id), transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(), subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0), discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0), tax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0), total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0), payment_method TEXT NOT NULL, amount_received NUMERIC(12,2) NOT NULL DEFAULT 0, change_amount NUMERIC(12,2) NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sales(id), medicine_id TEXT NOT NULL REFERENCES medicines(id), quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL REFERENCES medicines(id), transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'EXPIRED', 'DAMAGED')), quantity INTEGER NOT NULL, previous_quantity INTEGER NOT NULL, resulting_quantity INTEGER NOT NULL, reference_id TEXT NOT NULL, performed_by TEXT NOT NULL REFERENCES users(id), occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, success BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS medicines_search_idx ON medicines (generic_name, brand_name, barcode);
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales (transaction_date);
CREATE INDEX IF NOT EXISTS audit_date_idx ON audit_logs (occurred_at);

DELETE FROM sale_items WHERE sale_id IN ('TXN-1001', 'TXN-1002') OR medicine_id IN ('med-001', 'med-002', 'med-003', 'med-004') OR sale_id IN (SELECT id FROM sales WHERE cashier_id IN ('u-admin', 'u-pharmacist', 'u-cashier'));
DELETE FROM sales WHERE id IN ('TXN-1001', 'TXN-1002') OR cashier_id IN ('u-admin', 'u-pharmacist', 'u-cashier');
DELETE FROM purchase_items WHERE medicine_id IN ('med-001', 'med-002', 'med-003', 'med-004') OR purchase_id IN (SELECT id FROM purchases WHERE created_by IN ('u-admin', 'u-pharmacist', 'u-cashier'));
DELETE FROM purchases WHERE created_by IN ('u-admin', 'u-pharmacist', 'u-cashier');
DELETE FROM inventory_transactions WHERE medicine_id IN ('med-001', 'med-002', 'med-003', 'med-004') OR performed_by IN ('u-admin', 'u-pharmacist', 'u-cashier');
DELETE FROM audit_logs WHERE user_id IN ('u-admin', 'u-pharmacist', 'u-cashier');
DELETE FROM medicines WHERE id IN ('med-001', 'med-002', 'med-003', 'med-004');
DELETE FROM suppliers WHERE id IN ('sup-001', 'sup-002', 'sup-003') AND NOT EXISTS (SELECT 1 FROM medicines WHERE supplier_id = suppliers.id);
DELETE FROM users WHERE id IN ('u-admin', 'u-pharmacist', 'u-cashier') AND lower(username) <> 'bbubt';
INSERT INTO users (id, username, password_hash, full_name, role, email) VALUES
('account-admin', 'admin', crypt('admin123', gen_salt('bf')), 'Admin User', 'ADMIN', 'admin@pharmasync.local'),
('account-pharmacist', 'pharmacist', crypt('pharma123', gen_salt('bf')), 'Pharmacist', 'PHARMACIST', 'pharmacist@pharmasync.local'),
('account-cashier', 'cashier', crypt('cashier123', gen_salt('bf')), 'Cashier', 'CASHIER', 'cashier@pharmasync.local')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  status = 'ACTIVE',
  updated_at = now();