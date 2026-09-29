BEGIN;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('Cash', 'GCash', 'Maya', 'QRPh', 'Card'));

COMMIT;