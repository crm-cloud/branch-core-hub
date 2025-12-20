
-- =====================================================
-- INCLINE GYM MANAGEMENT SYSTEM - PRODUCTION SCHEMA
-- =====================================================

-- =====================================================
-- PART 1: ENUMS & TYPES
-- =====================================================

-- Role types
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'trainer', 'staff', 'member');

-- Status engines
CREATE TYPE public.member_status AS ENUM ('active', 'inactive', 'suspended', 'blacklisted');
CREATE TYPE public.membership_status AS ENUM ('pending', 'active', 'frozen', 'expired', 'cancelled');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled', 'refunded');
CREATE TYPE public.pt_session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled');
CREATE TYPE public.pt_package_status AS ENUM ('active', 'expired', 'exhausted', 'cancelled');
CREATE TYPE public.class_booking_status AS ENUM ('booked', 'attended', 'cancelled', 'no_show', 'waitlisted');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'negotiation', 'converted', 'lost');

-- Other enums
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'wallet', 'upi', 'cheque', 'other');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.approval_type AS ENUM ('membership_freeze', 'membership_transfer', 'refund', 'discount', 'complimentary', 'expense', 'contract');
CREATE TYPE public.benefit_type AS ENUM ('gym_access', 'pool_access', 'sauna_access', 'steam_access', 'group_classes', 'pt_sessions', 'locker', 'towel', 'parking', 'guest_pass', 'other');
CREATE TYPE public.frequency_type AS ENUM ('daily', 'weekly', 'monthly', 'unlimited');
CREATE TYPE public.wallet_txn_type AS ENUM ('credit', 'debit', 'refund', 'reward', 'referral', 'adjustment');
CREATE TYPE public.contract_status AS ENUM ('draft', 'active', 'completed', 'terminated');
CREATE TYPE public.equipment_status AS ENUM ('operational', 'maintenance', 'out_of_order', 'retired');
CREATE TYPE public.locker_status AS ENUM ('available', 'assigned', 'maintenance', 'reserved');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');

-- =====================================================
-- PART 2: IDENTITY & ACCESS
-- =====================================================

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  gender gender_type,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User roles (many-to-many)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Permissions
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Role permissions (many-to-many)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (role, permission_id)
);

-- =====================================================
-- PART 3: BRANCH & STRUCTURE
-- =====================================================

CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  opening_time TIME DEFAULT '06:00',
  closing_time TIME DEFAULT '22:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.branch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL UNIQUE,
  currency TEXT DEFAULT 'INR',
  tax_rate DECIMAL(5,2) DEFAULT 18.00,
  late_fee_rate DECIMAL(5,2) DEFAULT 0,
  freeze_min_days INTEGER DEFAULT 7,
  freeze_max_days INTEGER DEFAULT 30,
  freeze_fee DECIMAL(10,2) DEFAULT 0,
  cancellation_fee_rate DECIMAL(5,2) DEFAULT 10,
  advance_booking_days INTEGER DEFAULT 7,
  waitlist_enabled BOOLEAN DEFAULT true,
  auto_attendance_checkout BOOLEAN DEFAULT true,
  checkout_after_hours INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Branch managers (many-to-many: manager can manage multiple branches)
CREATE TABLE public.branch_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (branch_id, user_id)
);

-- Staff branch assignment (one staff = one branch)
CREATE TABLE public.staff_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  position TEXT,
  hire_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 4: MEMBERS & LEADS
-- =====================================================

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  gender gender_type,
  date_of_birth DATE,
  source TEXT,
  status lead_status DEFAULT 'new' NOT NULL,
  interested_plan_id UUID,
  notes TEXT,
  converted_member_id UUID,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.lead_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  followup_date DATE NOT NULL,
  notes TEXT,
  outcome TEXT,
  next_followup_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
  member_code TEXT UNIQUE NOT NULL,
  status member_status DEFAULT 'active' NOT NULL,
  source TEXT,
  referred_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  health_conditions TEXT,
  fitness_goals TEXT,
  notes TEXT,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Track member branch transfers
