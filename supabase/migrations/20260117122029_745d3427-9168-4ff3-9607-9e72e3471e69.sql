-- Create enums for benefit booking system
CREATE TYPE public.benefit_booking_status AS ENUM ('booked', 'confirmed', 'attended', 'no_show', 'cancelled');
CREATE TYPE public.no_show_policy AS ENUM ('mark_used', 'allow_reschedule', 'charge_penalty');

-- Create benefit_settings table - Rules per benefit type per branch
CREATE TABLE public.benefit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  benefit_type public.benefit_type NOT NULL,
  is_slot_booking_enabled BOOLEAN DEFAULT false,
  slot_duration_minutes INTEGER DEFAULT 30,
  booking_opens_hours_before INTEGER DEFAULT 24,
  cancellation_deadline_minutes INTEGER DEFAULT 60,
  no_show_policy public.no_show_policy DEFAULT 'mark_used',
  no_show_penalty_amount NUMERIC(10,2) DEFAULT 0,
  max_bookings_per_day INTEGER DEFAULT 2,
  buffer_between_sessions_minutes INTEGER DEFAULT 15,
  operating_hours_start TIME DEFAULT '06:00',
  operating_hours_end TIME DEFAULT '22:00',
  capacity_per_slot INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, benefit_type)
);

-- Create benefit_slots table - Available time slots
CREATE TABLE public.benefit_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  benefit_type public.benefit_type NOT NULL,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  booked_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient slot lookups
CREATE INDEX idx_benefit_slots_lookup ON public.benefit_slots(branch_id, benefit_type, slot_date, is_active);

-- Create benefit_bookings table - Member slot reservations
CREATE TABLE public.benefit_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.benefit_slots(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  status public.benefit_booking_status NOT NULL DEFAULT 'booked',
  booked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  check_in_at TIMESTAMP WITH TIME ZONE,
  no_show_marked_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for member bookings lookup
CREATE INDEX idx_benefit_bookings_member ON public.benefit_bookings(member_id, status);
CREATE INDEX idx_benefit_bookings_slot ON public.benefit_bookings(slot_id, status);

-- Create benefit_packages table - Purchasable add-on packages
CREATE TABLE public.benefit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  benefit_type public.benefit_type NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  validity_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create member_benefit_credits table - Purchased extra credits
CREATE TABLE public.member_benefit_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  benefit_type public.benefit_type NOT NULL,
  package_id UUID REFERENCES public.benefit_packages(id) ON DELETE SET NULL,
  credits_total INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for member credits lookup
CREATE INDEX idx_member_benefit_credits_lookup ON public.member_benefit_credits(member_id, benefit_type, expires_at);

-- Enable RLS on all tables
ALTER TABLE public.benefit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_benefit_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for benefit_settings (admin/manager access)
CREATE POLICY "Staff can view benefit settings" ON public.benefit_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage benefit settings" ON public.benefit_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- RLS Policies for benefit_slots (viewable by authenticated, managed by staff+)
CREATE POLICY "Authenticated can view active slots" ON public.benefit_slots
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Staff can manage slots" ON public.benefit_slots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

-- RLS Policies for benefit_bookings
CREATE POLICY "Members can view own bookings" ON public.benefit_bookings
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Members can create own bookings" ON public.benefit_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Members can update own bookings" ON public.benefit_bookings
  FOR UPDATE TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

-- RLS Policies for benefit_packages (viewable by all, managed by admin+)
CREATE POLICY "Anyone can view active packages" ON public.benefit_packages
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage packages" ON public.benefit_packages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- RLS Policies for member_benefit_credits
CREATE POLICY "Members can view own credits" ON public.member_benefit_credits
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Staff can manage credits" ON public.member_benefit_credits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

-- Create trigger for updating updated_at (using existing function)
CREATE TRIGGER update_benefit_settings_updated_at
  BEFORE UPDATE ON public.benefit_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_benefit_slots_updated_at
  BEFORE UPDATE ON public.benefit_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_benefit_bookings_updated_at
  BEFORE UPDATE ON public.benefit_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_benefit_packages_updated_at
  BEFORE UPDATE ON public.benefit_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_member_benefit_credits_updated_at
  BEFORE UPDATE ON public.member_benefit_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to update slot booked_count
CREATE OR REPLACE FUNCTION public.update_slot_booked_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.benefit_slots
    SET booked_count = booked_count + 1
    WHERE id = NEW.slot_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('booked', 'confirmed') AND NEW.status IN ('cancelled', 'no_show') THEN
      UPDATE public.benefit_slots
      SET booked_count = GREATEST(0, booked_count - 1)
      WHERE id = NEW.slot_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('booked', 'confirmed') THEN
      UPDATE public.benefit_slots
      SET booked_count = GREATEST(0, booked_count - 1)
      WHERE id = OLD.slot_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update slot booked_count
CREATE TRIGGER update_slot_booked_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.benefit_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_slot_booked_count();