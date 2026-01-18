-- Fix existing members without roles
INSERT INTO user_roles (user_id, role)
SELECT m.user_id, 'member'::app_role
FROM members m
LEFT JOIN user_roles ur ON ur.user_id = m.user_id
WHERE ur.id IS NULL
  AND m.user_id IS NOT NULL;

-- Fix existing trainers without roles
INSERT INTO user_roles (user_id, role)
SELECT t.user_id, 'trainer'::app_role
FROM trainers t
LEFT JOIN user_roles ur ON ur.user_id = t.user_id AND ur.role = 'trainer'
WHERE ur.id IS NULL
  AND t.user_id IS NOT NULL;

-- Auto-assign member role trigger
CREATE OR REPLACE FUNCTION public.auto_assign_member_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.user_id AND role = 'member'
  ) THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'member');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER assign_member_role_on_insert
AFTER INSERT ON members
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_member_role();

-- Auto-assign trainer role trigger
CREATE OR REPLACE FUNCTION public.auto_assign_trainer_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.user_id AND role = 'trainer'
  ) THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'trainer');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER assign_trainer_role_on_insert
AFTER INSERT ON trainers
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_trainer_role();

-- Auto-assign staff role trigger for employees
CREATE OR REPLACE FUNCTION public.auto_assign_staff_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.user_id AND role = 'staff'
  ) THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'staff');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER assign_staff_role_on_insert
AFTER INSERT ON employees
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_staff_role();