CREATE TABLE public.member_branch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  from_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  to_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL NOT NULL,
  transfer_date DATE DEFAULT CURRENT_DATE NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 5: MEMBERSHIP
-- =====================================================

CREATE TABLE public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  discounted_price DECIMAL(10,2),
  admission_fee DECIMAL(10,2) DEFAULT 0,
  is_transferable BOOLEAN DEFAULT false,
  max_freeze_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.plan_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.membership_plans(id) ON DELETE CASCADE NOT NULL,
  benefit_type benefit_type NOT NULL,
  frequency frequency_type NOT NULL,
  limit_count INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (plan_id, benefit_type)
);

CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.membership_plans(id) ON DELETE RESTRICT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
  status membership_status DEFAULT 'pending' NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  original_end_date DATE NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_reason TEXT,
  total_freeze_days_used INTEGER DEFAULT 0,
  is_auto_renew BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.membership_free_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES public.memberships(id) ON DELETE CASCADE NOT NULL,
  days_added INTEGER NOT NULL,
  reason TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.membership_freeze_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES public.memberships(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_frozen INTEGER NOT NULL,
  reason TEXT,
  fee_charged DECIMAL(10,2) DEFAULT 0,
  status approval_status DEFAULT 'pending' NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 6: BENEFIT CONSUMPTION ENGINE
-- =====================================================

CREATE TABLE public.benefit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES public.memberships(id) ON DELETE CASCADE NOT NULL,
  benefit_type benefit_type NOT NULL,
  usage_date DATE DEFAULT CURRENT_DATE NOT NULL,
  usage_count INTEGER DEFAULT 1,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 7: ATTENDANCE
-- =====================================================

CREATE TABLE public.member_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  check_in TIMESTAMPTZ DEFAULT now() NOT NULL,
  check_out TIMESTAMPTZ,
  check_in_method TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  check_in TIMESTAMPTZ DEFAULT now() NOT NULL,
  check_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 8: BILLING & FINANCE
-- =====================================================

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  status invoice_status DEFAULT 'draft' NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  status payment_status DEFAULT 'pending' NOT NULL,
  transaction_id TEXT,
  payment_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  notes TEXT,
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 9: WALLET ENGINE
-- =====================================================

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_credited DECIMAL(10,2) DEFAULT 0,
  total_debited DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  txn_type wallet_txn_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Expense tracking
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE NOT NULL,
  vendor TEXT,
  receipt_url TEXT,
  status approval_status DEFAULT 'pending' NOT NULL,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 10: TRAINER & FITNESS
-- =====================================================

CREATE TABLE public.trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  specializations TEXT[],
  certifications TEXT[],
  bio TEXT,
  hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.trainer_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (trainer_id, day_of_week, start_time)
);

CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  plan_data JSONB NOT NULL DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  is_ai_generated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.diet_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  plan_data JSONB NOT NULL DEFAULT '{}',
  calories_target INTEGER,
  start_date DATE,
  end_date DATE,
  is_ai_generated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_plan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  plan_type TEXT NOT NULL,
  plan_id UUID,
  prompt TEXT,
  response JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.pt_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_sessions INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  validity_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.member_pt_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.pt_packages(id) ON DELETE RESTRICT NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  status pt_package_status DEFAULT 'active' NOT NULL,
  sessions_total INTEGER NOT NULL,
  sessions_used INTEGER DEFAULT 0,
  sessions_remaining INTEGER NOT NULL,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.pt_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_pt_package_id UUID REFERENCES public.member_pt_packages(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status pt_session_status DEFAULT 'scheduled' NOT NULL,
  notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 11: CLASSES
-- =====================================================

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  class_type TEXT,
  capacity INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  scheduled_at TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  status class_booking_status DEFAULT 'booked' NOT NULL,
  booked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  attended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (class_id, member_id)
);

