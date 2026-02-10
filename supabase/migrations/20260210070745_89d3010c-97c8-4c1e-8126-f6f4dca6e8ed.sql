-- Make invoice_number nullable so trigger can set it
ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;

-- Update trigger to handle both NULL and empty string
DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();