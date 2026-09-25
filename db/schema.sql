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

INSERT INTO users (id, username, password_hash, full_name, role, email) VALUES
('u-admin', 'admin', crypt('admin123', gen_salt('bf')), 'Admin User', 'ADMIN', 'admin@pharmasync.local'),
('u-pharmacist', 'pharmacist', crypt('pharma123', gen_salt('bf')), 'Alicia Mercado', 'PHARMACIST', 'pharmacist@pharmasync.local'),
('u-cashier', 'cashier', crypt('cashier123', gen_salt('bf')), 'Maria Santos', 'CASHIER', 'cashier@pharmasync.local') ON CONFLICT (id) DO NOTHING;

INSERT INTO suppliers (id, supplier_name, contact_person, phone, email, address) VALUES
('sup-001', 'MedPharm Inc.', 'Ruben Basco', '+63 917 123 4567', 'orders@medpharm.ph', 'Quezon City, Metro Manila'),
('sup-002', 'UniChem Corp.', 'Nina Reyes', '+63 918 654 3210', 'sales@unichem.ph', 'Mandaluyong City, Metro Manila'),
('sup-003', 'CardioMed PH', 'Karl Ramos', '+63 919 888 1122', 'support@cardiomed.ph', 'Davao City') ON CONFLICT (id) DO NOTHING;

INSERT INTO medicines (id, barcode, generic_name, brand_name, medicine_type, dosage_form, strength, prescription_required, description, dosage_information, precautions, contraindications, storage_information, supplier_id, unit_price, quantity, reorder_level, expiration_date, batch_number) VALUES
('med-001', '480123456001', 'Amoxicillin', 'Amoxicillin 500mg', 'Antibiotic', 'Capsule', '500mg', true, 'Broad-spectrum antibiotic for bacterial infections.', 'Reference information only: follow a licensed professional''s prescription.', 'Reference information only: review allergy history with a professional.', 'Reference information only: avoid use without professional advice if allergic to penicillin.', 'Store below 30C in a dry place.', 'sup-001', 12.50, 240, 50, '2026-03-31', 'BT-2024-01'),
('med-002', '480123456002', 'Paracetamol', 'Paracetamol 500mg', 'Analgesic', 'Tablet', '500mg', false, 'Pain reliever and fever reducer.', 'Reference information only: follow the product label and professional guidance.', 'Reference information only: avoid exceeding the recommended dose.', 'Reference information only: avoid duplicate acetaminophen products without guidance.', 'Store in a cool, dry place below 30C.', 'sup-002', 4.75, 580, 100, '2027-06-30', 'BT-2024-02'),
('med-003', '480123456003', 'Losartan Potassium', 'Losartan 50mg', 'Cardiovascular', 'Tablet', '50mg', true, 'Blood pressure medication for long-term management.', 'Reference information only: dosing must follow professional advice.', 'Reference information only: monitor blood pressure as advised by a clinician.', 'Reference information only: use with professional guidance in pregnancy or kidney disease.', 'Store between 15C and 30C.', 'sup-003', 18.25, 180, 40, '2026-09-30', 'BT-2024-04'),
('med-004', '480123456004', 'Metformin HCl', 'Metformin 500mg', 'Diabetes', 'Tablet', '500mg', true, 'Oral medication used for blood sugar control.', 'Reference information only: dosing and monitoring should be guided by a physician.', 'Reference information only: professional supervision is important in renal impairment.', 'Reference information only: avoid without medical guidance if there are severe kidney concerns.', 'Store below 30C, protected from moisture.', 'sup-002', 7.50, 22, 30, '2026-11-30', 'BT-2024-05') ON CONFLICT (id) DO NOTHING;