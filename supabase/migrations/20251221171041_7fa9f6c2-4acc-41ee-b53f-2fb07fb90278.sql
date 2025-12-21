-- Create audit log trigger function
CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, new_data, user_id, branch_id
    ) VALUES (
      'INSERT', TG_TABLE_NAME, NEW.id::TEXT, 
      to_jsonb(NEW), 
      auth.uid(),
      CASE WHEN TG_TABLE_NAME IN ('members', 'memberships', 'invoices', 'payments', 'trainers', 'employees') 
           THEN NEW.branch_id ELSE NULL END
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, new_data, user_id, branch_id
    ) VALUES (
      'UPDATE', TG_TABLE_NAME, NEW.id::TEXT, 
      to_jsonb(OLD), to_jsonb(NEW), 
      auth.uid(),
      CASE WHEN TG_TABLE_NAME IN ('members', 'memberships', 'invoices', 'payments', 'trainers', 'employees') 
           THEN NEW.branch_id ELSE NULL END
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, user_id, branch_id
    ) VALUES (
      'DELETE', TG_TABLE_NAME, OLD.id::TEXT, 
      to_jsonb(OLD), 
      auth.uid(),
      CASE WHEN TG_TABLE_NAME IN ('members', 'memberships', 'invoices', 'payments', 'trainers', 'employees') 
           THEN OLD.branch_id ELSE NULL END
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers for key tables
CREATE TRIGGER audit_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE TRIGGER audit_memberships_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE TRIGGER audit_invoices_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE TRIGGER audit_payments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE TRIGGER audit_trainers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE TRIGGER audit_employees_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

-- Add RLS policies for audit_logs to allow authenticated users to view
CREATE POLICY "Authenticated users can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);