CREATE TABLE public.class_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (class_id, member_id)
);

-- =====================================================
-- PART 12: OPERATIONS
-- =====================================================

CREATE TABLE public.lockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  locker_number TEXT NOT NULL,
  size TEXT DEFAULT 'standard',
  status locker_status DEFAULT 'available' NOT NULL,
  monthly_fee DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (branch_id, locker_number)
);

CREATE TABLE public.locker_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id UUID REFERENCES public.lockers(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  fee_amount DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  warranty_expiry DATE,
  status equipment_status DEFAULT 'operational' NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.equipment_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE NOT NULL,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  cost DECIMAL(10,2),
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 13: COMMERCE
-- =====================================================

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sku TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 5,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (product_id, branch_id)
);

CREATE TABLE public.pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  sold_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sale_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE NOT NULL,
  status order_status DEFAULT 'pending' NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 14: HRM
-- =====================================================

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  employee_code TEXT UNIQUE NOT NULL,
  department TEXT,
  position TEXT,
  hire_date DATE NOT NULL,
  salary DECIMAL(10,2),
  salary_type TEXT DEFAULT 'monthly',
  bank_name TEXT,
  bank_account TEXT,
  tax_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  contract_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  salary DECIMAL(10,2) NOT NULL,
  terms JSONB,
  document_url TEXT,
  status contract_status DEFAULT 'draft' NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.payroll_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  calculation JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 15: ENGAGEMENT
-- =====================================================

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  referred_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  referred_name TEXT NOT NULL,
  referred_phone TEXT NOT NULL,
  referred_email TEXT,
  status lead_status DEFAULT 'new' NOT NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value DECIMAL(10,2),
  description TEXT,
  is_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all',
  priority INTEGER DEFAULT 0,
  publish_at TIMESTAMPTZ DEFAULT now(),
  expire_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority DEFAULT 'medium' NOT NULL,
  status task_status DEFAULT 'pending' NOT NULL,
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 16: SETTINGS & TEMPLATES
-- =====================================================

CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (branch_id, key)
);

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 17: APPROVAL ENGINE
-- =====================================================

CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  approval_type approval_type NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_data JSONB NOT NULL,
  status approval_status DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 18: AUDIT LOG ENGINE
-- =====================================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- PART 19: SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Get user's branch (for staff/trainer)
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.staff_branches WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user manages a branch
CREATE OR REPLACE FUNCTION public.manages_branch(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branch_managers
    WHERE user_id = _user_id
      AND branch_id = _branch_id
  ) OR public.has_any_role(_user_id, ARRAY['owner', 'admin']::app_role[])
$$;

-- Get member ID for user
CREATE OR REPLACE FUNCTION public.get_member_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.members WHERE user_id = _user_id LIMIT 1
$$;

-- Check if membership is active with benefit
CREATE OR REPLACE FUNCTION public.has_active_benefit(_member_id UUID, _benefit benefit_type)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id UUID;
  v_limit INTEGER;
  v_used INTEGER;
  v_frequency frequency_type;
BEGIN
  -- Get active membership
  SELECT m.id INTO v_membership_id
  FROM public.memberships m
  WHERE m.member_id = _member_id
    AND m.status = 'active'
    AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
  LIMIT 1;
  
  IF v_membership_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if plan has this benefit
  SELECT pb.limit_count, pb.frequency INTO v_limit, v_frequency
  FROM public.plan_benefits pb
  JOIN public.memberships m ON m.plan_id = pb.plan_id
  WHERE m.id = v_membership_id
    AND pb.benefit_type = _benefit;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Unlimited benefit
  IF v_frequency = 'unlimited' OR v_limit IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Count usage based on frequency
  SELECT COALESCE(SUM(usage_count), 0) INTO v_used
  FROM public.benefit_usage
  WHERE membership_id = v_membership_id
    AND benefit_type = _benefit
    AND CASE v_frequency
      WHEN 'daily' THEN usage_date = CURRENT_DATE
      WHEN 'weekly' THEN usage_date >= date_trunc('week', CURRENT_DATE)
      WHEN 'monthly' THEN usage_date >= date_trunc('month', CURRENT_DATE)
      ELSE TRUE
    END;
  
  RETURN v_used < v_limit;
