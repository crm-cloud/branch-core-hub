-- Fix the trigger to handle both NULL and empty string
DROP TRIGGER IF EXISTS generate_member_code_trigger ON members;
CREATE TRIGGER generate_member_code_trigger
  BEFORE INSERT ON members
  FOR EACH ROW
  WHEN (NEW.member_code IS NULL OR NEW.member_code = '')
  EXECUTE FUNCTION generate_member_code();