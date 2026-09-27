INSERT INTO users (id, username, password_hash, full_name, role, email)
SELECT seed.id,seed.username,crypt(seed.password,gen_salt('bf')),seed.full_name,seed.role,seed.email
FROM (VALUES
	('u-admin','admin','admin123','Admin User','ADMIN','admin@pharmasync.local'),
	('u-pharmacist','pharmacist','pharma123','Alicia Mercado','PHARMACIST','pharmacist@pharmasync.local'),
	('u-cashier','cashier','cashier123','Maria Santos','CASHIER','cashier@pharmasync.local')
) AS seed(id,username,password,full_name,role,email)
WHERE NOT EXISTS (SELECT 1 FROM users existing WHERE existing.id=seed.id)
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (id, supplier_name, contact_person, phone, email, address)
SELECT seed.id,seed.supplier_name,seed.contact_person,seed.phone,seed.email,seed.address
FROM (VALUES
	('sup-001','MedPharm Inc.','Ruben Basco','+63 917 123 4567','orders@medpharm.ph','Quezon City, Metro Manila'),
	('sup-002','UniChem Corp.','Nina Reyes','+63 918 654 3210','sales@unichem.ph','Mandaluyong City, Metro Manila'),
	('sup-003','CardioMed PH','Karl Ramos','+63 919 888 1122','support@cardiomed.ph','Davao City')
) AS seed(id,supplier_name,contact_person,phone,email,address)
WHERE NOT EXISTS (SELECT 1 FROM suppliers existing WHERE existing.id=seed.id)
ON CONFLICT DO NOTHING;

INSERT INTO medicines (id, barcode, generic_name, brand_name, medicine_type, dosage_form, strength, prescription_required, description, dosage_information, precautions, contraindications, storage_information, supplier_id, unit_price, quantity, reorder_level, expiration_date, batch_number)
SELECT seed.*
FROM (VALUES
	('med-001','480123456001','Amoxicillin','Amoxicillin 500mg','Antibiotic','Capsule','500mg',true,'Broad-spectrum antibiotic for bacterial infections.','Reference information only: follow a licensed professional''s prescription.','Reference information only: review allergy history with a professional.','Reference information only: avoid use without professional advice if allergic to penicillin.','Store below 30C in a dry place.','sup-001',12.50,240,50,'2027-03-31'::date,'BT-2024-01'),
	('med-002','480123456002','Paracetamol','Paracetamol 500mg','Analgesic','Tablet','500mg',false,'Pain reliever and fever reducer.','Reference information only: follow the product label and professional guidance.','Reference information only: avoid exceeding the recommended dose.','Reference information only: avoid duplicate acetaminophen products without guidance.','Store in a cool, dry place below 30C.','sup-002',4.75,580,100,'2027-06-30'::date,'BT-2024-02'),
	('med-003','480123456003','Losartan Potassium','Losartan 50mg','Cardiovascular','Tablet','50mg',true,'Blood pressure medication for long-term management.','Reference information only: follow professional advice.','Reference information only: monitor blood pressure as advised by a clinician.','Reference information only: use with professional guidance in pregnancy or kidney disease.','Store between 15C and 30C.','sup-003',18.25,180,40,'2027-09-30'::date,'BT-2024-04'),
	('med-004','480123456004','Metformin HCl','Metformin 500mg','Diabetes','Tablet','500mg',true,'Oral medication used for blood sugar control.','Reference information only: dosing and monitoring should be guided by a physician.','Reference information only: professional supervision is important in renal impairment.','Reference information only: avoid without medical guidance if there are severe kidney concerns.','Store below 30C, protected from moisture.','sup-002',7.50,22,30,'2027-11-30'::date,'BT-2024-05')
) AS seed(id,barcode,generic_name,brand_name,medicine_type,dosage_form,strength,prescription_required,description,dosage_information,precautions,contraindications,storage_information,supplier_id,unit_price,quantity,reorder_level,expiration_date,batch_number)
WHERE NOT EXISTS (SELECT 1 FROM medicines existing WHERE existing.id=seed.id OR existing.barcode=seed.barcode)
ON CONFLICT DO NOTHING;