END;
$$;

-- Handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create update triggers for all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name = 'updated_at'
  LOOP
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON public.%I
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at()
    ', t, t);
  END LOOP;
END;
$$;

-- Generate member code
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  branch_code TEXT;
  seq_num INTEGER;
BEGIN
  SELECT code INTO branch_code FROM public.branches WHERE id = NEW.branch_id;
  SELECT COUNT(*) + 1 INTO seq_num FROM public.members WHERE branch_id = NEW.branch_id;
  NEW.member_code := branch_code || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_member_code_trigger
  BEFORE INSERT ON public.members
  FOR EACH ROW
  WHEN (NEW.member_code IS NULL)
  EXECUTE FUNCTION public.generate_member_code();

-- Generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  branch_code TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  SELECT code INTO branch_code FROM public.branches WHERE id = NEW.branch_id;
  year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  SELECT COUNT(*) + 1 INTO seq_num 
  FROM public.invoices 
  WHERE branch_id = NEW.branch_id 
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);
  NEW.invoice_number := 'INV-' || branch_code || '-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- =====================================================
-- PART 20: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_branch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_free_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_freeze_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_plan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_pt_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 21: RLS POLICIES
-- =====================================================

-- Profiles: Users can view their own, admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin full access to profiles" ON public.profiles
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- User roles: Only admins can manage
CREATE POLICY "View own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage roles" ON public.user_roles
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- Permissions: Read for authenticated, write for admins
CREATE POLICY "View permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage permissions" ON public.permissions
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- Role permissions: Similar to permissions
CREATE POLICY "View role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage role permissions" ON public.role_permissions
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- Branches: All authenticated can view, admins manage
CREATE POLICY "View branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage branches" ON public.branches
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- Branch settings: Managers can view their branches, admins all
CREATE POLICY "View branch settings" ON public.branch_settings
  FOR SELECT USING (
    public.manages_branch(auth.uid(), branch_id) OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
  );
CREATE POLICY "Manage branch settings" ON public.branch_settings
  FOR ALL USING (
    public.manages_branch(auth.uid(), branch_id) OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
  );

-- Branch managers
CREATE POLICY "View branch managers" ON public.branch_managers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage branch managers" ON public.branch_managers
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- Staff branches
CREATE POLICY "View own staff branch" ON public.staff_branches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage staff branches" ON public.staff_branches
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- Members: Branch scoped access
CREATE POLICY "Members view own" ON public.members
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Staff view branch members" ON public.members
  FOR SELECT USING (
    branch_id = public.get_user_branch(auth.uid()) OR
    public.manages_branch(auth.uid(), branch_id)
  );
CREATE POLICY "Staff manage branch members" ON public.members
  FOR ALL USING (
    branch_id = public.get_user_branch(auth.uid()) OR
    public.manages_branch(auth.uid(), branch_id) OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
  );

-- Memberships: Similar branch scoping
CREATE POLICY "View own memberships" ON public.memberships
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Staff view branch memberships" ON public.memberships
  FOR SELECT USING (
    branch_id = public.get_user_branch(auth.uid()) OR
    public.manages_branch(auth.uid(), branch_id)
  );
CREATE POLICY "Staff manage branch memberships" ON public.memberships
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );

-- Membership plans: Public view, admin manage
CREATE POLICY "View active plans" ON public.membership_plans
  FOR SELECT USING (is_active = true OR public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));
CREATE POLICY "Admin manage plans" ON public.membership_plans
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- Plan benefits
CREATE POLICY "View plan benefits" ON public.plan_benefits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage plan benefits" ON public.plan_benefits
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- Invoices
CREATE POLICY "View own invoices" ON public.invoices
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Staff view branch invoices" ON public.invoices
  FOR SELECT USING (
    branch_id = public.get_user_branch(auth.uid()) OR
    public.manages_branch(auth.uid(), branch_id)
  );
CREATE POLICY "Staff manage branch invoices" ON public.invoices
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );

-- Payments
CREATE POLICY "View own payments" ON public.payments
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Staff manage branch payments" ON public.payments
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );

-- Wallets
CREATE POLICY "View own wallet" ON public.wallets
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Staff manage wallets" ON public.wallets
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

-- Wallet transactions
CREATE POLICY "View own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE member_id = public.get_member_id(auth.uid()))
  );
CREATE POLICY "Staff manage wallet transactions" ON public.wallet_transactions
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

-- Classes: Public view active, staff manage
CREATE POLICY "View active classes" ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage classes" ON public.classes
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );

-- Class bookings
CREATE POLICY "View own bookings" ON public.class_bookings
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Members can book" ON public.class_bookings
  FOR INSERT WITH CHECK (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Staff manage bookings" ON public.class_bookings
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
  );

-- Attendance
CREATE POLICY "View own attendance" ON public.member_attendance
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));
CREATE POLICY "Staff manage attendance" ON public.member_attendance
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );

-- Trainers
CREATE POLICY "View trainers" ON public.trainers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage trainers" ON public.trainers
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- PT packages and sessions
CREATE POLICY "View pt packages" ON public.pt_packages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage pt packages" ON public.pt_packages
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "View own pt sessions" ON public.pt_sessions
  FOR SELECT USING (
    member_pt_package_id IN (
      SELECT id FROM public.member_pt_packages WHERE member_id = public.get_member_id(auth.uid())
    ) OR trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())
  );
CREATE POLICY "Staff manage pt sessions" ON public.pt_sessions
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[])
  );

-- Leads
CREATE POLICY "Staff view leads" ON public.leads
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );
CREATE POLICY "Staff manage leads" ON public.leads
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]) AND
    (branch_id = public.get_user_branch(auth.uid()) OR public.manages_branch(auth.uid(), branch_id))
  );

-- Announcements
CREATE POLICY "View active announcements" ON public.announcements
  FOR SELECT TO authenticated USING (
    is_active = true AND 
    (publish_at IS NULL OR publish_at <= now()) AND
    (expire_at IS NULL OR expire_at > now())
  );
CREATE POLICY "Admin manage announcements" ON public.announcements
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- Tasks
CREATE POLICY "View assigned tasks" ON public.tasks
  FOR SELECT USING (
    assigned_to = auth.uid() OR
    assigned_by = auth.uid() OR
    public.manages_branch(auth.uid(), branch_id)
  );
CREATE POLICY "Staff manage tasks" ON public.tasks
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

-- Audit logs: Admin only
CREATE POLICY "Admin view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));
CREATE POLICY "System insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Approval requests
CREATE POLICY "View related approvals" ON public.approval_requests
  FOR SELECT USING (
    requested_by = auth.uid() OR
    public.manages_branch(auth.uid(), branch_id)
  );
CREATE POLICY "Create approval requests" ON public.approval_requests
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Manager review approvals" ON public.approval_requests
  FOR UPDATE USING (public.manages_branch(auth.uid(), branch_id));

-- Default policies for remaining tables (branch scoped staff access)
CREATE POLICY "staff_access_leads_followups" ON public.lead_followups
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_member_branch_history" ON public.member_branch_history
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "staff_access_free_days" ON public.membership_free_days
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "staff_access_freeze_history" ON public.membership_freeze_history
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_benefit_usage" ON public.benefit_usage
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_staff_attendance" ON public.staff_attendance
  FOR ALL USING (
    user_id = auth.uid() OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

CREATE POLICY "staff_access_invoice_items" ON public.invoice_items
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_expense_categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage_expense_categories" ON public.expense_categories
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

CREATE POLICY "staff_access_expenses" ON public.expenses
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_trainer_availability" ON public.trainer_availability
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[]));

CREATE POLICY "member_view_own_workout" ON public.workout_plans
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));

CREATE POLICY "trainer_manage_workouts" ON public.workout_plans
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[]));

CREATE POLICY "member_view_own_diet" ON public.diet_plans
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));

CREATE POLICY "trainer_manage_diets" ON public.diet_plans
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[]));

CREATE POLICY "staff_access_ai_logs" ON public.ai_plan_logs
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[]));

CREATE POLICY "staff_access_member_pt" ON public.member_pt_packages
  FOR ALL USING (
    member_id = public.get_member_id(auth.uid()) OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
  );

CREATE POLICY "staff_access_waitlist" ON public.class_waitlist
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

CREATE POLICY "staff_access_lockers" ON public.lockers
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_locker_assignments" ON public.locker_assignments
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_equipment" ON public.equipment
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_maintenance" ON public.equipment_maintenance
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "view_products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_manage_products" ON public.products
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "staff_access_inventory" ON public.inventory
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_pos_sales" ON public.pos_sales
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "staff_access_orders" ON public.ecommerce_orders
  FOR ALL USING (
    member_id = public.get_member_id(auth.uid()) OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

CREATE POLICY "admin_access_employees" ON public.employees
  FOR ALL USING (
    user_id = auth.uid() OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

CREATE POLICY "admin_access_contracts" ON public.contracts
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "admin_access_payroll" ON public.payroll_rules
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

CREATE POLICY "member_access_referrals" ON public.referrals
  FOR ALL USING (
    referrer_member_id = public.get_member_id(auth.uid()) OR
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

CREATE POLICY "member_access_rewards" ON public.referral_rewards
  FOR SELECT USING (member_id = public.get_member_id(auth.uid()));

CREATE POLICY "staff_manage_rewards" ON public.referral_rewards
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "admin_access_settings" ON public.settings
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "admin_access_templates" ON public.templates
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

CREATE POLICY "staff_access_comm_logs" ON public.communication_logs
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

-- =====================================================
-- PART 22: INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_members_branch ON public.members(branch_id);
CREATE INDEX idx_members_user ON public.members(user_id);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_memberships_member ON public.memberships(member_id);
CREATE INDEX idx_memberships_branch ON public.memberships(branch_id);
CREATE INDEX idx_memberships_status ON public.memberships(status);
CREATE INDEX idx_memberships_dates ON public.memberships(start_date, end_date);
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id);
CREATE INDEX idx_invoices_member ON public.invoices(member_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payments_branch ON public.payments(branch_id);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_attendance_member ON public.member_attendance(member_id);
CREATE INDEX idx_attendance_branch ON public.member_attendance(branch_id);
CREATE INDEX idx_attendance_date ON public.member_attendance(check_in);
CREATE INDEX idx_classes_branch ON public.classes(branch_id);
CREATE INDEX idx_classes_scheduled ON public.classes(scheduled_at);
CREATE INDEX idx_class_bookings_class ON public.class_bookings(class_id);
CREATE INDEX idx_class_bookings_member ON public.class_bookings(member_id);
CREATE INDEX idx_pt_sessions_package ON public.pt_sessions(member_pt_package_id);
CREATE INDEX idx_pt_sessions_trainer ON public.pt_sessions(trainer_id);
CREATE INDEX idx_pt_sessions_scheduled ON public.pt_sessions(scheduled_at);
CREATE INDEX idx_leads_branch ON public.leads(branch_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_branch_managers_user ON public.branch_managers(user_id);
CREATE INDEX idx_staff_branches_user ON public.staff_branches(user_id);
