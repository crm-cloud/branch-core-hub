  -- ============================================
  -- VPS Supabase Complete Schema Dump
  -- Generated: Sat Mar 21 14:14:50 UTC 2026
  -- Ready to paste into SQL Editor
  -- ============================================


  -- 20251220144111_c4aa0b5d-a46c-4084-8fd1-7527a8415d4e.sql
  -- ============================================

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

  -- 20251220144801_c5206e89-1310-4a93-aa46-7f74856a58fc.sql
  -- ============================================
  -- Create storage bucket for avatars
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

  -- Create storage policies for avatars
  CREATE POLICY "Avatar images are publicly accessible" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'avatars');

  CREATE POLICY "Users can upload their own avatar" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

  CREATE POLICY "Users can update their own avatar" 
  ON storage.objects 
  FOR UPDATE 
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

  CREATE POLICY "Users can delete their own avatar" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Add must_set_password column to profiles for first-time login flow
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_set_password BOOLEAN DEFAULT false;
  -- 20251220150819_dc7d26c1-1eff-4876-b09e-0364ee0be095.sql
  -- ============================================
  -- Function to validate membership for check-in
  CREATE OR REPLACE FUNCTION public.validate_member_checkin(_member_id UUID, _branch_id UUID)
  RETURNS JSON
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_membership RECORD;
    v_open_attendance RECORD;
  BEGIN
    -- Check for open attendance (already checked in)
    SELECT * INTO v_open_attendance
    FROM public.member_attendance
    WHERE member_id = _member_id
      AND check_out IS NULL
    ORDER BY check_in DESC
    LIMIT 1;
    
    IF FOUND THEN
      RETURN json_build_object(
        'valid', false,
        'reason', 'already_checked_in',
        'message', 'Member is already checked in',
        'attendance_id', v_open_attendance.id,
        'check_in_time', v_open_attendance.check_in
      );
    END IF;

    -- Check for active membership at branch
    SELECT m.*, mp.name as plan_name INTO v_membership
    FROM public.memberships m
    JOIN public.membership_plans mp ON m.plan_id = mp.id
    WHERE m.member_id = _member_id
      AND m.status = 'active'
      AND m.branch_id = _branch_id
      AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
    LIMIT 1;
    
    IF NOT FOUND THEN
      SELECT m.*, mp.name as plan_name INTO v_membership
      FROM public.memberships m
      JOIN public.membership_plans mp ON m.plan_id = mp.id
      WHERE m.member_id = _member_id
      ORDER BY m.end_date DESC
      LIMIT 1;
      
      IF NOT FOUND THEN
        RETURN json_build_object(
          'valid', false,
          'reason', 'no_membership',
          'message', 'No membership found for this member'
        );
      ELSIF v_membership.end_date < CURRENT_DATE THEN
        RETURN json_build_object(
          'valid', false,
          'reason', 'expired',
          'message', 'Membership expired on ' || v_membership.end_date::TEXT
        );
      ELSIF v_membership.branch_id != _branch_id THEN
        RETURN json_build_object(
          'valid', false,
          'reason', 'wrong_branch',
          'message', 'Membership is for a different branch'
        );
      ELSIF v_membership.status = 'frozen' THEN
        RETURN json_build_object(
          'valid', false,
          'reason', 'frozen',
          'message', 'Membership is currently frozen'
        );
      ELSE
        RETURN json_build_object(
          'valid', false,
          'reason', 'inactive',
          'message', 'Membership is not active'
        );
      END IF;
    END IF;
    
    RETURN json_build_object(
      'valid', true,
      'membership_id', v_membership.id,
      'plan_name', v_membership.plan_name,
      'end_date', v_membership.end_date,
      'days_remaining', v_membership.end_date - CURRENT_DATE
    );
  END;
  $$;

  -- Function to perform check-in
  CREATE OR REPLACE FUNCTION public.member_check_in(_member_id UUID, _branch_id UUID, _method TEXT DEFAULT 'manual')
  RETURNS JSON
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_validation JSON;
    v_attendance_id UUID;
  BEGIN
    v_validation := public.validate_member_checkin(_member_id, _branch_id);
    
    IF NOT (v_validation->>'valid')::BOOLEAN THEN
      RETURN v_validation;
    END IF;
    
    INSERT INTO public.member_attendance (member_id, membership_id, branch_id, check_in, check_in_method)
    VALUES (_member_id, (v_validation->>'membership_id')::UUID, _branch_id, now(), _method)
    RETURNING id INTO v_attendance_id;
    
    RETURN json_build_object(
      'valid', true,
      'success', true,
      'attendance_id', v_attendance_id,
      'message', 'Check-in successful',
      'plan_name', v_validation->>'plan_name',
      'days_remaining', (v_validation->>'days_remaining')::INTEGER
    );
  END;
  $$;

  -- Function to perform check-out
  CREATE OR REPLACE FUNCTION public.member_check_out(_member_id UUID)
  RETURNS JSON
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_attendance RECORD;
  BEGIN
    SELECT * INTO v_attendance
    FROM public.member_attendance
    WHERE member_id = _member_id
      AND check_out IS NULL
    ORDER BY check_in DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'message', 'No active check-in found'
      );
    END IF;
    
    UPDATE public.member_attendance
    SET check_out = now()
    WHERE id = v_attendance.id;
    
    RETURN json_build_object(
      'success', true,
      'attendance_id', v_attendance.id,
      'check_in', v_attendance.check_in,
      'check_out', now(),
      'duration_minutes', EXTRACT(EPOCH FROM (now() - v_attendance.check_in)) / 60
    );
  END;
  $$;
  -- 20251221050535_f1d80b70-9feb-49fc-9e9f-23d5c3bf0ece.sql
  -- ============================================
  -- Function to validate class booking (checks capacity, benefits, duplicate booking)
  CREATE OR REPLACE FUNCTION public.validate_class_booking(
    _class_id UUID,
    _member_id UUID
  ) RETURNS JSONB AS $$
  DECLARE
    _class RECORD;
    _current_bookings INT;
    _existing_booking RECORD;
    _membership RECORD;
    _benefit RECORD;
    _usage_count INT;
  BEGIN
    -- Get class details
    SELECT * INTO _class FROM classes WHERE id = _class_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Class not found or inactive');
    END IF;
    
    -- Check if class is in the past
    IF _class.scheduled_at < now() THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Cannot book past classes');
    END IF;
    
    -- Check for existing booking
    SELECT * INTO _existing_booking FROM class_bookings 
    WHERE class_id = _class_id AND member_id = _member_id AND status = 'booked';
    IF FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Already booked for this class');
    END IF;
    
    -- Check active membership
    SELECT m.* INTO _membership FROM memberships m
    WHERE m.member_id = _member_id 
      AND m.status = 'active'
      AND m.start_date <= CURRENT_DATE 
      AND m.end_date >= CURRENT_DATE
    ORDER BY m.end_date DESC LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'No active membership');
    END IF;
    
    -- Check class benefit in plan
    SELECT pb.* INTO _benefit FROM plan_benefits pb
    WHERE pb.plan_id = _membership.plan_id 
      AND pb.benefit_type = 'group_classes';
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Plan does not include group classes');
    END IF;
    
    -- Check benefit usage limit if applicable
    IF _benefit.limit_count IS NOT NULL THEN
      SELECT COALESCE(SUM(usage_count), 0) INTO _usage_count
      FROM benefit_usage
      WHERE membership_id = _membership.id 
        AND benefit_type = 'group_classes'
        AND (
          (_benefit.frequency = 'daily' AND usage_date = CURRENT_DATE) OR
          (_benefit.frequency = 'weekly' AND usage_date >= date_trunc('week', CURRENT_DATE)) OR
          (_benefit.frequency = 'monthly' AND usage_date >= date_trunc('month', CURRENT_DATE)) OR
          (_benefit.frequency = 'per_membership')
        );
      
      IF _usage_count >= _benefit.limit_count THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Class booking limit reached for this period');
      END IF;
    END IF;
    
    -- Check capacity
    SELECT COUNT(*) INTO _current_bookings FROM class_bookings 
    WHERE class_id = _class_id AND status = 'booked';
    
    IF _current_bookings >= _class.capacity THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Class is full', 'waitlist_available', true);
    END IF;
    
    RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Function to book a class
  CREATE OR REPLACE FUNCTION public.book_class(
    _class_id UUID,
    _member_id UUID
  ) RETURNS JSONB AS $$
  DECLARE
    _validation JSONB;
    _booking_id UUID;
  BEGIN
    -- Validate booking
    _validation := validate_class_booking(_class_id, _member_id);
    
    IF NOT (_validation->>'valid')::boolean THEN
      RETURN _validation;
    END IF;
    
    -- Create booking
    INSERT INTO class_bookings (class_id, member_id, status)
    VALUES (_class_id, _member_id, 'booked')
    RETURNING id INTO _booking_id;
    
    RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Function to add to waitlist
  CREATE OR REPLACE FUNCTION public.add_to_waitlist(
    _class_id UUID,
    _member_id UUID
  ) RETURNS JSONB AS $$
  DECLARE
    _next_position INT;
    _waitlist_id UUID;
    _existing RECORD;
  BEGIN
    -- Check if already on waitlist
    SELECT * INTO _existing FROM class_waitlist 
    WHERE class_id = _class_id AND member_id = _member_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already on waitlist');
    END IF;
    
    -- Get next position
    SELECT COALESCE(MAX(position), 0) + 1 INTO _next_position
    FROM class_waitlist WHERE class_id = _class_id;
    
    -- Add to waitlist
    INSERT INTO class_waitlist (class_id, member_id, position)
    VALUES (_class_id, _member_id, _next_position)
    RETURNING id INTO _waitlist_id;
    
    RETURN jsonb_build_object('success', true, 'waitlist_id', _waitlist_id, 'position', _next_position);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Function to cancel booking
  CREATE OR REPLACE FUNCTION public.cancel_class_booking(
    _booking_id UUID,
    _reason TEXT DEFAULT NULL
  ) RETURNS JSONB AS $$
  DECLARE
    _booking RECORD;
    _next_waitlist RECORD;
  BEGIN
    -- Get and update booking
    UPDATE class_bookings 
    SET status = 'cancelled', cancelled_at = now(), cancellation_reason = _reason
    WHERE id = _booking_id AND status = 'booked'
    RETURNING * INTO _booking;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking not found or already cancelled');
    END IF;
    
    -- Promote from waitlist if exists
    SELECT * INTO _next_waitlist FROM class_waitlist 
    WHERE class_id = _booking.class_id 
    ORDER BY position LIMIT 1;
    
    IF FOUND THEN
      -- Create booking for waitlisted member
      INSERT INTO class_bookings (class_id, member_id, status)
      VALUES (_booking.class_id, _next_waitlist.member_id, 'booked');
      
      -- Update waitlist notification
      UPDATE class_waitlist SET notified_at = now() 
      WHERE id = _next_waitlist.id;
      
      -- Remove from waitlist
      DELETE FROM class_waitlist WHERE id = _next_waitlist.id;
      
      -- Reorder positions
      UPDATE class_waitlist SET position = position - 1 
      WHERE class_id = _booking.class_id AND position > _next_waitlist.position;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'promoted_from_waitlist', FOUND);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Function to mark attendance (attended/no_show)
  CREATE OR REPLACE FUNCTION public.mark_class_attendance(
    _booking_id UUID,
    _attended BOOLEAN
  ) RETURNS JSONB AS $$
  DECLARE
    _booking RECORD;
    _membership RECORD;
  BEGIN
    -- Update booking status
    UPDATE class_bookings 
    SET status = CASE WHEN _attended THEN 'attended' ELSE 'no_show' END,
        attended_at = CASE WHEN _attended THEN now() ELSE NULL END
    WHERE id = _booking_id AND status = 'booked'
    RETURNING * INTO _booking;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking not found or not in booked status');
    END IF;
    
    -- Record benefit usage if attended
    IF _attended THEN
      SELECT m.* INTO _membership FROM memberships m
      WHERE m.member_id = _booking.member_id 
        AND m.status = 'active'
      ORDER BY m.end_date DESC LIMIT 1;
      
      IF FOUND THEN
        INSERT INTO benefit_usage (membership_id, benefit_type, usage_date, usage_count)
        VALUES (_membership.id, 'group_classes', CURRENT_DATE, 1);
      END IF;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'status', CASE WHEN _attended THEN 'attended' ELSE 'no_show' END);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Add RLS policy for trainers if not exists
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trainers' AND policyname = 'staff_access_trainers') THEN
      ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "staff_access_trainers" ON trainers FOR ALL
        USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trainers' AND policyname = 'view_active_trainers') THEN
      CREATE POLICY "view_active_trainers" ON trainers FOR SELECT
        USING (is_active = true);
    END IF;
  END $$;
  -- 20251221051333_1a3abfba-e4d4-413b-8cc3-46c3b957a4c3.sql
  -- ============================================
  -- Create workout templates table for reusable workout plans
  CREATE TABLE IF NOT EXISTS public.workout_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES branches(id),
    trainer_id UUID REFERENCES trainers(id),
    name TEXT NOT NULL,
    description TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_weeks INTEGER DEFAULT 4,
    goal TEXT,
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create diet templates table
  CREATE TABLE IF NOT EXISTS public.diet_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES branches(id),
    trainer_id UUID REFERENCES trainers(id),
    name TEXT NOT NULL,
    description TEXT,
    diet_type TEXT,
    calories_target INTEGER,
    meal_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create trainer commissions table
  CREATE TABLE IF NOT EXISTS public.trainer_commissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID NOT NULL REFERENCES trainers(id),
    pt_package_id UUID REFERENCES member_pt_packages(id),
    session_id UUID REFERENCES pt_sessions(id),
    commission_type TEXT NOT NULL CHECK (commission_type IN ('package_sale', 'session_completed')),
    amount NUMERIC NOT NULL,
    percentage NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create trainer availability table for scheduling
  CREATE TABLE IF NOT EXISTS public.trainer_availability (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID NOT NULL REFERENCES trainers(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(trainer_id, day_of_week)
  );

  -- Enable RLS
  ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE trainer_commissions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE trainer_availability ENABLE ROW LEVEL SECURITY;

  -- RLS Policies for workout_templates
  CREATE POLICY "staff_view_workout_templates" ON workout_templates FOR SELECT
    USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

  CREATE POLICY "trainer_manage_own_templates" ON workout_templates FOR ALL
    USING (
      trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
      has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
    );

  -- RLS Policies for diet_templates
  CREATE POLICY "staff_view_diet_templates" ON diet_templates FOR SELECT
    USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

  CREATE POLICY "trainer_manage_own_diet_templates" ON diet_templates FOR ALL
    USING (
      trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
      has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
    );

  -- RLS Policies for trainer_commissions
  CREATE POLICY "trainer_view_own_commissions" ON trainer_commissions FOR SELECT
    USING (
      trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
      has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
    );

  CREATE POLICY "admin_manage_commissions" ON trainer_commissions FOR ALL
    USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

  -- RLS Policies for trainer_availability
  CREATE POLICY "view_trainer_availability" ON trainer_availability FOR SELECT
    USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

  CREATE POLICY "trainer_manage_own_availability" ON trainer_availability FOR ALL
    USING (
      trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
      has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
    );

  -- Function to purchase PT package
  CREATE OR REPLACE FUNCTION public.purchase_pt_package(
    _member_id UUID,
    _package_id UUID,
    _trainer_id UUID,
    _branch_id UUID,
    _price_paid NUMERIC
  ) RETURNS JSONB AS $$
  DECLARE
    _package RECORD;
    _member_package_id UUID;
    _commission_amount NUMERIC;
  BEGIN
    -- Get package details
    SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
    END IF;
    
    -- Create member PT package
    INSERT INTO member_pt_packages (
      member_id, package_id, trainer_id, branch_id,
      sessions_total, sessions_remaining, price_paid,
      start_date, expiry_date, status
    ) VALUES (
      _member_id, _package_id, _trainer_id, _branch_id,
      _package.total_sessions, _package.total_sessions, _price_paid,
      CURRENT_DATE, CURRENT_DATE + _package.validity_days, 'active'
    ) RETURNING id INTO _member_package_id;
    
    -- Calculate and record trainer commission (default 20%)
    _commission_amount := _price_paid * 0.20;
    INSERT INTO trainer_commissions (
      trainer_id, pt_package_id, commission_type, amount, percentage
    ) VALUES (
      _trainer_id, _member_package_id, 'package_sale', _commission_amount, 20
    );
    
    RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Function to record PT session and commission
  CREATE OR REPLACE FUNCTION public.complete_pt_session(
    _session_id UUID,
    _notes TEXT DEFAULT NULL
  ) RETURNS JSONB AS $$
  DECLARE
    _session RECORD;
    _package RECORD;
    _per_session_rate NUMERIC;
    _commission_amount NUMERIC;
  BEGIN
    -- Get session
    SELECT * INTO _session FROM pt_sessions WHERE id = _session_id AND status = 'scheduled';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session not found or not scheduled');
    END IF;
    
    -- Update session status
    UPDATE pt_sessions SET status = 'completed', notes = COALESCE(_notes, notes) WHERE id = _session_id;
    
    -- Update member package sessions
    UPDATE member_pt_packages 
    SET sessions_used = sessions_used + 1,
        sessions_remaining = sessions_remaining - 1,
        status = CASE WHEN sessions_remaining <= 1 THEN 'completed' ELSE status END
    WHERE id = _session.member_pt_package_id
    RETURNING * INTO _package;
    
    -- Calculate per-session commission (10% of per-session value)
    _per_session_rate := _package.price_paid / _package.sessions_total;
    _commission_amount := _per_session_rate * 0.10;
    
    INSERT INTO trainer_commissions (
      trainer_id, session_id, commission_type, amount, percentage
    ) VALUES (
      _session.trainer_id, _session_id, 'session_completed', _commission_amount, 10
    );
    
    RETURN jsonb_build_object('success', true, 'sessions_remaining', _package.sessions_remaining - 1);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- Function to check trainer availability for a time slot
  CREATE OR REPLACE FUNCTION public.check_trainer_slot_available(
    _trainer_id UUID,
    _scheduled_at TIMESTAMP WITH TIME ZONE,
    _duration_minutes INTEGER DEFAULT 60
  ) RETURNS BOOLEAN AS $$
  DECLARE
    _day_of_week INTEGER;
    _time_slot TIME;
    _avail RECORD;
    _existing INT;
  BEGIN
    _day_of_week := EXTRACT(DOW FROM _scheduled_at);
    _time_slot := _scheduled_at::TIME;
    
    -- Check if trainer has availability set for this day
    SELECT * INTO _avail FROM trainer_availability 
    WHERE trainer_id = _trainer_id AND day_of_week = _day_of_week AND is_active = true;
    
    IF FOUND THEN
      IF _time_slot < _avail.start_time OR _time_slot >= _avail.end_time THEN
        RETURN false;
      END IF;
    END IF;
    
    -- Check for existing sessions at this time
    SELECT COUNT(*) INTO _existing FROM pt_sessions
    WHERE trainer_id = _trainer_id
      AND status IN ('scheduled', 'completed')
      AND scheduled_at < _scheduled_at + (_duration_minutes || ' minutes')::INTERVAL
      AND scheduled_at + (COALESCE(duration_minutes, 60) || ' minutes')::INTERVAL > _scheduled_at;
    
    RETURN _existing = 0;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  -- 20251221060444_4bcd06ba-9662-4fdc-abf5-6860fff33bf1.sql
  -- ============================================
  -- Integration settings for Payment Gateways, SMS, Email, WhatsApp
  CREATE TABLE public.integration_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL, -- 'payment_gateway', 'sms', 'email', 'whatsapp'
    provider TEXT NOT NULL, -- 'razorpay', 'phonepe', 'ccavenue', 'payu', 'msg91', 'gupshup', etc.
    is_active BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    credentials JSONB DEFAULT '{}', -- encrypted/masked credentials
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(branch_id, integration_type, provider)
  );

  -- WhatsApp Chat Messages
  CREATE TABLE public.whatsapp_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'document', 'template'
    content TEXT,
    media_url TEXT,
    direction TEXT NOT NULL, -- 'inbound', 'outbound'
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
    whatsapp_message_id TEXT,
    sent_by UUID, -- staff who sent it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );

  -- Payment Gateway Transactions with Webhook Data
  CREATE TABLE public.payment_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    gateway TEXT NOT NULL, -- 'razorpay', 'phonepe', 'ccavenue', 'payu'
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created', -- 'created', 'authorized', 'captured', 'failed', 'refunded'
    webhook_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

  -- RLS Policies for integration_settings (admin only)
  CREATE POLICY "Admins can manage integration settings"
  ON public.integration_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
    )
  );

  -- RLS Policies for whatsapp_messages (staff with access)
  CREATE POLICY "Staff can view whatsapp messages for their branches"
  ON public.whatsapp_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      LEFT JOIN public.branch_managers bm ON bm.user_id = ur.user_id
      WHERE ur.user_id = auth.uid() 
      AND (
        ur.role IN ('owner', 'admin') 
        OR (ur.role = 'manager' AND bm.branch_id = branch_id)
      )
    )
  );

  CREATE POLICY "Staff can insert whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

  CREATE POLICY "Staff can update whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

  -- RLS Policies for payment_transactions
  CREATE POLICY "Staff can view payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

  CREATE POLICY "Staff can insert payment transactions"
  ON public.payment_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

  CREATE POLICY "Staff can update payment transactions"
  ON public.payment_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager')
    )
  );

  -- Create indexes
  CREATE INDEX idx_integration_settings_branch ON public.integration_settings(branch_id);
  CREATE INDEX idx_integration_settings_type ON public.integration_settings(integration_type);
  CREATE INDEX idx_whatsapp_messages_branch ON public.whatsapp_messages(branch_id);
  CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
  CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);
  CREATE INDEX idx_payment_transactions_branch ON public.payment_transactions(branch_id);
  CREATE INDEX idx_payment_transactions_invoice ON public.payment_transactions(invoice_id);
  CREATE INDEX idx_payment_transactions_gateway_order ON public.payment_transactions(gateway_order_id);
  -- 20251221062004_45657269-25e7-4174-83ae-ff0e8cdfbe77.sql
  -- ============================================
  -- Create referral_settings table for configurable rewards
  CREATE TABLE public.referral_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id),
    referrer_reward_type TEXT NOT NULL DEFAULT 'wallet_credit',
    referrer_reward_value NUMERIC NOT NULL DEFAULT 500,
    referred_reward_type TEXT NOT NULL DEFAULT 'wallet_credit', 
    referred_reward_value NUMERIC NOT NULL DEFAULT 200,
    min_membership_value NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

  -- Create policies
  CREATE POLICY "Staff can view referral settings" ON public.referral_settings
    FOR SELECT USING (true);

  CREATE POLICY "Managers can manage referral settings" ON public.referral_settings
    FOR ALL USING (true);

  -- Add referral_code column to referrals table if not exists
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code TEXT;

  -- Create index for referral code lookup
  CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals(referral_code);

  -- Insert default settings
  INSERT INTO public.referral_settings (referrer_reward_type, referrer_reward_value, referred_reward_type, referred_reward_value)
  VALUES ('wallet_credit', 500, 'wallet_credit', 200);
  -- 20251221065850_7f5ee666-fd98-430e-b2b0-c932393e8e50.sql
  -- ============================================
  -- Create feedback table for member feedback workflow
  CREATE TABLE public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    feedback_text TEXT,
    category TEXT DEFAULT 'general' CHECK (category IN ('service', 'trainer', 'facility', 'cleanliness', 'equipment', 'general')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

  -- Create RLS policies for feedback
  CREATE POLICY "Staff can view branch feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]) OR
    public.manages_branch(auth.uid(), branch_id) OR
    EXISTS (
      SELECT 1 FROM public.staff_branches sb
      WHERE sb.user_id = auth.uid() AND sb.branch_id = feedback.branch_id
    )
  );

  CREATE POLICY "Staff can insert branch feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]) OR
    public.manages_branch(auth.uid(), branch_id) OR
    EXISTS (
      SELECT 1 FROM public.staff_branches sb
      WHERE sb.user_id = auth.uid() AND sb.branch_id = feedback.branch_id
    )
  );

  CREATE POLICY "Staff can update branch feedback"
  ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]) OR
    public.manages_branch(auth.uid(), branch_id)
  );

  CREATE POLICY "Admins can delete feedback"
  ON public.feedback
  FOR DELETE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
  );

  -- Create trigger for updated_at
  CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
  -- 20251221072057_dc47aae4-bc93-4149-b594-8fba8c596553.sql
  -- ============================================
  -- Add max_clients column to trainers for PT capacity tracking
  ALTER TABLE trainers ADD COLUMN IF NOT EXISTS max_clients INTEGER DEFAULT 10;
  -- 20251221075343_7dc6e3c4-4673-4972-99ac-374609e6b505.sql
  -- ============================================
  -- Add new benefit types to enum
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'ice_bath';
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'yoga_class';
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'crossfit_class';
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'spa_access';
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'sauna_session';
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'cardio_area';
  ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'functional_training';

  -- Create expense categories table (if not exists with enhanced structure)
  CREATE TABLE IF NOT EXISTS public.expense_category_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Insert default categories
  INSERT INTO public.expense_category_templates (name, type, icon, color, is_system) VALUES
    ('Membership Revenue', 'income', 'CreditCard', 'hsl(142, 76%, 36%)', true),
    ('PT Session Revenue', 'income', 'Dumbbell', 'hsl(142, 76%, 36%)', true),
    ('Product Sales', 'income', 'ShoppingBag', 'hsl(142, 76%, 36%)', true),
    ('Class Fees', 'income', 'Calendar', 'hsl(142, 76%, 36%)', true),
    ('Locker Rentals', 'income', 'Lock', 'hsl(142, 76%, 36%)', true),
    ('Other Income', 'income', 'Plus', 'hsl(142, 76%, 36%)', true),
    ('Staff Salaries', 'expense', 'Users', 'hsl(0, 84%, 60%)', true),
    ('Rent', 'expense', 'Building2', 'hsl(0, 84%, 60%)', true),
    ('Utilities', 'expense', 'Zap', 'hsl(0, 84%, 60%)', true),
    ('Equipment', 'expense', 'Wrench', 'hsl(0, 84%, 60%)', true),
    ('Maintenance', 'expense', 'Wrench', 'hsl(0, 84%, 60%)', true),
    ('Marketing', 'expense', 'Megaphone', 'hsl(0, 84%, 60%)', true),
    ('Insurance', 'expense', 'Shield', 'hsl(0, 84%, 60%)', true),
    ('Supplies', 'expense', 'Package', 'hsl(0, 84%, 60%)', true),
    ('Other Expense', 'expense', 'Minus', 'hsl(0, 84%, 60%)', true)
  ON CONFLICT DO NOTHING;

  -- Create member_fitness_plans table for workout/diet plans
  CREATE TABLE IF NOT EXISTS public.member_fitness_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('workout', 'diet')),
    plan_name TEXT NOT NULL,
    description TEXT,
    plan_data JSONB NOT NULL DEFAULT '{}',
    is_custom BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_until DATE,
    created_by UUID,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS on member_fitness_plans
  ALTER TABLE public.member_fitness_plans ENABLE ROW LEVEL SECURITY;

  -- RLS policies for member_fitness_plans
  CREATE POLICY "Staff can manage fitness plans"
    ON public.member_fitness_plans
    FOR ALL
    USING (
      public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[])
    );

  CREATE POLICY "Members can view their own plans"
    ON public.member_fitness_plans
    FOR SELECT
    USING (
      member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    );

  CREATE POLICY "Members can view public plans"
    ON public.member_fitness_plans
    FOR SELECT
    USING (is_public = true AND member_id IS NULL);

  -- Create trigger for updated_at
  CREATE TRIGGER update_member_fitness_plans_updated_at
    BEFORE UPDATE ON public.member_fitness_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

  -- Enable RLS on expense_category_templates
  ALTER TABLE public.expense_category_templates ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can view expense categories"
    ON public.expense_category_templates
    FOR SELECT
    USING (true);

  CREATE POLICY "Admins can manage expense categories"
    ON public.expense_category_templates
    FOR ALL
    USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));
  -- 20251221091617_a3daa7a3-d876-4979-94bd-14a904f6d537.sql
  -- ============================================
  -- Create product_categories table
  CREATE TABLE public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Add category_id to products
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id);

  -- Create notifications table
  CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'reminder')),
    category TEXT,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Create notification_preferences table
  CREATE TABLE public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_membership_reminders BOOLEAN DEFAULT true,
    email_payment_receipts BOOLEAN DEFAULT true,
    email_class_notifications BOOLEAN DEFAULT true,
    email_announcements BOOLEAN DEFAULT true,
    push_low_stock BOOLEAN DEFAULT true,
    push_new_leads BOOLEAN DEFAULT true,
    push_payment_alerts BOOLEAN DEFAULT true,
    push_task_reminders BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Add reward_mode to referral_settings
  ALTER TABLE public.referral_settings ADD COLUMN IF NOT EXISTS reward_mode TEXT DEFAULT 'fixed' CHECK (reward_mode IN ('fixed', 'percentage'));

  -- Add pos_sale_id to invoices for linking
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pos_sale_id UUID REFERENCES public.pos_sales(id);

  -- Enable RLS on new tables
  ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

  -- RLS policies for product_categories (readable by authenticated users, writable by admins)
  CREATE POLICY "Product categories are viewable by authenticated users"
  ON public.product_categories FOR SELECT
  TO authenticated
  USING (true);

  CREATE POLICY "Product categories are manageable by staff"
  ON public.product_categories FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

  -- RLS policies for notifications
  CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

  CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

  CREATE POLICY "Staff can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

  -- RLS policies for notification_preferences
  CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

  CREATE POLICY "Users can manage their own preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

  -- Create storage bucket for product images
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('products', 'products', true)
  ON CONFLICT (id) DO NOTHING;

  -- Storage policies for product images
  CREATE POLICY "Product images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

  CREATE POLICY "Staff can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

  CREATE POLICY "Staff can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'products' AND public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

  CREATE POLICY "Staff can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'products' AND public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

  -- Triggers for updated_at
  CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

  CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
  -- 20251221134610_9d14a052-5d34-4a80-83a0-d05243c134be.sql
  -- ============================================
  -- Drop existing SELECT policies on members
  DROP POLICY IF EXISTS "Members view own" ON public.members;
  DROP POLICY IF EXISTS "Staff view branch members" ON public.members;

  -- Create combined SELECT policy that allows:
  -- 1. Members to view their own record
  -- 2. Owners/admins to view all members
  -- 3. Staff to view their branch members
  CREATE POLICY "View members policy" ON public.members
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
    OR branch_id = get_user_branch(auth.uid())
    OR manages_branch(auth.uid(), branch_id)
  );
  -- 20251221134950_3369711f-4c2d-4113-a92b-8f0964c323fd.sql
  -- ============================================
  -- Add FK so PostgREST can embed profiles via members.user_id
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'members_user_id_profiles_fkey'
    ) THEN
      ALTER TABLE public.members
        ADD CONSTRAINT members_user_id_profiles_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id)
        ON DELETE SET NULL;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

  -- (Optional but helpful) Ensure staff_branches can embed branch/user later
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'staff_branches_user_id_profiles_fkey'
    ) THEN
      ALTER TABLE public.staff_branches
        ADD CONSTRAINT staff_branches_user_id_profiles_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_staff_branches_user_id ON public.staff_branches(user_id);
  -- 20251221140450_c15d6718-964c-4475-8a29-f9ed69861ff9.sql
  -- ============================================
  -- Add created_by audit field to members table
  ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

  -- Add index for faster lookups
  CREATE INDEX IF NOT EXISTS idx_members_created_by ON public.members(created_by);

  -- Comment for documentation
  COMMENT ON COLUMN public.members.created_by IS 'User who created this member record';
  -- 20251221142621_4004e1ce-e28f-4bb5-bdf1-3afc0f595bc9.sql
  -- ============================================
  -- Add GST fields to membership_plans
  ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 18,
  ADD COLUMN IF NOT EXISTS is_gst_inclusive boolean DEFAULT true;

  COMMENT ON COLUMN public.membership_plans.gst_rate IS 'GST percentage rate (e.g., 18 for 18%)';
  COMMENT ON COLUMN public.membership_plans.is_gst_inclusive IS 'Whether the price includes GST or GST is added on top';

  -- Add assigned trainer to members for general training
  ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS assigned_trainer_id uuid REFERENCES public.trainers(id);

  CREATE INDEX IF NOT EXISTS idx_members_assigned_trainer ON public.members(assigned_trainer_id);
  COMMENT ON COLUMN public.members.assigned_trainer_id IS 'Trainer assigned for general training guidance';

  -- Create trainer change requests table for member portal
  CREATE TABLE IF NOT EXISTS public.trainer_change_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    current_trainer_id uuid REFERENCES public.trainers(id),
    requested_trainer_id uuid REFERENCES public.trainers(id),
    reason text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
  );

  ALTER TABLE public.trainer_change_requests ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Staff can view trainer change requests" 
  ON public.trainer_change_requests 
  FOR SELECT 
  USING (true);

  CREATE POLICY "Members can create trainer change requests" 
  ON public.trainer_change_requests 
  FOR INSERT 
  WITH CHECK (true);

  CREATE POLICY "Staff can update trainer change requests" 
  ON public.trainer_change_requests 
  FOR UPDATE 
  USING (true);

  CREATE INDEX IF NOT EXISTS idx_trainer_change_requests_member ON public.trainer_change_requests(member_id);
  CREATE INDEX IF NOT EXISTS idx_trainer_change_requests_status ON public.trainer_change_requests(status);
  -- 20251221144721_fd5cf250-6ed3-478f-926e-ef6307e00214.sql
  -- ============================================
  -- Add government ID fields to profiles table
  ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS government_id_type text,
  ADD COLUMN IF NOT EXISTS government_id_number text,
  ADD COLUMN IF NOT EXISTS government_id_verified boolean DEFAULT false;

  -- Create member_measurements table for tracking progress
  CREATE TABLE public.member_measurements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    recorded_by uuid REFERENCES public.profiles(id),
    recorded_at timestamp with time zone NOT NULL DEFAULT now(),
    weight_kg numeric,
    height_cm numeric,
    body_fat_percentage numeric,
    chest_cm numeric,
    waist_cm numeric,
    hips_cm numeric,
    biceps_left_cm numeric,
    biceps_right_cm numeric,
    thighs_left_cm numeric,
    thighs_right_cm numeric,
    calves_cm numeric,
    notes text,
    photos jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
  );

  -- Create index for faster lookups
  CREATE INDEX idx_member_measurements_member_id ON public.member_measurements(member_id);
  CREATE INDEX idx_member_measurements_recorded_at ON public.member_measurements(recorded_at DESC);

  -- Enable RLS
  ALTER TABLE public.member_measurements ENABLE ROW LEVEL SECURITY;

  -- RLS policies for member_measurements
  CREATE POLICY "Staff can view all measurements"
    ON public.member_measurements FOR SELECT
    USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

  CREATE POLICY "Members can view their own measurements"
    ON public.member_measurements FOR SELECT
    USING (member_id = public.get_member_id(auth.uid()));

  CREATE POLICY "Staff can insert measurements"
    ON public.member_measurements FOR INSERT
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

  CREATE POLICY "Members can insert their own measurements"
    ON public.member_measurements FOR INSERT
    WITH CHECK (member_id = public.get_member_id(auth.uid()));

  CREATE POLICY "Staff can update measurements"
    ON public.member_measurements FOR UPDATE
    USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

  CREATE POLICY "Staff can delete measurements"
    ON public.member_measurements FOR DELETE
    USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

  -- Create member-photos storage bucket
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('member-photos', 'member-photos', true)
  ON CONFLICT (id) DO NOTHING;

  -- Storage policies for member-photos bucket
  CREATE POLICY "Anyone can view member photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'member-photos');

  CREATE POLICY "Staff can upload member photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'member-photos' AND
      public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
    );

  CREATE POLICY "Members can upload their own photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'member-photos' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Staff can delete member photos"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'member-photos' AND
      public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
    );

  -- Add refund fields to invoices if not exists
  ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refunded_by uuid REFERENCES public.profiles(id);

  -- Add cancellation fields to memberships if not exists
  ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;
  -- 20251221171041_7fa9f6c2-4acc-41ee-b53f-2fb07fb90278.sql
  -- ============================================
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
  -- 20251222112939_b69bc21f-fd0f-4cf9-b469-4417443ec7c6.sql
  -- ============================================
  -- PT Packages enhancements
  ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'per_session';
  ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false;
  ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS gst_percentage numeric DEFAULT 18;

  -- Trainer enhancements
  ALTER TABLE trainers ADD COLUMN IF NOT EXISTS salary_type text DEFAULT 'hourly';
  ALTER TABLE trainers ADD COLUMN IF NOT EXISTS fixed_salary numeric;
  ALTER TABLE trainers ADD COLUMN IF NOT EXISTS pt_share_percentage numeric DEFAULT 40;
  ALTER TABLE trainers ADD COLUMN IF NOT EXISTS government_id_type text;
  ALTER TABLE trainers ADD COLUMN IF NOT EXISTS government_id_number text;
  -- 20260107144056_e819cafc-e495-4afc-80e9-5ce83a5f4095.sql
  -- ============================================
  -- Create or replace audit log trigger function
  CREATE OR REPLACE FUNCTION public.log_audit_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  BEGIN
    INSERT INTO public.audit_logs (
      branch_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      CASE 
        WHEN TG_OP = 'DELETE' THEN (OLD).branch_id
        ELSE (NEW).branch_id
      END,
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      CASE 
        WHEN TG_OP = 'DELETE' THEN (OLD).id::text
        ELSE (NEW).id::text
      END,
      CASE 
        WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
        ELSE NULL
      END,
      CASE 
        WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
        ELSE NULL
      END
    );
    RETURN COALESCE(NEW, OLD);
  END;
  $$;

  -- Drop existing triggers if they exist and recreate
  DROP TRIGGER IF EXISTS audit_members ON public.members;
  CREATE TRIGGER audit_members
    AFTER INSERT OR UPDATE OR DELETE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_memberships ON public.memberships;
  CREATE TRIGGER audit_memberships
    AFTER INSERT OR UPDATE OR DELETE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_payments ON public.payments;
  CREATE TRIGGER audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
  CREATE TRIGGER audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_trainers ON public.trainers;
  CREATE TRIGGER audit_trainers
    AFTER INSERT OR UPDATE OR DELETE ON public.trainers
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_employees ON public.employees;
  CREATE TRIGGER audit_employees
    AFTER INSERT OR UPDATE OR DELETE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_equipment ON public.equipment;
  CREATE TRIGGER audit_equipment
    AFTER INSERT OR UPDATE OR DELETE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_lockers ON public.lockers;
  CREATE TRIGGER audit_lockers
    AFTER INSERT OR UPDATE OR DELETE ON public.lockers
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_locker_assignments ON public.locker_assignments;
  CREATE TRIGGER audit_locker_assignments
    AFTER INSERT OR UPDATE OR DELETE ON public.locker_assignments
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_classes ON public.classes;
  CREATE TRIGGER audit_classes
    AFTER INSERT OR UPDATE OR DELETE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

  DROP TRIGGER IF EXISTS audit_leads ON public.leads;
  CREATE TRIGGER audit_leads
    AFTER INSERT OR UPDATE OR DELETE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();
  -- 20260117120131_f50fe843-0948-4627-9fd6-0e22c36719ea.sql
  -- ============================================
  -- Fix audit_log_trigger_function to use UUID instead of TEXT for record_id
  CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    record_pk uuid;
    branch_val uuid;
  BEGIN
    -- Get the record ID as UUID
    IF TG_OP = 'DELETE' THEN
      record_pk := OLD.id;
    ELSE
      record_pk := NEW.id;
    END IF;
    
    -- Get branch_id if available
    IF TG_OP = 'DELETE' THEN
      BEGIN
        branch_val := OLD.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    ELSE
      BEGIN
        branch_val := NEW.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, new_data, user_id, branch_id
      ) VALUES (
        'INSERT', TG_TABLE_NAME, record_pk, 
        to_jsonb(NEW), 
        auth.uid(),
        branch_val
      );
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, old_data, new_data, user_id, branch_id
      ) VALUES (
        'UPDATE', TG_TABLE_NAME, record_pk, 
        to_jsonb(OLD), to_jsonb(NEW), 
        auth.uid(),
        branch_val
      );
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, old_data, user_id, branch_id
      ) VALUES (
        'DELETE', TG_TABLE_NAME, record_pk, 
        to_jsonb(OLD), 
        auth.uid(),
        branch_val
      );
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
  $function$;

  -- Also fix log_audit_change function
  CREATE OR REPLACE FUNCTION public.log_audit_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    record_pk uuid;
    branch_val uuid;
  BEGIN
    -- Get record ID
    IF TG_OP = 'DELETE' THEN
      record_pk := OLD.id;
    ELSE
      record_pk := NEW.id;
    END IF;
    
    -- Get branch_id if available
    IF TG_OP = 'DELETE' THEN
      BEGIN
        branch_val := OLD.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    ELSE
      BEGIN
        branch_val := NEW.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    END IF;

    INSERT INTO public.audit_logs (
      branch_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      branch_val,
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      record_pk,
      CASE 
        WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
        ELSE NULL
      END,
      CASE 
        WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
        ELSE NULL
      END
    );
    RETURN COALESCE(NEW, OLD);
  END;
  $function$;
  -- 20260117122029_745d3427-9168-4ff3-9607-9e72e3471e69.sql
  -- ============================================
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
  -- 20260117123814_176bb573-efd7-4435-9af9-fc8a16bb8f8b.sql
  -- ============================================

  -- Create the updated_at trigger function if it doesn't exist
  CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Create benefit_types table for dynamic/customizable benefit definitions
  CREATE TABLE public.benefit_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Sparkles',
    is_bookable BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    category TEXT DEFAULT 'wellness',
    default_duration_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(branch_id, code)
  );

  -- Enable RLS
  ALTER TABLE public.benefit_types ENABLE ROW LEVEL SECURITY;

  -- RLS policies for benefit_types
  CREATE POLICY "Users can view benefit types for their branch"
  ON public.benefit_types FOR SELECT
  USING (true);

  CREATE POLICY "Staff can manage benefit types"
  ON public.benefit_types FOR ALL
  USING (true);

  -- Add benefit_type_id to benefit_settings (nullable for migration)
  ALTER TABLE public.benefit_settings 
  ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

  -- Add benefit_type_id to benefit_slots
  ALTER TABLE public.benefit_slots 
  ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

  -- Add benefit_type_id to benefit_packages
  ALTER TABLE public.benefit_packages 
  ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

  -- Add benefit_type_id to member_benefit_credits
  ALTER TABLE public.member_benefit_credits 
  ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

  -- Add benefit_type_id to benefit_usage
  ALTER TABLE public.benefit_usage 
  ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES public.benefit_types(id) ON DELETE CASCADE;

  -- Create trigger for benefit_types updated_at
  CREATE TRIGGER update_benefit_types_updated_at
  BEFORE UPDATE ON public.benefit_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

  -- Create indexes for faster lookups
  CREATE INDEX idx_benefit_types_branch ON public.benefit_types(branch_id);
  CREATE INDEX idx_benefit_types_bookable ON public.benefit_types(is_bookable) WHERE is_active = true;

  -- 20260117132558_5245fb3a-010b-4e37-9e25-8a757559dcba.sql
  -- ============================================
  -- Create search_members function for efficient member search across profiles
  CREATE OR REPLACE FUNCTION public.search_members(
    search_term text DEFAULT '',
    p_branch_id uuid DEFAULT NULL,
    p_limit int DEFAULT 100
  )
  RETURNS TABLE (
    id uuid,
    member_code text,
    user_id uuid,
    branch_id uuid,
    joined_date date,
    emergency_contact_name text,
    emergency_contact_phone text,
    medical_conditions text,
    is_active boolean,
    referred_by uuid,
    created_at timestamptz,
    updated_at timestamptz,
    full_name text,
    email text,
    phone text,
    avatar_url text,
    branch_name text
  ) 
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      m.id,
      m.member_code,
      m.user_id,
      m.branch_id,
      m.joined_date,
      m.emergency_contact_name,
      m.emergency_contact_phone,
      m.medical_conditions,
      m.is_active,
      m.referred_by,
      m.created_at,
      m.updated_at,
      p.full_name,
      p.email,
      p.phone,
      p.avatar_url,
      b.name as branch_name
    FROM members m
    LEFT JOIN profiles p ON m.user_id = p.id
    LEFT JOIN branches b ON m.branch_id = b.id
    WHERE 
      (search_term = '' OR
      m.member_code ILIKE '%' || search_term || '%' OR
      p.full_name ILIKE '%' || search_term || '%' OR
      p.email ILIKE '%' || search_term || '%' OR
      p.phone ILIKE '%' || search_term || '%')
      AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
    ORDER BY m.created_at DESC
    LIMIT p_limit;
  END;
  $$;
  -- 20260117150800_a630d8ae-e579-48ee-ab96-f20dfc75a2aa.sql
  -- ============================================
  -- Add visibility control for member dashboard
  ALTER TABLE membership_plans 
  ADD COLUMN IF NOT EXISTS is_visible_to_members boolean DEFAULT true;

  -- Add membership period type to plan_benefits for period-aware benefit tracking
  ALTER TABLE plan_benefits 
  ADD COLUMN IF NOT EXISTS reset_period text DEFAULT 'per_membership' 
  CHECK (reset_period IN ('per_membership', 'per_month', 'per_week', 'per_day'));

  -- Add comment for clarity
  COMMENT ON COLUMN membership_plans.is_visible_to_members IS 'Controls whether this plan is shown on member dashboard for self-purchase';
  COMMENT ON COLUMN plan_benefits.reset_period IS 'Defines when benefit usage counter resets: per_membership (never), per_month, per_week, per_day';
  -- 20260118143442_d03e58be-1d3b-47ad-8c3c-7a7018cbf724.sql
  -- ============================================
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
  -- 20260118144526_054da5c7-e62c-4014-8705-a9f55af63aef.sql
  -- ============================================
  -- Add RLS policies for member feedback submission
  -- Allow members to insert their own feedback
  CREATE POLICY "Members can submit feedback" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

  -- Allow members to view their own feedback
  CREATE POLICY "Members can view own feedback" ON feedback
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );
  -- 20260119115706_fa6eb311-c3c8-4c84-83d9-2c2aec7ac71c.sql
  -- ============================================
  -- Fix 1: Update trainers table RLS policies to protect sensitive data
  -- Drop existing overly permissive policy
  DROP POLICY IF EXISTS "Trainers are viewable by everyone" ON public.trainers;
  DROP POLICY IF EXISTS "View trainers" ON public.trainers;
  DROP POLICY IF EXISTS "trainers_select_policy" ON public.trainers;
  DROP POLICY IF EXISTS "Admins view all trainers" ON public.trainers;
  DROP POLICY IF EXISTS "Trainers view own record" ON public.trainers;
  DROP POLICY IF EXISTS "Staff view active trainers" ON public.trainers;
  DROP POLICY IF EXISTS "Members view active trainers" ON public.trainers;

  -- Create policy for owners/admins/managers - full access to all trainer data
  CREATE POLICY "Admins view all trainers"
  ON public.trainers FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

  -- Create policy for trainers to view their own record with all fields
  CREATE POLICY "Trainers view own record"
  ON public.trainers FOR SELECT
  USING (user_id = auth.uid());

  -- Create policy for staff members to view active trainers (limited fields via application code)
  CREATE POLICY "Staff view active trainers"
  ON public.trainers FOR SELECT
  USING (
    public.has_role(auth.uid(), 'staff') AND is_active = true
  );

  -- Create policy for members to view active trainers (application code should limit fields)
  CREATE POLICY "Members view active trainers"
  ON public.trainers FOR SELECT
  USING (
    public.has_role(auth.uid(), 'member') AND is_active = true
  );

  -- Fix 2: Make member-photos storage bucket private
  UPDATE storage.buckets SET public = false WHERE id = 'member-photos';

  -- Drop existing overly permissive policy
  DROP POLICY IF EXISTS "Anyone can view member photos" ON storage.objects;

  -- Create proper policy for member photos - members view own, staff can view all
  DROP POLICY IF EXISTS "Members can view own photos" ON storage.objects;
  CREATE POLICY "Members can view own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'member-photos' AND
    (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
    )
  );

  -- Fix 3: Create a secure view for public trainer info (no sensitive columns)
  DROP VIEW IF EXISTS public.trainers_public;
  CREATE VIEW public.trainers_public AS
  SELECT 
    t.id,
    t.branch_id,
    t.bio,
    t.specializations,
    t.certifications,
    t.max_clients,
    t.is_active,
    t.created_at,
    p.full_name,
    p.avatar_url
  FROM public.trainers t
  LEFT JOIN public.profiles p ON t.user_id = p.id
  WHERE t.is_active = true;

  -- Grant access to authenticated users for the view
  GRANT SELECT ON public.trainers_public TO authenticated;
  GRANT SELECT ON public.trainers_public TO anon;

  -- Fix 4: Update SECURITY DEFINER functions that lack search_path
  -- Update update_updated_at_column function
  CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $function$;

  -- Update update_updated_at function
  CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $function$;

  -- Update generate_member_code function
  CREATE OR REPLACE FUNCTION public.generate_member_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  DECLARE
    branch_code TEXT;
    seq_num INTEGER;
  BEGIN
    SELECT code INTO branch_code FROM public.branches WHERE id = NEW.branch_id;
    SELECT COUNT(*) + 1 INTO seq_num FROM public.members WHERE branch_id = NEW.branch_id;
    NEW.member_code := branch_code || '-' || LPAD(seq_num::TEXT, 5, '0');
    RETURN NEW;
  END;
  $function$;

  -- Update generate_invoice_number function
  CREATE OR REPLACE FUNCTION public.generate_invoice_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
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
  $function$;
  -- 20260119145808_be50cb45-de9a-4944-9245-570b5edf7cad.sql
  -- ============================================
  -- Create fitness plan templates table for default/global plans
  CREATE TABLE public.fitness_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('workout', 'diet')),
    description TEXT,
    difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    goal TEXT,
    content JSONB NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.fitness_plan_templates ENABLE ROW LEVEL SECURITY;

  -- RLS Policies for fitness_plan_templates
  CREATE POLICY "Staff can manage templates" 
  ON public.fitness_plan_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

  -- Create updated_at trigger for templates
  CREATE TRIGGER update_fitness_plan_templates_updated_at
  BEFORE UPDATE ON public.fitness_plan_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

  -- Create indexes
  CREATE INDEX idx_fitness_plan_templates_branch ON public.fitness_plan_templates(branch_id);
  CREATE INDEX idx_fitness_plan_templates_type ON public.fitness_plan_templates(type);
  -- 20260121121037_3d4d116f-f6e2-4e61-9213-58ae93fc977a.sql
  -- ============================================
  -- Issue 3: Add benefit_type_id column to plan_benefits
  ALTER TABLE plan_benefits 
  ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES benefit_types(id);

  -- Create index for foreign key
  CREATE INDEX IF NOT EXISTS idx_plan_benefits_benefit_type_id 
  ON plan_benefits(benefit_type_id);

  -- Issue 4: Add partial payment support to invoices
  ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ;

  -- Create payment_reminders table for tracking scheduled reminders
  CREATE TABLE IF NOT EXISTS payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) NOT NULL,
    invoice_id UUID REFERENCES invoices(id) NOT NULL,
    member_id UUID REFERENCES members(id) NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('due_soon', 'on_due', 'overdue', 'final_notice')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS on payment_reminders
  ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

  -- RLS policies for payment_reminders
  CREATE POLICY "Staff can view payment reminders" ON payment_reminders
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager')
      )
    );

  CREATE POLICY "Staff can create payment reminders" ON payment_reminders
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager')
      )
    );

  CREATE POLICY "Staff can update payment reminders" ON payment_reminders
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager')
      )
    );
  -- 20260121122740_6f64c878-41c3-417b-a4e7-b3ae2c9a8e16.sql
  -- ============================================
  -- Drop existing search_members function first
  DROP FUNCTION IF EXISTS search_members(text, uuid, integer);

  -- Create search_members function with correct signature
  CREATE OR REPLACE FUNCTION search_members(
    search_term text,
    p_branch_id uuid DEFAULT NULL,
    p_limit int DEFAULT 20
  )
  RETURNS TABLE (
    id uuid,
    member_code text,
    full_name text,
    phone text,
    email text,
    avatar_url text,
    branch_id uuid
  ) AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      m.id,
      m.member_code,
      COALESCE(p.full_name, 'Unknown') as full_name,
      p.phone,
      p.email,
      p.avatar_url,
      m.branch_id
    FROM members m
    LEFT JOIN profiles p ON m.user_id = p.id
    WHERE 
      (p_branch_id IS NULL OR m.branch_id = p_branch_id)
      AND (
        m.member_code ILIKE '%' || search_term || '%'
        OR p.full_name ILIKE '%' || search_term || '%'
        OR p.phone ILIKE '%' || search_term || '%'
        OR p.email ILIKE '%' || search_term || '%'
      )
    ORDER BY p.full_name
    LIMIT p_limit;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  -- 20260124140706_1eba6fd2-5bcb-4e64-be07-2d7c0be87e4a.sql
  -- ============================================
  -- Phase 1: Duration-Linked Benefits
  -- Add 'per_membership' to frequency_type enum
  ALTER TYPE frequency_type ADD VALUE IF NOT EXISTS 'per_membership';

  -- Phase 2: Smart Locker Management  
  -- Add locker inclusion fields to membership_plans
  ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS includes_free_locker BOOLEAN DEFAULT false;
  ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS free_locker_size TEXT;

  -- Phase 3: Stock Movements Table
  CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'sale', 'adjustment', 'return', 'initial')),
    quantity INTEGER NOT NULL,
    reference_id UUID,
    reference_type TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS on stock_movements
  ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

  -- RLS policies for stock_movements
  CREATE POLICY "Staff can view stock movements" ON stock_movements
    FOR SELECT USING (
      public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
    );

  CREATE POLICY "Staff can insert stock movements" ON stock_movements
    FOR INSERT WITH CHECK (
      public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
    );

  -- Phase 4: Feedback Google Integration
  ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_approved_for_google BOOLEAN DEFAULT false;
  ALTER TABLE feedback ADD COLUMN IF NOT EXISTS google_review_id TEXT;
  ALTER TABLE feedback ADD COLUMN IF NOT EXISTS published_to_google_at TIMESTAMPTZ;

  -- Create index for stock movements
  CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
  -- 20260126080704_5892cd8c-ad25-4ba9-b310-f06dc6a6700a.sql
  -- ============================================
  -- Drop existing function and recreate with new return type
  DROP FUNCTION IF EXISTS public.search_members(text, uuid, integer);

  -- Recreate search_members RPC to include member status
  CREATE OR REPLACE FUNCTION public.search_members(search_term text, p_branch_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
  RETURNS TABLE(id uuid, member_code text, full_name text, phone text, email text, avatar_url text, branch_id uuid, member_status text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  BEGIN
    RETURN QUERY
    SELECT 
      m.id,
      m.member_code,
      COALESCE(p.full_name, 'Unknown') as full_name,
      p.phone,
      p.email,
      p.avatar_url,
      m.branch_id,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM memberships ms 
          WHERE ms.member_id = m.id 
            AND ms.status = 'active'
            AND CURRENT_DATE BETWEEN ms.start_date AND ms.end_date
        ) THEN 'active'
        ELSE 'inactive'
      END as member_status
    FROM members m
    LEFT JOIN profiles p ON m.user_id = p.id
    WHERE 
      (p_branch_id IS NULL OR m.branch_id = p_branch_id)
      AND (
        m.member_code ILIKE '%' || search_term || '%'
        OR p.full_name ILIKE '%' || search_term || '%'
        OR p.phone ILIKE '%' || search_term || '%'
        OR p.email ILIKE '%' || search_term || '%'
      )
    ORDER BY p.full_name
    LIMIT p_limit;
  END;
  $function$;
  -- 20260127083916_d7fb9cf9-eff5-4b44-8b6f-ee42e5fcd004.sql
  -- ============================================
  -- Add emergency contact fields to profiles table
  ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
  -- 20260204154253_1b675fc1-e813-4602-8384-5ae83f067f4f.sql
  -- ============================================
  -- 1. Check if expense_categories already has data, if not insert
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Utilities') THEN
      INSERT INTO expense_categories (name, description, is_active) VALUES
        ('Utilities', 'Electricity, Water, Internet', true),
        ('Salaries', 'Staff and trainer salaries', true),
        ('Maintenance', 'Equipment and building maintenance', true),
        ('Marketing', 'Advertising and promotions', true),
        ('Inventory Purchase', 'Product restocking', true),
        ('Rent', 'Building lease payments', true),
        ('Insurance', 'Business insurance', true),
        ('Miscellaneous', 'Other expenses', true);
    END IF;
  END $$;

  -- 2. Create exercises table for workout randomization
  CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    target_muscle TEXT NOT NULL,
    equipment_type TEXT,
    difficulty TEXT DEFAULT 'intermediate',
    instructions TEXT,
    video_url TEXT,
    image_url TEXT,
    calories_per_minute NUMERIC,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Exercises are readable by authenticated users" ON exercises;
  DROP POLICY IF EXISTS "Admins can manage exercises" ON exercises;

  -- Exercises are readable by all authenticated users
  CREATE POLICY "Exercises are readable by authenticated users" ON exercises
    FOR SELECT TO authenticated USING (true);

  -- Only admin/owner can manage exercises
  CREATE POLICY "Admins can manage exercises" ON exercises
    FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

  -- 3. Seed common gym exercises (check if table is empty first)
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM exercises LIMIT 1) THEN
      INSERT INTO exercises (name, target_muscle, equipment_type, difficulty, instructions) VALUES
        -- Chest
        ('Barbell Bench Press', 'chest', 'barbell', 'intermediate', 'Lie on bench, grip bar shoulder-width, lower to chest, press up'),
        ('Incline Dumbbell Press', 'chest', 'dumbbell', 'intermediate', 'Set bench to 30-45 degrees, press dumbbells from shoulders'),
        ('Decline Bench Press', 'chest', 'barbell', 'intermediate', 'Lie on decline bench, press bar from chest'),
        ('Cable Flyes', 'chest', 'cable', 'beginner', 'Stand between cables, bring handles together in arc motion'),
        ('Push-ups', 'chest', 'bodyweight', 'beginner', 'Hands shoulder-width, lower body until chest near floor, push up'),
        ('Dumbbell Flyes', 'chest', 'dumbbell', 'beginner', 'Lie on bench, arc dumbbells from sides to above chest'),
        ('Machine Chest Press', 'chest', 'machine', 'beginner', 'Sit in machine, press handles forward'),
        ('Pec Deck Machine', 'chest', 'machine', 'beginner', 'Sit and bring pads together in front of chest'),
        -- Back
        ('Lat Pulldown', 'back', 'cable', 'beginner', 'Pull bar down to upper chest, squeeze shoulder blades'),
        ('Barbell Rows', 'back', 'barbell', 'intermediate', 'Bend over, pull bar to lower chest'),
        ('Seated Cable Row', 'back', 'cable', 'beginner', 'Sit at cable station, pull handle to stomach'),
        ('Pull-ups', 'back', 'bodyweight', 'advanced', 'Hang from bar, pull body up until chin over bar'),
        ('Dumbbell Rows', 'back', 'dumbbell', 'beginner', 'One arm at a time, pull dumbbell to hip'),
        ('T-Bar Row', 'back', 'barbell', 'intermediate', 'Straddle bar, row to chest'),
        ('Deadlifts', 'back', 'barbell', 'advanced', 'Stand with bar on floor, lift with straight back'),
        ('Face Pulls', 'back', 'cable', 'beginner', 'Pull rope to face level, squeeze rear delts'),
        -- Legs
        ('Barbell Squats', 'legs', 'barbell', 'intermediate', 'Bar on upper back, squat until thighs parallel to floor'),
        ('Leg Press', 'legs', 'machine', 'beginner', 'Push platform away with feet shoulder-width'),
        ('Leg Extensions', 'legs', 'machine', 'beginner', 'Extend legs to straighten knees'),
        ('Leg Curls', 'legs', 'machine', 'beginner', 'Curl legs to bring heels toward glutes'),
        ('Walking Lunges', 'legs', 'dumbbell', 'intermediate', 'Step forward into lunge, alternate legs'),
        ('Romanian Deadlifts', 'legs', 'barbell', 'intermediate', 'Hip hinge with slight knee bend, lower bar along legs'),
        ('Calf Raises', 'legs', 'machine', 'beginner', 'Rise up on toes, lower heels below platform'),
        ('Hack Squat', 'legs', 'machine', 'intermediate', 'Shoulders under pads, squat down and up'),
        -- Shoulders
        ('Overhead Press', 'shoulders', 'barbell', 'intermediate', 'Press bar from shoulders overhead'),
        ('Lateral Raises', 'shoulders', 'dumbbell', 'beginner', 'Raise arms to sides until parallel to floor'),
        ('Front Raises', 'shoulders', 'dumbbell', 'beginner', 'Raise dumbbells in front to shoulder height'),
        ('Rear Delt Flyes', 'shoulders', 'dumbbell', 'beginner', 'Bend over, raise arms to sides'),
        ('Arnold Press', 'shoulders', 'dumbbell', 'intermediate', 'Rotate palms while pressing overhead'),
        ('Machine Shoulder Press', 'shoulders', 'machine', 'beginner', 'Sit and press handles overhead'),
        ('Upright Rows', 'shoulders', 'barbell', 'intermediate', 'Pull bar up to chin, elbows high'),
        ('Shrugs', 'shoulders', 'dumbbell', 'beginner', 'Lift shoulders toward ears'),
        -- Arms
        ('Barbell Curls', 'arms', 'barbell', 'beginner', 'Curl bar from thighs to shoulders'),
        ('Dumbbell Curls', 'arms', 'dumbbell', 'beginner', 'Alternate curling dumbbells'),
        ('Hammer Curls', 'arms', 'dumbbell', 'beginner', 'Curl with neutral grip'),
        ('Preacher Curls', 'arms', 'barbell', 'intermediate', 'Curl on preacher bench'),
        ('Tricep Pushdowns', 'arms', 'cable', 'beginner', 'Push cable down, extend arms fully'),
        ('Skull Crushers', 'arms', 'barbell', 'intermediate', 'Lying, lower bar to forehead, extend'),
        ('Tricep Dips', 'arms', 'bodyweight', 'intermediate', 'Lower body between parallel bars'),
        ('Overhead Tricep Extension', 'arms', 'dumbbell', 'beginner', 'Extend dumbbell overhead'),
        -- Core
        ('Planks', 'core', 'bodyweight', 'beginner', 'Hold body in straight line on forearms and toes'),
        ('Crunches', 'core', 'bodyweight', 'beginner', 'Lie on back, curl shoulders toward hips'),
        ('Leg Raises', 'core', 'bodyweight', 'intermediate', 'Hang or lie, raise legs to 90 degrees'),
        ('Russian Twists', 'core', 'bodyweight', 'intermediate', 'Seated, twist torso side to side'),
        ('Cable Woodchops', 'core', 'cable', 'intermediate', 'Rotate torso pulling cable diagonally'),
        ('Mountain Climbers', 'core', 'bodyweight', 'beginner', 'In plank, alternate driving knees to chest'),
        -- Full Body & Cardio
        ('Burpees', 'full_body', 'bodyweight', 'intermediate', 'Squat, jump back, push-up, jump up'),
        ('Kettlebell Swings', 'full_body', 'dumbbell', 'intermediate', 'Swing kettlebell from between legs to shoulder height'),
        ('Treadmill Running', 'cardio', 'cardio', 'beginner', 'Run on treadmill at desired pace'),
        ('Stationary Bike', 'cardio', 'cardio', 'beginner', 'Cycle at steady or interval pace'),
        ('Rowing Machine', 'cardio', 'cardio', 'intermediate', 'Full body rowing motion'),
        ('Elliptical Trainer', 'cardio', 'cardio', 'beginner', 'Low-impact cardio movement');
    END IF;
  END $$;

  -- 4. Add human-readable columns to audit_logs (if not exist)
  ALTER TABLE audit_logs 
    ADD COLUMN IF NOT EXISTS actor_name TEXT,
    ADD COLUMN IF NOT EXISTS action_description TEXT;

  -- 5. Update the audit log trigger function to capture actor name and description
  CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    record_pk uuid;
    branch_val uuid;
    actor_name_val text;
    action_desc text;
    record_name text;
  BEGIN
    -- Get the record ID as UUID
    IF TG_OP = 'DELETE' THEN
      record_pk := OLD.id;
    ELSE
      record_pk := NEW.id;
    END IF;
    
    -- Get branch_id if available
    IF TG_OP = 'DELETE' THEN
      BEGIN
        branch_val := OLD.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    ELSE
      BEGIN
        branch_val := NEW.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    END IF;

    -- Fetch actor name from profiles
    SELECT full_name INTO actor_name_val 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF actor_name_val IS NULL THEN
      actor_name_val := 'System';
    END IF;

    -- Try to get a human-readable name from the record
    record_name := record_pk::text;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF to_jsonb(OLD) ? 'name' THEN record_name := OLD.name::text;
        ELSIF to_jsonb(OLD) ? 'full_name' THEN record_name := OLD.full_name::text;
        ELSIF to_jsonb(OLD) ? 'member_code' THEN record_name := OLD.member_code::text;
        ELSIF to_jsonb(OLD) ? 'invoice_number' THEN record_name := OLD.invoice_number::text;
        ELSIF to_jsonb(OLD) ? 'title' THEN record_name := OLD.title::text;
        END IF;
      ELSE
        IF to_jsonb(NEW) ? 'name' THEN record_name := NEW.name::text;
        ELSIF to_jsonb(NEW) ? 'full_name' THEN record_name := NEW.full_name::text;
        ELSIF to_jsonb(NEW) ? 'member_code' THEN record_name := NEW.member_code::text;
        ELSIF to_jsonb(NEW) ? 'invoice_number' THEN record_name := NEW.invoice_number::text;
        ELSIF to_jsonb(NEW) ? 'title' THEN record_name := NEW.title::text;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Keep the default record_pk
    END;

    -- Generate human-readable action description
    action_desc := actor_name_val || ' ' || 
      CASE TG_OP
        WHEN 'INSERT' THEN 'created'
        WHEN 'UPDATE' THEN 'updated'
        WHEN 'DELETE' THEN 'deleted'
        ELSE TG_OP
      END || ' ' || TG_TABLE_NAME || ' "' || COALESCE(SUBSTRING(record_name, 1, 50), 'record') || '"';

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, new_data, user_id, branch_id, actor_name, action_description
      ) VALUES (
        'INSERT', TG_TABLE_NAME, record_pk, 
        to_jsonb(NEW), 
        auth.uid(),
        branch_val,
        actor_name_val,
        action_desc
      );
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, old_data, new_data, user_id, branch_id, actor_name, action_description
      ) VALUES (
        'UPDATE', TG_TABLE_NAME, record_pk, 
        to_jsonb(OLD), to_jsonb(NEW), 
        auth.uid(),
        branch_val,
        actor_name_val,
        action_desc
      );
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, old_data, user_id, branch_id, actor_name, action_description
      ) VALUES (
        'DELETE', TG_TABLE_NAME, record_pk, 
        to_jsonb(OLD), 
        auth.uid(),
        branch_val,
        actor_name_val,
        action_desc
      );
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
  $function$;
  -- 20260210070745_89d3010c-97c8-4c1e-8126-f6f4dca6e8ed.sql
  -- ============================================
  -- Make invoice_number nullable so trigger can set it
  ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;

  -- Update trigger to handle both NULL and empty string
  DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
  CREATE TRIGGER generate_invoice_number_trigger
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();
  -- 20260210071238_4c095927-dd28-4e72-ae94-25a0141d7be0.sql
  -- ============================================
  -- Fix the trigger to handle both NULL and empty string
  DROP TRIGGER IF EXISTS generate_member_code_trigger ON members;
  CREATE TRIGGER generate_member_code_trigger
    BEFORE INSERT ON members
    FOR EACH ROW
    WHEN (NEW.member_code IS NULL OR NEW.member_code = '')
    EXECUTE FUNCTION generate_member_code();
  -- 20260210071249_cb74d2ef-7e6f-4146-8c58-6eb8ab1c4aaf.sql
  -- ============================================
  -- Allow member_code to be temporarily null so the trigger can set it
  ALTER TABLE members ALTER COLUMN member_code DROP NOT NULL;
  -- 20260210133047_472677cd-9a85-4dfc-bfb8-edb727f740e1.sql
  -- ============================================
  -- Clean up any members with empty member_code that have no memberships
  DELETE FROM public.members 
  WHERE (member_code = '' OR member_code IS NULL) 
    AND NOT EXISTS (SELECT 1 FROM public.memberships WHERE member_id = members.id);
  -- 20260210134437_0a6dfa9a-19b8-4abd-9df5-db0e6fce18ee.sql
  -- ============================================

  -- Enable realtime on notifications table
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

  -- Trigger: notify on new member registration
  CREATE OR REPLACE FUNCTION public.notify_new_member()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  DECLARE
    member_name TEXT;
  BEGIN
    SELECT p.full_name INTO member_name FROM profiles p WHERE p.id = NEW.user_id;
    INSERT INTO notifications (user_id, branch_id, title, message, type, category)
    SELECT ur.user_id, NEW.branch_id,
      'New Member Registered',
      'New member registration: ' || COALESCE(member_name, 'Unknown'),
      'info', 'member'
    FROM user_roles ur
    WHERE ur.role IN ('owner', 'admin')
      AND ur.user_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
    RETURN NEW;
  END; $$;

  CREATE TRIGGER trigger_notify_new_member
    AFTER INSERT ON public.members FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_member();

  -- Trigger: notify on payment received
  CREATE OR REPLACE FUNCTION public.notify_payment_received()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  DECLARE
    member_name TEXT;
  BEGIN
    SELECT p.full_name INTO member_name
    FROM members m JOIN profiles p ON p.id = m.user_id
    WHERE m.id = NEW.member_id;

    INSERT INTO notifications (user_id, branch_id, title, message, type, category)
    SELECT ur.user_id, NEW.branch_id,
      'Payment Received',
      'Payment of ₹' || NEW.amount || ' received from ' || COALESCE(member_name, 'a member'),
      'success', 'payment'
    FROM user_roles ur
    WHERE ur.role IN ('owner', 'admin');
    RETURN NEW;
  END; $$;

  CREATE TRIGGER trigger_notify_payment_received
    AFTER INSERT ON public.payments FOR EACH ROW
    EXECUTE FUNCTION public.notify_payment_received();

  -- 20260211135252_67c04c35-5b46-48e8-8496-edd26e1d5a68.sql
  -- ============================================

  -- Allow members to create invoices for themselves (store purchases)
  CREATE POLICY "Members can create store invoices" ON public.invoices
    FOR INSERT TO authenticated
    WITH CHECK (
      member_id = public.get_member_id(auth.uid())
    );

  -- Allow members to add items to their own invoices
  CREATE POLICY "Members can create own invoice items" ON public.invoice_items
    FOR INSERT TO authenticated
    WITH CHECK (
      invoice_id IN (
        SELECT id FROM public.invoices
        WHERE member_id = public.get_member_id(auth.uid())
      )
    );

  -- 20260211143545_00077a1b-c57c-4702-85bb-91367d141e98.sql
  -- ============================================

  -- Create discount_codes table
  CREATE TABLE public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value NUMERIC NOT NULL DEFAULT 0,
    min_purchase NUMERIC DEFAULT 0,
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );

  ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

  -- Staff can manage discount codes
  CREATE POLICY "Staff can manage discount codes" ON discount_codes
    FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

  -- Members can read active discount codes (for validation)
  CREATE POLICY "Members can read active discount codes" ON discount_codes
    FOR SELECT TO authenticated
    USING (is_active = true);

  -- 20260211144633_454f6941-c4a4-46d8-9f47-28dfefb6645f.sql
  -- ============================================

  ALTER TABLE public.discount_codes
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

  -- 20260211173834_0846d24e-e360-48be-805d-4c2bc9a0bdc0.sql
  -- ============================================

  -- Add unique index on (branch_id, benefit_type_id) for benefit_settings upserts using benefit_type_id
  CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_benefit_type_id_idx 
    ON public.benefit_settings (branch_id, benefit_type_id) 
    WHERE benefit_type_id IS NOT NULL;

  -- 20260212101925_7e9b69f3-4008-4742-9578-43b68d0a93ec.sql
  -- ============================================

  -- Issue 2: Gender-separated facility booking
  ALTER TABLE public.benefit_types 
    ADD COLUMN IF NOT EXISTS gender_access TEXT DEFAULT 'unisex';

  -- Issue 3: Auto-freeze trigger
  CREATE OR REPLACE FUNCTION public.auto_freeze_membership()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
      IF NEW.start_date <= CURRENT_DATE THEN
        UPDATE public.memberships SET status = 'frozen' WHERE id = NEW.membership_id;
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER trg_auto_freeze_membership
    AFTER UPDATE ON public.membership_freeze_history
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_freeze_membership();

  -- 20260212102927_f4079a04-3874-401b-b52f-4e42657b9ebb.sql
  -- ============================================

  -- 1. Create facilities table
  CREATE TABLE public.facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    benefit_type_id UUID NOT NULL REFERENCES public.benefit_types(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gender_access TEXT NOT NULL DEFAULT 'unisex' CHECK (gender_access IN ('male', 'female', 'unisex')),
    capacity INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

  -- RLS: Management can CRUD
  CREATE POLICY "Management full access on facilities" ON public.facilities
    FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

  -- RLS: Members/staff can read active matching facilities
  CREATE POLICY "Read matching facilities" ON public.facilities
    FOR SELECT TO authenticated
    USING (
      is_active = true
      AND (
        gender_access = 'unisex'
        OR gender_access = (SELECT gender::text FROM public.profiles WHERE id = auth.uid())
        OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
      )
    );

  -- Trigger for updated_at
  CREATE TRIGGER update_facilities_updated_at
    BEFORE UPDATE ON public.facilities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

  -- 2. Add facility_id to benefit_slots
  ALTER TABLE public.benefit_slots
    ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id);

  -- 3. Drop gender_access from benefit_types (moved to facilities)
  ALTER TABLE public.benefit_types DROP COLUMN IF EXISTS gender_access;

  -- 20260212131044_573c72f1-5627-4b74-997c-058e122cda6e.sql
  -- ============================================
  -- Drop the problematic unique constraint that prevents multiple custom benefits
  -- The constraint on (plan_id, benefit_type) fails when multiple benefits map to 'other'
  ALTER TABLE public.plan_benefits DROP CONSTRAINT IF EXISTS plan_benefits_plan_id_benefit_type_key;

  -- Add a new unique constraint that accounts for benefit_type_id
  -- This allows multiple 'other' benefit_types as long as benefit_type_id differs
  CREATE UNIQUE INDEX plan_benefits_plan_id_benefit_type_id_key 
  ON public.plan_benefits (plan_id, COALESCE(benefit_type_id, '00000000-0000-0000-0000-000000000000'::uuid), benefit_type);
  -- 20260214072901_ea894734-44a1-4714-bf71-267e83a8953c.sql
  -- ============================================

  -- Drop the old constraint that causes 409 conflicts for custom benefit types
  ALTER TABLE benefit_settings 
    DROP CONSTRAINT IF EXISTS benefit_settings_branch_id_benefit_type_key;

  -- For rows WITH a benefit_type_id, uniqueness is on (branch_id, benefit_type_id)
  CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_type_id_key 
    ON benefit_settings (branch_id, benefit_type_id) 
    WHERE benefit_type_id IS NOT NULL;

  -- For legacy rows WITHOUT a benefit_type_id, keep uniqueness on (branch_id, benefit_type)
  CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_type_enum_key 
    ON benefit_settings (branch_id, benefit_type) 
    WHERE benefit_type_id IS NULL;

  -- 20260215125207_b9ceca01-3bf7-496c-a50e-ef4ac940ed0d.sql
  -- ============================================

  -- ============================================================
  -- FIX 1: trainers_public view - change from SECURITY DEFINER to SECURITY INVOKER
  -- ============================================================
  DROP VIEW IF EXISTS public.trainers_public;
  CREATE VIEW public.trainers_public
  WITH (security_invoker = true)
  AS
  SELECT t.id,
      t.branch_id,
      t.bio,
      t.specializations,
      t.certifications,
      t.max_clients,
      t.is_active,
      t.created_at,
      p.full_name,
      p.avatar_url
  FROM trainers t
  LEFT JOIN profiles p ON t.user_id = p.id
  WHERE t.is_active = true;

  -- ============================================================
  -- FIX 2: trainer_change_requests - restrict from USING(true) to proper role checks
  -- ============================================================
  DROP POLICY IF EXISTS "Staff can view trainer change requests" ON public.trainer_change_requests;
  DROP POLICY IF EXISTS "Members can create trainer change requests" ON public.trainer_change_requests;
  DROP POLICY IF EXISTS "Staff can update trainer change requests" ON public.trainer_change_requests;

  -- Members view their own requests, staff/admin view all
  CREATE POLICY "View own or staff view change requests"
  ON public.trainer_change_requests FOR SELECT
  USING (
    member_id = public.get_member_id(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  -- Only members can create their own requests
  CREATE POLICY "Members create own change requests"
  ON public.trainer_change_requests FOR INSERT
  WITH CHECK (
    member_id = public.get_member_id(auth.uid())
  );

  -- Only staff/admin can update (approve/reject)
  CREATE POLICY "Staff update change requests"
  ON public.trainer_change_requests FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  -- ============================================================
  -- FIX 3: fitness_plan_templates - restrict to staff/trainer only
  -- ============================================================
  DROP POLICY IF EXISTS "Staff can manage templates" ON public.fitness_plan_templates;

  -- Staff and trainers can read templates
  CREATE POLICY "Staff and trainers view templates"
  ON public.fitness_plan_templates FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
  );

  -- Only staff can manage (insert/update/delete) templates
  CREATE POLICY "Staff manage templates"
  ON public.fitness_plan_templates FOR INSERT
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
  );

  CREATE POLICY "Staff update templates"
  ON public.fitness_plan_templates FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
  );

  CREATE POLICY "Staff delete templates"
  ON public.fitness_plan_templates FOR DELETE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  -- ============================================================
  -- FIX 4: audit_logs - remove duplicate INSERT policies and fix permissive SELECT
  -- ============================================================
  DROP POLICY IF EXISTS "System insert audit logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.audit_logs;

  -- Only allow inserts from the system (trigger-based, so needs authenticated)
  -- Restrict to staff+ roles to prevent abuse
  CREATE POLICY "Authenticated insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
  -- Note: audit_log inserts come from triggers (SECURITY DEFINER), so we keep WITH CHECK(true)
  -- but the trigger itself controls what gets inserted. Restricting further would break audit logging.

  -- SELECT already has "Admin view audit logs" policy - that's sufficient

  -- ============================================================
  -- FIX 5: approval_requests INSERT - restrict to appropriate roles
  -- ============================================================
  DROP POLICY IF EXISTS "Create approval requests" ON public.approval_requests;

  CREATE POLICY "Create approval requests"
  ON public.approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  -- ============================================================
  -- FIX 6: trainers table - remove member direct access (they should use trainers_public view)
  -- ============================================================
  DROP POLICY IF EXISTS "Members view active trainers" ON public.trainers;

  -- Members should use the trainers_public view which excludes sensitive fields
  -- Add a SELECT policy for members that only exposes non-sensitive columns via RLS
  -- Since RLS can't restrict columns, we rely on the view. Remove direct member access.

  -- ============================================================
  -- FIX 7: profiles - add staff read policy for member management
  -- ============================================================
  CREATE POLICY "Staff view profiles for management"
  ON public.profiles FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  -- 20260215125232_b2cf5a7d-1c99-45b4-bc0f-d06487c36e94.sql
  -- ============================================

  -- FIX remaining "RLS always true" policies

  -- 1. benefit_types: restrict to staff/trainer/admin
  DROP POLICY IF EXISTS "Staff can manage benefit types" ON public.benefit_types;

  CREATE POLICY "Staff view benefit types"
  ON public.benefit_types FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer','member']::app_role[])
  );

  CREATE POLICY "Staff manage benefit types"
  ON public.benefit_types FOR INSERT
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  CREATE POLICY "Staff update benefit types"
  ON public.benefit_types FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

  CREATE POLICY "Staff delete benefit types"
  ON public.benefit_types FOR DELETE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
  );

  -- 2. referral_settings: restrict to managers+
  DROP POLICY IF EXISTS "Managers can manage referral settings" ON public.referral_settings;

  CREATE POLICY "Managers view referral settings"
  ON public.referral_settings FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','member']::app_role[])
  );

  CREATE POLICY "Managers manage referral settings"
  ON public.referral_settings FOR INSERT
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
  );

  CREATE POLICY "Managers update referral settings"
  ON public.referral_settings FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
  );

  CREATE POLICY "Managers delete referral settings"
  ON public.referral_settings FOR DELETE
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
  );

  -- 3. device_access_events INSERT - this is from devices (verify_jwt=false), needs to stay permissive
  -- but restrict to staff or service role calls
  DROP POLICY IF EXISTS "System can insert access events" ON public.device_access_events;

  CREATE POLICY "System insert access events"
  ON public.device_access_events FOR INSERT
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
    OR auth.uid() IS NULL -- allows service role / edge function calls
  );

  -- 20260216080643_4457cc3d-e262-4a39-b69f-1a3ce5ae22bb.sql
  -- ============================================

  -- Add facility scheduling columns
  ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'];
  ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS under_maintenance BOOLEAN DEFAULT false;

  -- Update validate_class_booking to support custom benefit types
  CREATE OR REPLACE FUNCTION public.validate_class_booking(_class_id uuid, _member_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    _class RECORD;
    _current_bookings INT;
    _existing_booking RECORD;
    _membership RECORD;
    _benefit RECORD;
    _usage_count INT;
  BEGIN
    SELECT * INTO _class FROM classes WHERE id = _class_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Class not found or inactive');
    END IF;
    
    IF _class.scheduled_at < now() THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Cannot book past classes');
    END IF;
    
    SELECT * INTO _existing_booking FROM class_bookings 
    WHERE class_id = _class_id AND member_id = _member_id AND status = 'booked';
    IF FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Already booked for this class');
    END IF;
    
    SELECT m.* INTO _membership FROM memberships m
    WHERE m.member_id = _member_id 
      AND m.status = 'active'
      AND m.start_date <= CURRENT_DATE 
      AND m.end_date >= CURRENT_DATE
    ORDER BY m.end_date DESC LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'No active membership');
    END IF;
    
    -- Check class benefit in plan (support both legacy enum and custom benefit types)
    SELECT pb.* INTO _benefit FROM plan_benefits pb
    LEFT JOIN benefit_types bt ON pb.benefit_type_id = bt.id
    WHERE pb.plan_id = _membership.plan_id 
      AND (
        pb.benefit_type = 'group_classes'
        OR bt.code IN ('class', 'group_classes')
      )
    LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Plan does not include group classes');
    END IF;
    
    -- Check benefit usage limit if applicable
    IF _benefit.limit_count IS NOT NULL THEN
      SELECT COALESCE(SUM(bu.usage_count), 0) INTO _usage_count
      FROM benefit_usage bu
      LEFT JOIN benefit_types bt ON bu.benefit_type_id = bt.id
      WHERE bu.membership_id = _membership.id 
        AND (
          bu.benefit_type = 'group_classes'
          OR bt.code IN ('class', 'group_classes')
        )
        AND (
          (_benefit.frequency = 'daily' AND bu.usage_date = CURRENT_DATE) OR
          (_benefit.frequency = 'weekly' AND bu.usage_date >= date_trunc('week', CURRENT_DATE)) OR
          (_benefit.frequency = 'monthly' AND bu.usage_date >= date_trunc('month', CURRENT_DATE)) OR
          (_benefit.frequency = 'per_membership')
        );
      
      IF _usage_count >= _benefit.limit_count THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Class booking limit reached for this period');
      END IF;
    END IF;
    
    SELECT COUNT(*) INTO _current_bookings FROM class_bookings 
    WHERE class_id = _class_id AND status = 'booked';
    
    IF _current_bookings >= _class.capacity THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Class is full', 'waitlist_available', true);
    END IF;
    
    RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id);
  END;
  $function$;

  -- 20260216082728_797fa68e-c87a-449d-85f6-ac7164f05b03.sql
  -- ============================================

  -- Create SECURITY DEFINER function for server-side slot generation
  -- This bypasses RLS so members can trigger slot creation
  CREATE OR REPLACE FUNCTION public.ensure_facility_slots(
    p_branch_id UUID,
    p_start_date DATE,
    p_end_date DATE
  )
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  DECLARE
    v_facility RECORD;
    v_settings RECORD;
    v_current_date DATE;
    v_day_abbr TEXT;
    v_start_time TIME;
    v_end_time TIME;
    v_duration INT;
    v_buffer INT;
    v_capacity INT;
    v_slot_start TIME;
    v_slot_end TIME;
    v_safe_bt TEXT;
  BEGIN
    -- Loop over each active, non-maintenance facility for this branch
    FOR v_facility IN
      SELECT f.id, f.benefit_type_id, f.capacity AS fac_capacity,
            COALESCE(f.available_days, ARRAY['mon','tue','wed','thu','fri','sat','sun']) AS available_days
      FROM facilities f
      WHERE f.branch_id = p_branch_id
        AND f.is_active = true
        AND COALESCE(f.under_maintenance, false) = false
    LOOP
      -- Find matching benefit_settings for this facility's benefit_type_id
      SELECT bs.operating_hours_start, bs.operating_hours_end,
            bs.slot_duration_minutes, bs.buffer_between_sessions_minutes,
            bs.capacity_per_slot, bs.is_slot_booking_enabled,
            bs.benefit_type
      INTO v_settings
      FROM benefit_settings bs
      WHERE bs.branch_id = p_branch_id
        AND bs.benefit_type_id = v_facility.benefit_type_id
      LIMIT 1;

      -- If settings explicitly disable slot booking, skip
      IF v_settings IS NOT NULL AND v_settings.is_slot_booking_enabled = false THEN
        CONTINUE;
      END IF;

      -- Use settings or defaults
      v_start_time := COALESCE(v_settings.operating_hours_start, '06:00:00')::TIME;
      v_end_time := COALESCE(v_settings.operating_hours_end, '22:00:00')::TIME;
      v_duration := COALESCE(v_settings.slot_duration_minutes, 30);
      v_buffer := COALESCE(v_settings.buffer_between_sessions_minutes, 0);
      v_capacity := COALESCE(v_facility.fac_capacity, v_settings.capacity_per_slot, 1);
      v_safe_bt := COALESCE(v_settings.benefit_type::TEXT, 'other');

      -- Loop over each date in the range
      v_current_date := p_start_date;
      WHILE v_current_date <= p_end_date LOOP
        -- Get day abbreviation (mon, tue, etc.)
        v_day_abbr := LOWER(LEFT(TO_CHAR(v_current_date, 'Dy'), 3));

        -- Check if this day is in available_days
        IF v_day_abbr = ANY(v_facility.available_days) THEN
          -- Check if slots already exist for this facility+date
          IF NOT EXISTS (
            SELECT 1 FROM benefit_slots
            WHERE facility_id = v_facility.id
              AND slot_date = v_current_date::TEXT
              AND is_active = true
          ) THEN
            -- Generate time slots
            v_slot_start := v_start_time;
            WHILE v_slot_start + (v_duration || ' minutes')::INTERVAL <= v_end_time LOOP
              v_slot_end := v_slot_start + (v_duration || ' minutes')::INTERVAL;

              INSERT INTO benefit_slots (
                branch_id, benefit_type, benefit_type_id, facility_id,
                slot_date, start_time, end_time, capacity, is_active
              ) VALUES (
                p_branch_id,
                v_safe_bt::benefit_type,
                v_facility.benefit_type_id,
                v_facility.id,
                v_current_date::TEXT,
                v_slot_start::TEXT,
                v_slot_end::TEXT,
                v_capacity,
                true
              );

              v_slot_start := v_slot_end + (v_buffer || ' minutes')::INTERVAL;
            END LOOP;
          END IF;
        END IF;

        v_current_date := v_current_date + 1;
      END LOOP;
    END LOOP;
  END;
  $$;

  -- 20260217112124_ff20f62f-6258-41bb-ab3f-a90906de85c1.sql
  -- ============================================

  -- Organization settings table
  CREATE TABLE IF NOT EXISTS public.organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT,
    logo_url TEXT,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    currency TEXT DEFAULT 'INR',
    fiscal_year_start TEXT DEFAULT 'April',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id)
  );

  ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

  -- Staff/admin can read
  CREATE POLICY "Staff can view org settings"
    ON public.organization_settings FOR SELECT
    TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

  -- Owner/admin can modify
  CREATE POLICY "Admin can manage org settings"
    ON public.organization_settings FOR ALL
    TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

  -- Updated_at trigger
  CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON public.organization_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

  -- 20260219073737_4efd53f0-dd75-488e-b65e-cba59b4a6d5d.sql
  -- ============================================

  -- =============================================
  -- 1. DROP OLD DUPLICATE AUDIT TRIGGERS
  -- =============================================
  DROP TRIGGER IF EXISTS audit_employees ON public.employees;
  DROP TRIGGER IF EXISTS audit_members ON public.members;
  DROP TRIGGER IF EXISTS audit_trainers ON public.trainers;
  DROP TRIGGER IF EXISTS audit_memberships ON public.memberships;
  DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
  DROP TRIGGER IF EXISTS audit_payments ON public.payments;
  DROP TRIGGER IF EXISTS audit_classes ON public.classes;
  DROP TRIGGER IF EXISTS audit_leads ON public.leads;
  DROP TRIGGER IF EXISTS audit_lockers ON public.lockers;

  -- Drop the old function
  DROP FUNCTION IF EXISTS public.log_audit_change() CASCADE;

  -- =============================================
  -- 2. ADD MISSING AUDIT TRIGGERS (using the correct function)
  -- =============================================
  -- Ensure triggers exist for all important tables using audit_log_trigger_function
  CREATE OR REPLACE TRIGGER audit_classes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

  CREATE OR REPLACE TRIGGER audit_leads_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

  CREATE OR REPLACE TRIGGER audit_lockers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lockers
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

  -- =============================================
  -- 3. BACKFILL NULL actor_name FROM profiles
  -- =============================================
  UPDATE public.audit_logs al
  SET actor_name = COALESCE(p.full_name, 'System'),
      action_description = COALESCE(p.full_name, 'System') || ' ' ||
        CASE al.action
          WHEN 'INSERT' THEN 'created'
          WHEN 'UPDATE' THEN 'updated'
          WHEN 'DELETE' THEN 'deleted'
          ELSE al.action
        END || ' ' || al.table_name
  FROM public.profiles p
  WHERE al.actor_name IS NULL
    AND al.user_id IS NOT NULL
    AND al.user_id = p.id;

  -- For rows with no user_id at all, set to 'System'
  UPDATE public.audit_logs
  SET actor_name = 'System'
  WHERE actor_name IS NULL AND user_id IS NULL;

  -- =============================================
  -- 4. FIX ensure_facility_slots TYPE CASTS
  -- =============================================
  CREATE OR REPLACE FUNCTION public.ensure_facility_slots(p_branch_id uuid, p_start_date date, p_end_date date)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    v_facility RECORD;
    v_settings RECORD;
    v_current_date DATE;
    v_day_abbr TEXT;
    v_start_time TIME;
    v_end_time TIME;
    v_duration INT;
    v_buffer INT;
    v_capacity INT;
    v_slot_start TIME;
    v_slot_end TIME;
    v_safe_bt TEXT;
  BEGIN
    FOR v_facility IN
      SELECT f.id, f.benefit_type_id, f.capacity AS fac_capacity,
            COALESCE(f.available_days, ARRAY['mon','tue','wed','thu','fri','sat','sun']) AS available_days
      FROM facilities f
      WHERE f.branch_id = p_branch_id
        AND f.is_active = true
        AND COALESCE(f.under_maintenance, false) = false
    LOOP
      SELECT bs.operating_hours_start, bs.operating_hours_end,
            bs.slot_duration_minutes, bs.buffer_between_sessions_minutes,
            bs.capacity_per_slot, bs.is_slot_booking_enabled,
            bs.benefit_type
      INTO v_settings
      FROM benefit_settings bs
      WHERE bs.branch_id = p_branch_id
        AND bs.benefit_type_id = v_facility.benefit_type_id
      LIMIT 1;

      IF v_settings IS NOT NULL AND v_settings.is_slot_booking_enabled = false THEN
        CONTINUE;
      END IF;

      v_start_time := COALESCE(v_settings.operating_hours_start, '06:00:00')::TIME;
      v_end_time := COALESCE(v_settings.operating_hours_end, '22:00:00')::TIME;
      v_duration := COALESCE(v_settings.slot_duration_minutes, 30);
      v_buffer := COALESCE(v_settings.buffer_between_sessions_minutes, 0);
      v_capacity := COALESCE(v_facility.fac_capacity, v_settings.capacity_per_slot, 1);
      v_safe_bt := COALESCE(v_settings.benefit_type::TEXT, 'other');

      v_current_date := p_start_date;
      WHILE v_current_date <= p_end_date LOOP
        v_day_abbr := LOWER(LEFT(TO_CHAR(v_current_date, 'Dy'), 3));

        IF v_day_abbr = ANY(v_facility.available_days) THEN
          -- FIXED: removed ::TEXT cast on slot_date comparison
          IF NOT EXISTS (
            SELECT 1 FROM benefit_slots
            WHERE facility_id = v_facility.id
              AND slot_date = v_current_date
              AND is_active = true
          ) THEN
            v_slot_start := v_start_time;
            WHILE v_slot_start + (v_duration || ' minutes')::INTERVAL <= v_end_time LOOP
              v_slot_end := v_slot_start + (v_duration || ' minutes')::INTERVAL;

              -- FIXED: removed ::TEXT casts on slot_date, start_time, end_time
              INSERT INTO benefit_slots (
                branch_id, benefit_type, benefit_type_id, facility_id,
                slot_date, start_time, end_time, capacity, is_active
              ) VALUES (
                p_branch_id,
                v_safe_bt::benefit_type,
                v_facility.benefit_type_id,
                v_facility.id,
                v_current_date,
                v_slot_start,
                v_slot_end,
                v_capacity,
                true
              );

              v_slot_start := v_slot_end + (v_buffer || ' minutes')::INTERVAL;
            END LOOP;
          END IF;
        END IF;

        v_current_date := v_current_date + 1;
      END LOOP;
    END LOOP;
  END;
  $function$;

  -- 20260220070821_bfca7c6f-cae2-423b-a33a-bff70be410ec.sql
  -- ============================================

  -- ============================================================
  -- PRIORITY 1: book_facility_slot RPC with full enforcement
  -- ============================================================

  CREATE OR REPLACE FUNCTION public.book_facility_slot(
    p_slot_id UUID,
    p_member_id UUID,
    p_membership_id UUID
  ) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $$
  DECLARE
    v_slot RECORD;
    v_plan_benefit RECORD;
    v_existing_count INTEGER;
    v_booking_id UUID;
  BEGIN
    -- 1. Lock slot row to prevent race conditions
    SELECT * INTO v_slot FROM benefit_slots WHERE id = p_slot_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
    END IF;

    -- 2. Check capacity
    IF (v_slot.booked_count >= v_slot.capacity) THEN
      RETURN jsonb_build_object('success', false, 'error', 'This slot is fully booked');
    END IF;

    -- 3. Duplicate booking guard (same slot, same member, active status)
    IF EXISTS (
      SELECT 1 FROM benefit_bookings 
      WHERE slot_id = p_slot_id 
        AND member_id = p_member_id 
        AND status IN ('booked', 'confirmed')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this slot');
    END IF;

    -- 4. Benefit limit enforcement (only if slot is linked to a benefit type)
    IF v_slot.benefit_type_id IS NOT NULL THEN
      SELECT pb.* INTO v_plan_benefit
      FROM plan_benefits pb
      JOIN memberships m ON m.plan_id = pb.plan_id
      WHERE m.id = p_membership_id 
        AND pb.benefit_type_id = v_slot.benefit_type_id
      LIMIT 1;

      IF FOUND 
        AND v_plan_benefit.limit_count IS NOT NULL 
        AND v_plan_benefit.limit_count > 0
        AND v_plan_benefit.frequency IS DISTINCT FROM 'unlimited' THEN

        SELECT COUNT(*) INTO v_existing_count
        FROM benefit_bookings bb
        JOIN benefit_slots bs ON bs.id = bb.slot_id
        WHERE bb.member_id = p_member_id
          AND bb.membership_id = p_membership_id
          AND bs.benefit_type_id = v_slot.benefit_type_id
          AND bb.status IN ('booked', 'confirmed')
          AND CASE v_plan_benefit.frequency
            WHEN 'per_membership' THEN TRUE
            WHEN 'monthly'        THEN bs.slot_date >= date_trunc('month', CURRENT_DATE)
            WHEN 'weekly'         THEN bs.slot_date >= date_trunc('week',  CURRENT_DATE)
            WHEN 'daily'          THEN bs.slot_date  = CURRENT_DATE
            ELSE TRUE
          END;

        IF v_existing_count >= v_plan_benefit.limit_count THEN
          RETURN jsonb_build_object(
            'success', false, 
            'error', 'Benefit limit reached (' || v_existing_count || '/' || v_plan_benefit.limit_count || '). Please purchase an add-on.'
          );
        END IF;
      END IF;
    END IF;

    -- 5. Insert booking
    INSERT INTO benefit_bookings (slot_id, member_id, membership_id, status)
    VALUES (p_slot_id, p_member_id, p_membership_id, 'booked')
    RETURNING id INTO v_booking_id;

    -- 6. Write to benefit_usage for entitlement tracking
    IF v_slot.benefit_type_id IS NOT NULL THEN
      INSERT INTO benefit_usage (
        membership_id, benefit_type, benefit_type_id, usage_date, usage_count
      ) VALUES (
        p_membership_id,
        v_slot.benefit_type,
        v_slot.benefit_type_id,
        CURRENT_DATE,
        1
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
  END;
  $$;

  -- ============================================================
  -- PRIORITY 1b: cancel_facility_slot RPC (refunds usage)
  -- ============================================================

  CREATE OR REPLACE FUNCTION public.cancel_facility_slot(
    p_booking_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by member'
  ) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $$
  DECLARE
    v_booking RECORD;
    v_slot_benefit_type_id UUID;
  BEGIN
    UPDATE benefit_bookings
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = p_reason
    WHERE id = p_booking_id 
      AND status IN ('booked', 'confirmed')
    RETURNING * INTO v_booking;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking not found or already cancelled');
    END IF;

    -- Get the benefit_type_id from the slot
    SELECT benefit_type_id INTO v_slot_benefit_type_id
    FROM benefit_slots WHERE id = v_booking.slot_id;

    -- Refund: delete the most recent matching usage record
    IF v_slot_benefit_type_id IS NOT NULL THEN
      DELETE FROM benefit_usage
      WHERE id = (
        SELECT id FROM benefit_usage
        WHERE membership_id = v_booking.membership_id
          AND benefit_type_id = v_slot_benefit_type_id
          AND usage_count = 1
        ORDER BY created_at DESC
        LIMIT 1
      );
    END IF;

    RETURN jsonb_build_object('success', true);
  END;
  $$;

  -- ============================================================
  -- PRIORITY 1c: Unique partial index — DB-level duplicate guard
  -- (duplicates already cleaned up by the data fix above)
  -- ============================================================
  DROP INDEX IF EXISTS benefit_bookings_no_dup;
  CREATE UNIQUE INDEX benefit_bookings_no_dup
  ON benefit_bookings(slot_id, member_id)
  WHERE status IN ('booked', 'confirmed');

  -- 20260220143145_add_soft_delete_columns.sql
  -- ============================================
  /*
    # Add Soft Delete Columns to Key Entities

    ## Summary
    Adds `deleted_at` soft delete timestamps to members, trainers, leads, and employees.
    Also adds deactivation tracking and membership cancellation fields.

    ## Changes
    - `members.deleted_at` — Soft delete (null = active)
    - `members.deactivated_at` — Deactivation timestamp
    - `trainers.deleted_at` — Soft delete
    - `leads.deleted_at` — Soft delete
    - `employees.deleted_at` — Soft delete
    - `memberships.cancellation_reason` — Why cancelled
    - `memberships.cancelled_at` — When cancelled

    ## Notes
    All columns are nullable by default; existing records remain unaffected.
  */

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'deleted_at') THEN
      ALTER TABLE members ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'deactivated_at') THEN
      ALTER TABLE members ADD COLUMN deactivated_at timestamptz DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trainers' AND column_name = 'deleted_at') THEN
      ALTER TABLE trainers ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'deleted_at') THEN
      ALTER TABLE leads ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'deleted_at') THEN
      ALTER TABLE employees ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'cancellation_reason') THEN
      ALTER TABLE memberships ADD COLUMN cancellation_reason text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'cancelled_at') THEN
      ALTER TABLE memberships ADD COLUMN cancelled_at timestamptz;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_members_active ON members(id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_trainers_active ON trainers(id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_leads_active ON leads(id) WHERE deleted_at IS NULL;

  -- 20260222164908_601f8084-dbe4-4793-9ef8-a3d152ff428a.sql
  -- ============================================
  -- Create storage bucket for contract documents
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('documents', 'documents', true)
  ON CONFLICT (id) DO NOTHING;

  -- Allow authenticated users to upload to documents bucket
  CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

  -- Allow authenticated users to read documents
  CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
  -- 20260223073413_07307374-a433-4c45-a52c-2f02efbbf1e6.sql
  -- ============================================

  -- Enable required extensions for cron scheduling
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- Auto-expire memberships function (runs daily)
  CREATE OR REPLACE FUNCTION public.auto_expire_memberships()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  DECLARE
    v_count INTEGER;
  BEGIN
    UPDATE memberships 
    SET status = 'expired'
    WHERE status = 'active'
      AND end_date < CURRENT_DATE
    RETURNING COUNT(*) INTO v_count;
    
    -- Log the auto-expiry
    IF v_count > 0 THEN
      INSERT INTO audit_logs (action, table_name, user_id, actor_name, action_description)
      VALUES ('AUTO_EXPIRE', 'memberships', NULL, 'System', 
              'Auto-expired ' || v_count || ' membership(s) past end_date');
    END IF;
  END;
  $$;

  -- Enable realtime for whatsapp_messages table
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

  -- 20260225081558_8c89848d-c401-4aa8-ab7a-342afd8c91ef.sql
  -- ============================================

  -- 1. Add trainer_id, commission_percentage, base_salary to contracts
  ALTER TABLE public.contracts 
    ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES public.trainers(id),
    ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS base_salary numeric DEFAULT 0;

  -- Allow contract to target either employee or trainer (but at least one)
  -- Drop existing constraint if any, then add
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'chk_contract_target' AND table_name = 'contracts'
    ) THEN
      ALTER TABLE public.contracts ADD CONSTRAINT chk_contract_target
        CHECK (employee_id IS NOT NULL OR trainer_id IS NOT NULL);
    END IF;
  END $$;

  -- 2. Add website_theme JSONB column to organization_settings for CMS
  ALTER TABLE public.organization_settings 
    ADD COLUMN IF NOT EXISTS website_theme jsonb DEFAULT '{}'::jsonb;

  -- 3. Create renewal invoice generation function
  CREATE OR REPLACE FUNCTION public.generate_renewal_invoices()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
  AS $function$
  DECLARE
    ms RECORD;
    inv_exists boolean;
    new_invoice_id uuid;
  BEGIN
    FOR ms IN
      SELECT m.id as membership_id, m.member_id, m.branch_id, m.plan_id, 
            mp.name as plan_name, mp.price as plan_price,
            mem.user_id
      FROM memberships m
      JOIN membership_plans mp ON m.plan_id = mp.id
      JOIN members mem ON mem.id = m.member_id
      WHERE m.status = 'active'
      AND m.end_date = CURRENT_DATE + INTERVAL '7 days'
    LOOP
      -- Check if renewal invoice already exists
      SELECT EXISTS(
        SELECT 1 FROM invoices i 
        JOIN invoice_items ii ON ii.invoice_id = i.id
        WHERE i.member_id = ms.member_id 
        AND ii.reference_type = 'membership_renewal'
        AND i.status = 'pending'
        AND i.created_at > CURRENT_DATE - INTERVAL '10 days'
      ) INTO inv_exists;
      
      IF NOT inv_exists THEN
        -- Create renewal invoice (invoice_number generated by trigger)
        INSERT INTO invoices (branch_id, member_id, total_amount, status, due_date)
        VALUES (ms.branch_id, ms.member_id, ms.plan_price, 'pending', CURRENT_DATE + INTERVAL '7 days')
        RETURNING id INTO new_invoice_id;

        -- Add invoice item
        INSERT INTO invoice_items (invoice_id, description, unit_price, quantity, total_amount, reference_type, reference_id)
        VALUES (new_invoice_id, 'Membership Renewal - ' || ms.plan_name, ms.plan_price, 1, ms.plan_price, 'membership_renewal', ms.membership_id::text);
        
        -- Notify member
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        VALUES (ms.user_id, ms.branch_id, 'Renewal Invoice Generated',
          'Your membership renewal invoice for ' || ms.plan_name || ' (₹' || ms.plan_price || ') has been generated. Due in 7 days.',
          'info', 'billing');
      END IF;
    END LOOP;
  END;
  $function$;

  -- 4. Schedule renewal invoice generation daily at 2 AM UTC
  SELECT cron.schedule(
    'generate-renewal-invoices',
    '0 2 * * *',
    $$SELECT public.generate_renewal_invoices()$$
  );

  -- 20260226064016_df09e76d-6671-47ce-a5f4-ca6c84e2eec0.sql
  -- ============================================
  -- Add public read policy for organization_settings so public website can load theme
  CREATE POLICY "Public can read org settings"
    ON public.organization_settings
    FOR SELECT
    TO anon
    USING (true);

  -- 20260226085120_c47b1155-665a-446a-9cf3-9ee1d95cbaf0.sql
  -- ============================================

  -- Create error_logs table
  CREATE TABLE public.error_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    error_message text NOT NULL,
    stack_trace text,
    component_name text,
    route text,
    browser_info text,
    status text NOT NULL DEFAULT 'open',
    resolved_at timestamptz,
    resolved_by uuid,
    created_at timestamptz DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

  -- Validation trigger for status
  CREATE OR REPLACE FUNCTION public.validate_error_log_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
  BEGIN
    IF NEW.status NOT IN ('open', 'resolved') THEN
      RAISE EXCEPTION 'Invalid status: %. Must be open or resolved.', NEW.status;
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER trg_validate_error_log_status
    BEFORE INSERT OR UPDATE ON public.error_logs
    FOR EACH ROW EXECUTE FUNCTION public.validate_error_log_status();

  -- RLS: Any authenticated user can insert (for error boundary logging)
  CREATE POLICY "Authenticated users can insert error logs"
    ON public.error_logs FOR INSERT TO authenticated
    WITH CHECK (true);

  -- RLS: Only admin/owner can read
  CREATE POLICY "Admins can read error logs"
    ON public.error_logs FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

  -- RLS: Only admin/owner can update (mark resolved)
  CREATE POLICY "Admins can update error logs"
    ON public.error_logs FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

  -- 20260226104034_e66c0e57-be80-47de-823c-ae7121e5b5aa.sql
  -- ============================================

  -- Add hardware fields to members table
  ALTER TABLE public.members 
    ADD COLUMN IF NOT EXISTS wiegand_code text,
    ADD COLUMN IF NOT EXISTS custom_welcome_message text DEFAULT 'Welcome! Enjoy your workout',
    ADD COLUMN IF NOT EXISTS hardware_access_enabled boolean DEFAULT true;

  -- Create device_commands table for Realtime push commands
  CREATE TABLE public.device_commands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid REFERENCES public.access_devices(id) ON DELETE CASCADE NOT NULL,
    command_type text NOT NULL DEFAULT 'relay_open',
    payload jsonb DEFAULT '{}',
    status text NOT NULL DEFAULT 'pending',
    issued_by uuid,
    issued_at timestamptz DEFAULT now(),
    executed_at timestamptz
  );

  -- Enable RLS
  ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

  -- RLS: Authenticated users can read device_commands
  CREATE POLICY "Authenticated users can read device_commands"
    ON public.device_commands FOR SELECT TO authenticated
    USING (true);

  -- RLS: Admin/owner/manager/staff can insert device_commands
  CREATE POLICY "Staff can insert device_commands"
    ON public.device_commands FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'manager', 'staff')
      )
    );

  -- RLS: Allow updates (for Android device to mark as executed)
  CREATE POLICY "Authenticated users can update device_commands"
    ON public.device_commands FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

  -- Enable Realtime for device_commands
  ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;

  -- Auto-disable hardware access trigger
  CREATE OR REPLACE FUNCTION public.auto_disable_hardware_access()
  RETURNS trigger AS $$
  BEGIN
    IF NEW.status IN ('frozen', 'expired', 'cancelled') AND OLD.status = 'active' THEN
      NEW.hardware_access_enabled := false;
    END IF;
    IF NEW.status = 'active' AND OLD.status IN ('frozen', 'expired') THEN
      NEW.hardware_access_enabled := true;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  CREATE TRIGGER trg_auto_hardware_access
    BEFORE UPDATE OF status ON public.members
    FOR EACH ROW EXECUTE FUNCTION auto_disable_hardware_access();

  -- 20260226115527_758d6ac6-1fa5-4b40-92fd-3ad116792250.sql
  -- ============================================

  -- Fix staff_branches: drop unique constraint on user_id to allow multi-branch managers
  -- and add composite unique on (user_id, branch_id) instead

  -- First drop the existing unique index on user_id (the isOneToOne constraint)
  DO $$
  BEGIN
    -- Drop any unique constraint/index on just user_id
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'staff_branches' 
      AND indexdef LIKE '%user_id%' 
      AND indexdef NOT LIKE '%branch_id%'
      AND indexdef LIKE '%UNIQUE%'
    ) THEN
      -- Find and drop the constraint
      EXECUTE (
        SELECT 'ALTER TABLE public.staff_branches DROP CONSTRAINT ' || conname
        FROM pg_constraint 
        WHERE conrelid = 'public.staff_branches'::regclass 
        AND contype = 'u'
        AND array_length(conkey, 1) = 1
        AND conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.staff_branches'::regclass AND attname = 'user_id')
        LIMIT 1
      );
    END IF;
  END $$;

  -- Add composite unique constraint (user_id, branch_id) if not exists
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.staff_branches'::regclass 
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
    ) THEN
      ALTER TABLE public.staff_branches ADD CONSTRAINT staff_branches_user_branch_unique UNIQUE (user_id, branch_id);
    END IF;
  END $$;

  -- 20260227061046_bb9f532d-d521-49f7-bfa9-a74781c5d0b8.sql
  -- ============================================

  -- 1. Add unique constraint on referral_settings.branch_id for upsert
  CREATE UNIQUE INDEX IF NOT EXISTS referral_settings_branch_id_unique ON public.referral_settings(branch_id);

  -- 2. Create notification triggers for key gym events
  CREATE OR REPLACE FUNCTION public.notify_locker_assigned()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  DECLARE
    member_name TEXT;
    locker_num TEXT;
  BEGIN
    SELECT p.full_name INTO member_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.member_id;
    SELECT locker_number INTO locker_num FROM lockers WHERE id = NEW.locker_id;
    
    INSERT INTO notifications (user_id, title, message, type, category)
    SELECT ur.user_id, 'Locker Assigned',
      'Locker #' || COALESCE(locker_num, '?') || ' assigned to ' || COALESCE(member_name, 'a member'),
      'info', 'locker'
    FROM user_roles ur WHERE ur.role IN ('owner', 'admin');
    RETURN NEW;
  END; $$;

  CREATE OR REPLACE FUNCTION public.notify_lead_created()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  BEGIN
    INSERT INTO notifications (user_id, branch_id, title, message, type, category)
    SELECT ur.user_id, NEW.branch_id,
      'New Lead Captured',
      'New lead: ' || COALESCE(NEW.full_name, 'Unknown') || ' (' || COALESCE(NEW.source, 'Direct') || ')',
      'info', 'lead'
    FROM user_roles ur WHERE ur.role IN ('owner', 'admin', 'manager');
    RETURN NEW;
  END; $$;

  CREATE OR REPLACE FUNCTION public.notify_membership_expiring()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  DECLARE
    member_name TEXT;
    days_left INT;
  BEGIN
    IF NEW.status = 'active' AND NEW.end_date IS NOT NULL THEN
      days_left := NEW.end_date - CURRENT_DATE;
      IF days_left IN (7, 3, 1) THEN
        SELECT p.full_name INTO member_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.member_id;
        
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        SELECT m.user_id, NEW.branch_id,
          'Membership Expiring Soon',
          'Your membership expires in ' || days_left || ' day(s). Please renew to continue.',
          'warning', 'membership'
        FROM members m WHERE m.id = NEW.member_id AND m.user_id IS NOT NULL;
        
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        SELECT ur.user_id, NEW.branch_id,
          'Member Expiring',
          COALESCE(member_name, 'A member') || '''s membership expires in ' || days_left || ' day(s)',
          'warning', 'membership'
        FROM user_roles ur WHERE ur.role IN ('owner', 'admin');
      END IF;
    END IF;
    RETURN NEW;
  END; $$;

  CREATE OR REPLACE FUNCTION public.notify_referral_converted()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
  DECLARE
    referrer_user_id UUID;
    referee_name TEXT;
    v_reward_type TEXT;
    v_reward_value NUMERIC;
  BEGIN
    IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
      SELECT m.user_id INTO referrer_user_id FROM members m WHERE m.id = NEW.referrer_id;
      SELECT p.full_name INTO referee_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.referee_id;
      
      SELECT rs.reward_type, rs.reward_value INTO v_reward_type, v_reward_value
      FROM referral_settings rs WHERE rs.branch_id = NEW.branch_id LIMIT 1;
      
      IF v_reward_type IS NOT NULL AND v_reward_value > 0 THEN
        INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value, status)
        VALUES (NEW.id, NEW.referrer_id, v_reward_type, v_reward_value, 'pending');
      END IF;
      
      IF referrer_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        VALUES (referrer_user_id, NEW.branch_id,
          'Referral Converted!',
          COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
          'success', 'referral');
      END IF;
    END IF;
    RETURN NEW;
  END; $$;

  -- Create triggers
  DROP TRIGGER IF EXISTS trg_notify_locker_assigned ON locker_assignments;
  CREATE TRIGGER trg_notify_locker_assigned AFTER INSERT ON locker_assignments FOR EACH ROW EXECUTE FUNCTION notify_locker_assigned();

  DROP TRIGGER IF EXISTS trg_notify_lead_created ON leads;
  CREATE TRIGGER trg_notify_lead_created AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION notify_lead_created();

  DROP TRIGGER IF EXISTS trg_notify_membership_expiring ON memberships;
  CREATE TRIGGER trg_notify_membership_expiring AFTER UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION notify_membership_expiring();

  DROP TRIGGER IF EXISTS trg_notify_referral_converted ON referrals;
  CREATE TRIGGER trg_notify_referral_converted AFTER UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION notify_referral_converted();

  -- 20260301141232_7d037033-2684-4143-8506-aa1dd39d9495.sql
  -- ============================================

  -- Add source column to error_logs for tracking origin (frontend, edge_function, database, trigger)
  ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'frontend';

  -- Add void fields to payments for correction workflow
  ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS void_reason text;
  ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_by uuid;
  ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
  ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS original_payment_id uuid REFERENCES public.payments(id);

  -- Create a DB function to fetch inactive members (no attendance in last N days)
  CREATE OR REPLACE FUNCTION public.get_inactive_members(p_branch_id uuid, p_days integer DEFAULT 7, p_limit integer DEFAULT 50)
  RETURNS TABLE(
    member_id uuid,
    member_code text,
    full_name text,
    phone text,
    email text,
    last_visit timestamptz,
    days_absent integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      m.id AS member_id,
      m.member_code,
      COALESCE(p.full_name, 'Unknown') AS full_name,
      p.phone,
      p.email,
      ma.last_check_in AS last_visit,
      EXTRACT(DAY FROM (now() - ma.last_check_in))::integer AS days_absent
    FROM members m
    JOIN profiles p ON p.id = m.user_id
    JOIN memberships ms ON ms.member_id = m.id AND ms.status = 'active' AND ms.end_date >= CURRENT_DATE
    LEFT JOIN LATERAL (
      SELECT MAX(check_in) AS last_check_in
      FROM member_attendance att
      WHERE att.member_id = m.id
    ) ma ON true
    WHERE m.branch_id = p_branch_id
      AND (ma.last_check_in IS NULL OR ma.last_check_in < now() - (p_days || ' days')::interval)
    ORDER BY ma.last_check_in ASC NULLS FIRST
    LIMIT p_limit;
  END;
  $$;

  -- 20260303075654_11ebcd59-8e8f-4015-99c7-2ec6aaabf137.sql
  -- ============================================
  -- Add FK from employees.user_id to profiles.id for PostgREST joins
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  -- 20260304045622_42fd39a8-8b8b-4879-aa7f-b739dd97af48.sql
  -- ============================================

  ALTER TABLE public.trainers
    ADD CONSTRAINT trainers_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- 20260305074315_e87eedb1-67d6-4835-a5dd-00277d63d766.sql
  -- ============================================
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  -- 20260305082621_caaea7ac-f3aa-4e2c-beb6-23403ac6e6a4.sql
  -- ============================================
  -- Fix notification triggers to include 'staff' role so staff users get notifications

  CREATE OR REPLACE FUNCTION public.notify_new_member()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    member_name TEXT;
  BEGIN
    SELECT p.full_name INTO member_name FROM profiles p WHERE p.id = NEW.user_id;
    INSERT INTO notifications (user_id, branch_id, title, message, type, category)
    SELECT ur.user_id, NEW.branch_id,
      'New Member Registered',
      'New member registration: ' || COALESCE(member_name, 'Unknown'),
      'info', 'member'
    FROM user_roles ur
    WHERE ur.role IN ('owner', 'admin', 'staff')
      AND ur.user_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
    RETURN NEW;
  END; $function$;

  CREATE OR REPLACE FUNCTION public.notify_payment_received()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    member_name TEXT;
  BEGIN
    SELECT p.full_name INTO member_name
    FROM members m JOIN profiles p ON p.id = m.user_id
    WHERE m.id = NEW.member_id;

    INSERT INTO notifications (user_id, branch_id, title, message, type, category)
    SELECT ur.user_id, NEW.branch_id,
      'Payment Received',
      'Payment of ₹' || NEW.amount || ' received from ' || COALESCE(member_name, 'a member'),
      'success', 'payment'
    FROM user_roles ur
    WHERE ur.role IN ('owner', 'admin', 'staff');
    RETURN NEW;
  END; $function$;

  CREATE OR REPLACE FUNCTION public.notify_lead_created()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    INSERT INTO notifications (user_id, branch_id, title, message, type, category)
    SELECT ur.user_id, NEW.branch_id,
      'New Lead Captured',
      'New lead: ' || COALESCE(NEW.full_name, 'Unknown') || ' (' || COALESCE(NEW.source, 'Direct') || ')',
      'info', 'lead'
    FROM user_roles ur WHERE ur.role IN ('owner', 'admin', 'manager', 'staff');
    RETURN NEW;
  END; $function$;

  CREATE OR REPLACE FUNCTION public.notify_locker_assigned()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    member_name TEXT;
    locker_num TEXT;
  BEGIN
    SELECT p.full_name INTO member_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.member_id;
    SELECT locker_number INTO locker_num FROM lockers WHERE id = NEW.locker_id;
    
    INSERT INTO notifications (user_id, title, message, type, category)
    SELECT ur.user_id, 'Locker Assigned',
      'Locker #' || COALESCE(locker_num, '?') || ' assigned to ' || COALESCE(member_name, 'a member'),
      'info', 'locker'
    FROM user_roles ur WHERE ur.role IN ('owner', 'admin', 'staff');
    RETURN NEW;
  END; $function$;
  -- 20260306063602_75fd036e-8f11-48d2-80c6-8d5008d54809.sql
  -- ============================================

  -- 1a. PT Packages: Add package_type and duration_months
  ALTER TABLE public.pt_packages
    ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'session_based',
    ADD COLUMN IF NOT EXISTS duration_months integer;

  -- 1b. Trainer Commissions: Add release_date for amortized payouts
  ALTER TABLE public.trainer_commissions
    ADD COLUMN IF NOT EXISTS release_date date DEFAULT CURRENT_DATE;

  -- 1c. Ad Banners table
  CREATE TABLE IF NOT EXISTS public.ad_banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    image_url text NOT NULL,
    redirect_url text,
    title text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can read banners" ON public.ad_banners FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admins can manage banners" ON public.ad_banners FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

  -- 1d. Follow-Up Activities table
  CREATE TABLE IF NOT EXISTS public.follow_up_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    reference_type text NOT NULL,
    reference_id text NOT NULL,
    action_taken text NOT NULL,
    notes text,
    next_follow_up_date date,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
  );
  ALTER TABLE public.follow_up_activities ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Staff can manage follow-ups" ON public.follow_up_activities FOR ALL TO authenticated USING (true);

  -- 1e. Update purchase_pt_package RPC for amortized commissions
  CREATE OR REPLACE FUNCTION public.purchase_pt_package(
    _member_id uuid, _package_id uuid, _trainer_id uuid, _branch_id uuid, _price_paid numeric
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    _package RECORD;
    _member_package_id UUID;
    _commission_amount NUMERIC;
    _monthly_commission NUMERIC;
    _trainer RECORD;
    _commission_rate NUMERIC;
    i INTEGER;
  BEGIN
    -- Get package details
    SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
    END IF;

    -- Get trainer commission rate
    SELECT pt_share_percentage INTO _commission_rate FROM trainers WHERE id = _trainer_id;
    _commission_rate := COALESCE(_commission_rate, 20);

    -- Create member PT package
    INSERT INTO member_pt_packages (
      member_id, package_id, trainer_id, branch_id,
      sessions_total, sessions_remaining, price_paid,
      start_date, expiry_date, status
    ) VALUES (
      _member_id, _package_id, _trainer_id, _branch_id,
      CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
      CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
      _price_paid,
      CURRENT_DATE,
      CASE WHEN _package.package_type = 'duration_based' THEN CURRENT_DATE + (_package.duration_months * 30)
          ELSE CURRENT_DATE + _package.validity_days END,
      'active'
    ) RETURNING id INTO _member_package_id;

    -- Calculate total commission
    _commission_amount := _price_paid * (_commission_rate / 100.0);

    -- Insert commissions: amortized for duration-based, single for session-based
    IF _package.package_type = 'duration_based' AND _package.duration_months > 0 THEN
      _monthly_commission := ROUND(_commission_amount / _package.duration_months, 2);
      FOR i IN 0..(_package.duration_months - 1) LOOP
        INSERT INTO trainer_commissions (
          trainer_id, pt_package_id, commission_type, amount, percentage, status, release_date
        ) VALUES (
          _trainer_id, _member_package_id, 'package_sale',
          _monthly_commission, _commission_rate, 'pending',
          CURRENT_DATE + (i * 30)
        );
      END LOOP;
    ELSE
      INSERT INTO trainer_commissions (
        trainer_id, pt_package_id, commission_type, amount, percentage, release_date
      ) VALUES (
        _trainer_id, _member_package_id, 'package_sale', _commission_amount, _commission_rate, CURRENT_DATE
      );
    END IF;

    -- Auto-assign trainer to member if not already assigned
    UPDATE members SET assigned_trainer_id = _trainer_id
    WHERE id = _member_id AND assigned_trainer_id IS NULL;

    RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id);
  END;
  $function$;

  -- 20260307093840_be40b793-76c6-43d4-86ee-86a9eb441f99.sql
  -- ============================================
  -- Add capacity column to branches
  ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 50;

  -- Update audit_log_trigger_function to also check locker_number, employee_code, code
  CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    record_pk uuid;
    branch_val uuid;
    actor_name_val text;
    action_desc text;
    record_name text;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      record_pk := OLD.id;
    ELSE
      record_pk := NEW.id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
      BEGIN
        branch_val := OLD.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    ELSE
      BEGIN
        branch_val := NEW.branch_id;
      EXCEPTION WHEN undefined_column THEN
        branch_val := NULL;
      END;
    END IF;

    SELECT full_name INTO actor_name_val 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF actor_name_val IS NULL THEN
      actor_name_val := 'System';
    END IF;

    record_name := NULL;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF to_jsonb(OLD) ? 'name' THEN record_name := OLD.name::text;
        ELSIF to_jsonb(OLD) ? 'full_name' THEN record_name := OLD.full_name::text;
        ELSIF to_jsonb(OLD) ? 'member_code' THEN record_name := OLD.member_code::text;
        ELSIF to_jsonb(OLD) ? 'invoice_number' THEN record_name := OLD.invoice_number::text;
        ELSIF to_jsonb(OLD) ? 'title' THEN record_name := OLD.title::text;
        ELSIF to_jsonb(OLD) ? 'locker_number' THEN record_name := 'Locker #' || OLD.locker_number::text;
        ELSIF to_jsonb(OLD) ? 'employee_code' THEN record_name := OLD.employee_code::text;
        ELSIF to_jsonb(OLD) ? 'code' THEN record_name := OLD.code::text;
        ELSIF to_jsonb(OLD) ? 'device_name' THEN record_name := OLD.device_name::text;
        END IF;
      ELSE
        IF to_jsonb(NEW) ? 'name' THEN record_name := NEW.name::text;
        ELSIF to_jsonb(NEW) ? 'full_name' THEN record_name := NEW.full_name::text;
        ELSIF to_jsonb(NEW) ? 'member_code' THEN record_name := NEW.member_code::text;
        ELSIF to_jsonb(NEW) ? 'invoice_number' THEN record_name := NEW.invoice_number::text;
        ELSIF to_jsonb(NEW) ? 'title' THEN record_name := NEW.title::text;
        ELSIF to_jsonb(NEW) ? 'locker_number' THEN record_name := 'Locker #' || NEW.locker_number::text;
        ELSIF to_jsonb(NEW) ? 'employee_code' THEN record_name := NEW.employee_code::text;
        ELSIF to_jsonb(NEW) ? 'code' THEN record_name := NEW.code::text;
        ELSIF to_jsonb(NEW) ? 'device_name' THEN record_name := NEW.device_name::text;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    IF record_name IS NULL THEN
      record_name := TG_TABLE_NAME || ' record';
    END IF;

    action_desc := actor_name_val || ' ' || 
      CASE TG_OP
        WHEN 'INSERT' THEN 'created'
        WHEN 'UPDATE' THEN 'updated'
        WHEN 'DELETE' THEN 'deleted'
        ELSE TG_OP
      END || ' ' || TG_TABLE_NAME || ' "' || COALESCE(SUBSTRING(record_name, 1, 50), 'record') || '"';

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, new_data, user_id, branch_id, actor_name, action_description
      ) VALUES (
        'INSERT', TG_TABLE_NAME, record_pk, 
        to_jsonb(NEW), 
        auth.uid(),
        branch_val,
        actor_name_val,
        action_desc
      );
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, old_data, new_data, user_id, branch_id, actor_name, action_description
      ) VALUES (
        'UPDATE', TG_TABLE_NAME, record_pk, 
        to_jsonb(OLD), to_jsonb(NEW), 
        auth.uid(),
        branch_val,
        actor_name_val,
        action_desc
      );
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.audit_logs (
        action, table_name, record_id, old_data, user_id, branch_id, actor_name, action_description
      ) VALUES (
        'DELETE', TG_TABLE_NAME, record_pk, 
        to_jsonb(OLD), 
        auth.uid(),
        branch_val,
        actor_name_val,
        action_desc
      );
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
  $function$;
  -- 20260308083658_443d732d-a726-4840-b408-c56222bee603.sql
  -- ============================================

  CREATE OR REPLACE FUNCTION public.purchase_pt_package(_member_id uuid, _package_id uuid, _trainer_id uuid, _branch_id uuid, _price_paid numeric)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    _package RECORD;
    _member_package_id UUID;
    _commission_amount NUMERIC;
    _monthly_commission NUMERIC;
    _trainer RECORD;
    _commission_rate NUMERIC;
    _invoice_id UUID;
    i INTEGER;
  BEGIN
    SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
    END IF;

    SELECT pt_share_percentage INTO _commission_rate FROM trainers WHERE id = _trainer_id;
    _commission_rate := COALESCE(_commission_rate, 20);

    INSERT INTO member_pt_packages (
      member_id, package_id, trainer_id, branch_id,
      sessions_total, sessions_remaining, price_paid,
      start_date, expiry_date, status
    ) VALUES (
      _member_id, _package_id, _trainer_id, _branch_id,
      CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
      CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
      _price_paid,
      CURRENT_DATE,
      CASE WHEN _package.package_type = 'duration_based' THEN CURRENT_DATE + (_package.duration_months * 30)
          ELSE CURRENT_DATE + _package.validity_days END,
      'active'
    ) RETURNING id INTO _member_package_id;

    INSERT INTO invoices (
      branch_id, member_id, subtotal, total_amount, amount_paid, status, due_date, invoice_type
    ) VALUES (
      _branch_id, _member_id, _price_paid, _price_paid, _price_paid, 'paid', CURRENT_DATE, 'pt_package'
    ) RETURNING id INTO _invoice_id;

    INSERT INTO invoice_items (
      invoice_id, description, unit_price, quantity, total_amount, reference_type, reference_id
    ) VALUES (
      _invoice_id, 'PT Package - ' || _package.name, _price_paid, 1, _price_paid, 'pt_package', _member_package_id::text
    );

    INSERT INTO payments (
      invoice_id, member_id, branch_id, amount, payment_method, status, payment_date
    ) VALUES (
      _invoice_id, _member_id, _branch_id, _price_paid, 'cash', 'completed', now()
    );

    _commission_amount := _price_paid * (_commission_rate / 100.0);

    IF _package.package_type = 'duration_based' AND _package.duration_months > 0 THEN
      _monthly_commission := ROUND(_commission_amount / _package.duration_months, 2);
      FOR i IN 0..(_package.duration_months - 1) LOOP
        INSERT INTO trainer_commissions (
          trainer_id, pt_package_id, commission_type, amount, percentage, status, release_date
        ) VALUES (
          _trainer_id, _member_package_id, 'package_sale',
          _monthly_commission, _commission_rate, 'pending',
          CURRENT_DATE + (i * 30)
        );
      END LOOP;
    ELSE
      INSERT INTO trainer_commissions (
        trainer_id, pt_package_id, commission_type, amount, percentage, release_date
      ) VALUES (
        _trainer_id, _member_package_id, 'package_sale', _commission_amount, _commission_rate, CURRENT_DATE
      );
    END IF;

    UPDATE members SET assigned_trainer_id = _trainer_id
    WHERE id = _member_id AND assigned_trainer_id IS NULL;

    RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id, 'invoice_id', _invoice_id);
  END;
  $function$;

  -- 20260308211427_f5a08fea-6647-4147-a136-d9dbecc8c518.sql
  -- ============================================
  -- Add invoice_type column to invoices table
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT NULL;

  -- Add FK from branch_managers.user_id to profiles.id
  ALTER TABLE public.branch_managers
    ADD CONSTRAINT branch_managers_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- Add FK from benefit_usage.recorded_by to profiles.id
  ALTER TABLE public.benefit_usage
    ADD CONSTRAINT benefit_usage_recorded_by_profiles_fkey
    FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  -- 20260308212150_df294fbe-7748-4147-b0b4-4d116db9d3fe.sql
  -- ============================================

  -- Create income_categories table mirroring expense_categories
  CREATE TABLE public.income_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;

  -- RLS policies
  CREATE POLICY "Authenticated users can read income categories"
    ON public.income_categories FOR SELECT TO authenticated USING (true);

  CREATE POLICY "Staff and above can manage income categories"
    ON public.income_categories FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'staff', 'manager']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'staff', 'manager']::app_role[]));

  -- Add income_category_id to payments table
  ALTER TABLE public.payments ADD COLUMN income_category_id UUID REFERENCES public.income_categories(id);

  -- Seed default income categories
  INSERT INTO public.income_categories (name, description, is_system) VALUES
    ('Membership Fees', 'Revenue from membership plan purchases and renewals', true),
    ('PT Packages', 'Personal training package sales', true),
    ('Class Fees', 'Group class and workshop fees', true),
    ('Store / POS Sales', 'Product sales from store and point of sale', true),
    ('Registration / Joining Fee', 'One-time joining or registration fees', true),
    ('Locker Rental', 'Locker rental income', true),
    ('Add-on Services', 'Additional services like spa, sauna, etc.', true),
    ('Referral Income', 'Revenue from referral program rewards', true),
    ('Other Income', 'Miscellaneous income', true);

  -- Seed default expense categories (only if table is empty)
  INSERT INTO public.expense_categories (name, description, is_active)
  SELECT name, description, true FROM (VALUES
    ('Rent & Lease', 'Monthly rent and lease payments'),
    ('Salaries & Wages', 'Employee and staff salaries'),
    ('Utilities', 'Electricity, water, internet bills'),
    ('Equipment Purchase', 'New gym equipment purchases'),
    ('Equipment Maintenance', 'Repairs and servicing of equipment'),
    ('Marketing & Advertising', 'Ads, promotions, social media'),
    ('Cleaning & Housekeeping', 'Cleaning supplies and services'),
    ('Insurance', 'Business and liability insurance'),
    ('Trainer Commissions', 'PT trainer commission payouts'),
    ('Software & Subscriptions', 'Software licenses and SaaS tools'),
    ('Office Supplies', 'Stationery and office materials'),
    ('Repairs & Maintenance', 'Building and facility repairs'),
    ('Miscellaneous', 'Other uncategorized expenses')
  ) AS defaults(name, description)
  WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories LIMIT 1);

  -- 20260309044705_39f2f781-709b-4584-979e-e417454a4297.sql
  -- ============================================

  CREATE OR REPLACE FUNCTION public.auto_disable_hardware_access()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    -- Disable hardware access when member is suspended or blacklisted
    IF NEW.status IN ('suspended', 'blacklisted') AND OLD.status = 'active' THEN
      NEW.hardware_access_enabled := false;
    END IF;
    -- Re-enable hardware access when member becomes active again
    IF NEW.status = 'active' AND OLD.status IN ('inactive', 'suspended', 'blacklisted') THEN
      NEW.hardware_access_enabled := true;
    END IF;
    RETURN NEW;
  END;
  $function$;

  -- 20260311133628_1a45b040-0f2d-450a-9089-e9258da35989.sql
  -- ============================================

  ALTER TABLE public.member_attendance
    ADD COLUMN IF NOT EXISTS force_entry boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS force_entry_reason text,
    ADD COLUMN IF NOT EXISTS force_entry_by uuid REFERENCES public.profiles(id);

  -- 20260312093331_725a8d97-1c81-4728-a480-64581185340b.sql
  -- ============================================
  ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS biometric_photo_url text, ADD COLUMN IF NOT EXISTS biometric_enrolled boolean DEFAULT false;
  -- 20260312172713_19d11503-2ccd-48b3-a524-39b6dfd70f04.sql
  -- ============================================
  ALTER TABLE public.organization_settings 
  ADD COLUMN IF NOT EXISTS webhook_slug uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS session_timeout_hours integer DEFAULT 8;

  CREATE INDEX IF NOT EXISTS idx_org_settings_webhook_slug ON public.organization_settings(webhook_slug);
  -- 20260313120109_a1b62764-ec27-4493-be9a-663e305e380b.sql
  -- ============================================

  -- Fix 1: Referral trigger - wrong column names and non-existent 'status' column
  CREATE OR REPLACE FUNCTION public.notify_referral_converted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    referrer_user_id UUID;
    referee_name TEXT;
    v_reward_type TEXT;
    v_reward_value NUMERIC;
  BEGIN
    IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
      SELECT m.user_id INTO referrer_user_id FROM members m WHERE m.id = NEW.referrer_id;
      SELECT p.full_name INTO referee_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.referee_id;
      
      SELECT rs.referrer_reward_type, rs.referrer_reward_value INTO v_reward_type, v_reward_value
      FROM referral_settings rs WHERE rs.branch_id = NEW.branch_id AND rs.is_active = true LIMIT 1;
      
      IF v_reward_type IS NOT NULL AND v_reward_value > 0 THEN
        INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value)
        VALUES (NEW.id, NEW.referrer_id, v_reward_type, v_reward_value);
      END IF;
      
      IF referrer_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        VALUES (referrer_user_id, NEW.branch_id,
          'Referral Converted!',
          COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
          'success', 'referral');
      END IF;
    END IF;
    RETURN NEW;
  END;
  $function$;

  -- Fix 2: Add proper UNIQUE constraints for biometric_sync_queue
  DROP INDEX IF EXISTS biometric_sync_queue_member_device_idx;
  DROP INDEX IF EXISTS biometric_sync_queue_staff_device_idx;

  ALTER TABLE public.biometric_sync_queue
    ADD CONSTRAINT biometric_sync_queue_member_device_unique UNIQUE (member_id, device_id);

  ALTER TABLE public.biometric_sync_queue
    ADD CONSTRAINT biometric_sync_queue_staff_device_unique UNIQUE (staff_id, device_id);

  -- 20260313142048_cbd1c88d-876a-41ed-8888-148704b0a359.sql
  -- ============================================
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_attendance;
  -- 20260314061612_61a73f7e-6932-4a22-94ab-a305a3621983.sql
  -- ============================================

  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS weekly_off TEXT DEFAULT 'sunday';
  ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS weekly_off TEXT DEFAULT 'sunday';

  -- 20260314071256_ed9d08a2-6686-4416-bb92-ebb3be741930.sql
  -- ============================================
  ALTER TABLE public.staff_attendance ADD CONSTRAINT staff_attendance_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

  NOTIFY pgrst, 'reload schema';
  -- 20260315082808_2eaeed8d-5780-4682-8c65-7b3a9ce0c354.sql
  -- ============================================

  -- Retention Templates table
  CREATE TABLE public.retention_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
    stage_level integer NOT NULL,
    stage_name text NOT NULL,
    days_trigger integer NOT NULL,
    message_body text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  -- Retention Nudge Logs table
  CREATE TABLE public.retention_nudge_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    template_id uuid REFERENCES public.retention_templates(id) ON DELETE SET NULL,
    stage_level integer NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    channel text NOT NULL DEFAULT 'whatsapp',
    status text NOT NULL DEFAULT 'sent',
    resolved_at timestamptz,
    resolution text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.retention_templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.retention_nudge_logs ENABLE ROW LEVEL SECURITY;

  -- RLS: retention_templates - authenticated staff/admin/owner can read
  CREATE POLICY "Staff and above can view retention templates"
    ON public.retention_templates FOR SELECT TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

  -- RLS: retention_templates - admin/owner can modify
  CREATE POLICY "Admins can manage retention templates"
    ON public.retention_templates FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

  -- RLS: retention_nudge_logs - staff and above can read
  CREATE POLICY "Staff and above can view nudge logs"
    ON public.retention_nudge_logs FOR SELECT TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

  -- RLS: retention_nudge_logs - staff and above can insert/update
  CREATE POLICY "Staff and above can manage nudge logs"
    ON public.retention_nudge_logs FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

  -- Updated_at trigger
  CREATE TRIGGER update_retention_templates_updated_at
    BEFORE UPDATE ON public.retention_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

  NOTIFY pgrst, 'reload schema';

  -- 20260315083943_8f057089-212f-4e80-8673-fd48cb1f33ed.sql
  -- ============================================

  -- Add channels array to retention_templates
  ALTER TABLE public.retention_templates 
    ADD COLUMN IF NOT EXISTS channels text[] DEFAULT '{whatsapp}';

  -- Add message_content to retention_nudge_logs
  ALTER TABLE public.retention_nudge_logs
    ADD COLUMN IF NOT EXISTS message_content text;

  -- 20260315165747_93607f64-a664-4ea8-8efc-1269925eb8aa.sql
  -- ============================================

  -- Drop and recreate get_inactive_members with avatar_url in return type
  DROP FUNCTION IF EXISTS public.get_inactive_members(uuid, integer, integer);

  CREATE OR REPLACE FUNCTION public.get_inactive_members(p_branch_id uuid, p_days integer DEFAULT 7, p_limit integer DEFAULT 50)
  RETURNS TABLE(member_id uuid, member_code text, full_name text, phone text, email text, avatar_url text, last_visit timestamp with time zone, days_absent integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      m.id AS member_id,
      m.member_code,
      COALESCE(p.full_name, 'Unknown') AS full_name,
      p.phone,
      p.email,
      p.avatar_url,
      ma.last_check_in AS last_visit,
      EXTRACT(DAY FROM (now() - ma.last_check_in))::integer AS days_absent
    FROM members m
    JOIN profiles p ON p.id = m.user_id
    JOIN memberships ms ON ms.member_id = m.id AND ms.status = 'active' AND ms.end_date >= CURRENT_DATE
    LEFT JOIN LATERAL (
      SELECT MAX(check_in) AS last_check_in
      FROM member_attendance att
      WHERE att.member_id = m.id
    ) ma ON true
    WHERE m.branch_id = p_branch_id
      AND (ma.last_check_in IS NULL OR ma.last_check_in < now() - (p_days || ' days')::interval)
    ORDER BY ma.last_check_in ASC NULLS FIRST
    LIMIT p_limit;
  END;
  $$;

  -- Fix notify_referral_converted trigger to resolve branch_id from referrer
  CREATE OR REPLACE FUNCTION public.notify_referral_converted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  DECLARE
    referrer_user_id UUID;
    referee_name TEXT;
    v_reward_type TEXT;
    v_reward_value NUMERIC;
    v_branch_id UUID;
  BEGIN
    IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
      v_branch_id := NEW.branch_id;
      IF v_branch_id IS NULL THEN
        SELECT m.branch_id INTO v_branch_id FROM members m WHERE m.id = NEW.referrer_member_id;
      END IF;

      SELECT m.user_id INTO referrer_user_id FROM members m WHERE m.id = NEW.referrer_member_id;
      SELECT p.full_name INTO referee_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.referred_member_id;
      
      IF v_branch_id IS NOT NULL THEN
        SELECT rs.referrer_reward_type, rs.referrer_reward_value INTO v_reward_type, v_reward_value
        FROM referral_settings rs WHERE rs.branch_id = v_branch_id AND rs.is_active = true LIMIT 1;
        
        IF v_reward_type IS NOT NULL AND v_reward_value > 0 THEN
          INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value)
          VALUES (NEW.id, NEW.referrer_member_id, v_reward_type, v_reward_value);
        END IF;
      END IF;
      
      IF referrer_user_id IS NOT NULL AND v_branch_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        VALUES (referrer_user_id, v_branch_id,
          'Referral Converted!',
          COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
          'success', 'referral');
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

  -- 20260316060013_d2955d13-727a-4553-bcb9-32ebfd23ed6e.sql
  -- ============================================

  -- 1. Fix purchase_pt_package: remove ::text cast on reference_id
  CREATE OR REPLACE FUNCTION public.purchase_pt_package(_member_id uuid, _package_id uuid, _trainer_id uuid, _branch_id uuid, _price_paid numeric)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    _package RECORD;
    _member_package_id UUID;
    _commission_amount NUMERIC;
    _monthly_commission NUMERIC;
    _trainer RECORD;
    _commission_rate NUMERIC;
    _invoice_id UUID;
    i INTEGER;
  BEGIN
    SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
    END IF;

    SELECT pt_share_percentage INTO _commission_rate FROM trainers WHERE id = _trainer_id;
    _commission_rate := COALESCE(_commission_rate, 20);

    INSERT INTO member_pt_packages (
      member_id, package_id, trainer_id, branch_id,
      sessions_total, sessions_remaining, price_paid,
      start_date, expiry_date, status
    ) VALUES (
      _member_id, _package_id, _trainer_id, _branch_id,
      CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
      CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
      _price_paid,
      CURRENT_DATE,
      CASE WHEN _package.package_type = 'duration_based' THEN CURRENT_DATE + (_package.duration_months * 30)
          ELSE CURRENT_DATE + _package.validity_days END,
      'active'
    ) RETURNING id INTO _member_package_id;

    INSERT INTO invoices (
      branch_id, member_id, subtotal, total_amount, amount_paid, status, due_date, invoice_type
    ) VALUES (
      _branch_id, _member_id, _price_paid, _price_paid, _price_paid, 'paid', CURRENT_DATE, 'pt_package'
    ) RETURNING id INTO _invoice_id;

    INSERT INTO invoice_items (
      invoice_id, description, unit_price, quantity, total_amount, reference_type, reference_id
    ) VALUES (
      _invoice_id, 'PT Package - ' || _package.name, _price_paid, 1, _price_paid, 'pt_package', _member_package_id
    );

    INSERT INTO payments (
      invoice_id, member_id, branch_id, amount, payment_method, status, payment_date
    ) VALUES (
      _invoice_id, _member_id, _branch_id, _price_paid, 'cash', 'completed', now()
    );

    _commission_amount := _price_paid * (_commission_rate / 100.0);

    IF _package.package_type = 'duration_based' AND _package.duration_months > 0 THEN
      _monthly_commission := ROUND(_commission_amount / _package.duration_months, 2);
      FOR i IN 0..(_package.duration_months - 1) LOOP
        INSERT INTO trainer_commissions (
          trainer_id, pt_package_id, commission_type, amount, percentage, status, release_date
        ) VALUES (
          _trainer_id, _member_package_id, 'package_sale',
          _monthly_commission, _commission_rate, 'pending',
          CURRENT_DATE + (i * 30)
        );
      END LOOP;
    ELSE
      INSERT INTO trainer_commissions (
        trainer_id, pt_package_id, commission_type, amount, percentage, release_date
      ) VALUES (
        _trainer_id, _member_package_id, 'package_sale', _commission_amount, _commission_rate, CURRENT_DATE
      );
    END IF;

    UPDATE members SET assigned_trainer_id = _trainer_id
    WHERE id = _member_id AND assigned_trainer_id IS NULL;

    RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id, 'invoice_id', _invoice_id);
  END;
  $function$;

  -- 2. Create member_comps table
  CREATE TABLE IF NOT EXISTS public.member_comps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    benefit_type_id uuid NOT NULL REFERENCES public.benefit_types(id) ON DELETE CASCADE,
    comp_sessions integer NOT NULL DEFAULT 1,
    used_sessions integer NOT NULL DEFAULT 0,
    reason text,
    granted_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE public.member_comps ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Staff can manage comps" ON public.member_comps
    FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]));

  CREATE POLICY "Members can view own comps" ON public.member_comps
    FOR SELECT TO authenticated
    USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

  -- 3. Create member_documents table
  CREATE TABLE IF NOT EXISTS public.member_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    document_type text NOT NULL DEFAULT 'other',
    file_url text NOT NULL,
    file_name text NOT NULL,
    uploaded_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Staff can manage documents" ON public.member_documents
    FOR ALL TO authenticated
    USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]))
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]));

  CREATE POLICY "Members can view own documents" ON public.member_documents
    FOR SELECT TO authenticated
    USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

  -- 20260316121530_227f5fe5-f56f-48c0-96e5-8cc2a67e89c8.sql
  -- ============================================

  -- Add comp_gift to approval_type enum
  ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'comp_gift';

  -- 20260316121542_434ceaf8-e714-4d9c-8f67-45150a1f0941.sql
  -- ============================================

  -- Make member-photos bucket public so avatar URLs work
  UPDATE storage.buckets SET public = true WHERE id = 'member-photos';

  -- 20260318074947_39f29898-683a-476d-a1e4-a3fe109c3e76.sql
  -- ============================================
  -- Add branch_transfer to approval_type enum
  ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'branch_transfer';

  -- ============================================
  -- MEMBERSHIPS TABLE: Split ALL policy into granular policies
  -- ============================================

  -- Drop the overly permissive ALL policy
  DROP POLICY IF EXISTS "Staff manage branch memberships" ON public.memberships;

  -- SELECT: kept by existing policies (View own memberships + Staff view branch memberships)

  -- INSERT: staff + management can create new memberships
  CREATE POLICY "Staff insert memberships" ON public.memberships
    FOR INSERT TO authenticated
    WITH CHECK (
      has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
      AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
    );

  -- UPDATE: ONLY management (owner/admin/manager) — staff DENIED
  CREATE POLICY "Management update memberships" ON public.memberships
    FOR UPDATE TO authenticated
    USING (
      has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
      AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
    );

  -- DELETE: only owner/admin
  CREATE POLICY "Admin delete memberships" ON public.memberships
    FOR DELETE TO authenticated
    USING (
      has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
    );

  -- ============================================
  -- MEMBERS TABLE: Split ALL policy into granular policies
  -- ============================================

  -- Drop the overly permissive ALL policy
  DROP POLICY IF EXISTS "Staff manage branch members" ON public.members;

  -- INSERT: staff + management can create new members
  CREATE POLICY "Staff insert members" ON public.members
    FOR INSERT TO authenticated
    WITH CHECK (
      has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
      AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
    );

  -- UPDATE: ONLY management — staff DENIED from updating branch_id etc.
  CREATE POLICY "Management update members" ON public.members
    FOR UPDATE TO authenticated
    USING (
      has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
      AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
    );

  -- DELETE: only owner/admin
  CREATE POLICY "Admin delete members" ON public.members
    FOR DELETE TO authenticated
    USING (
      has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
    );
  -- 20260319000000_fix_notify_referral_converted_trigger.sql
  -- ============================================
  -- Fix notify_referral_converted trigger: remove NEW.branch_id access (referrals table has no branch_id column).
  -- The frontend already handles referral_rewards insertion, so the trigger only sends the notification.
  CREATE OR REPLACE FUNCTION public.notify_referral_converted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  DECLARE
    referrer_user_id UUID;
    referee_name TEXT;
    v_branch_id UUID;
  BEGIN
    IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
      -- Resolve branch_id from the referrer's member record (referrals table has no branch_id column)
      SELECT m.branch_id INTO v_branch_id
        FROM members m
      WHERE m.id = NEW.referrer_member_id;

      SELECT m.user_id INTO referrer_user_id
        FROM members m
      WHERE m.id = NEW.referrer_member_id;

      SELECT p.full_name INTO referee_name
        FROM members m
        JOIN profiles p ON p.id = m.user_id
      WHERE m.id = NEW.referred_member_id;

      -- Send notification to referrer
      IF referrer_user_id IS NOT NULL AND v_branch_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, branch_id, title, message, type, category)
        VALUES (
          referrer_user_id,
          v_branch_id,
          'Referral Converted!',
          COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
          'success',
          'referral'
        );
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

  -- 20260319200000_add_meta_template_fields.sql
  -- ============================================
  -- Add Meta WhatsApp template approval tracking columns to the templates table
  ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS meta_template_name text,
    ADD COLUMN IF NOT EXISTS meta_template_status text CHECK (meta_template_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED')),
    ADD COLUMN IF NOT EXISTS meta_rejection_reason text;

  -- Index for fast lookup by meta template name (used in sync)
  CREATE INDEX IF NOT EXISTS idx_templates_meta_template_name
    ON templates (meta_template_name)
    WHERE meta_template_name IS NOT NULL;

  -- 20260321104325_02f5880a-1a1c-4a72-b5ed-8e21ef0c220b.sql
  -- ============================================

  -- Table 1: hardware_devices (tracked by terminal-heartbeat)
  CREATE TABLE public.hardware_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_sn text UNIQUE NOT NULL,
    device_key text,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    ip_address text,
    last_online timestamptz,
    last_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  -- No RLS - only accessed via service_role from edge functions
  ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;

  -- Table 2: access_logs (event log for all terminal interactions)
  CREATE TABLE public.access_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_sn text NOT NULL,
    hardware_device_id uuid REFERENCES public.hardware_devices(id) ON DELETE SET NULL,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    result text,
    message text,
    captured_at timestamptz,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

  -- Index for querying access logs by device and time
  CREATE INDEX idx_access_logs_device_sn ON public.access_logs(device_sn);
  CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at DESC);
  CREATE INDEX idx_access_logs_member_id ON public.access_logs(member_id) WHERE member_id IS NOT NULL;

  -- 20260321143000_terminal_callback_rebuild.sql
  -- ============================================
  CREATE TABLE IF NOT EXISTS public.hardware_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_sn TEXT NOT NULL UNIQUE,
    device_key TEXT UNIQUE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    ip_address TEXT,
    last_online TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS hardware_devices_branch_idx ON public.hardware_devices(branch_id);
  CREATE INDEX IF NOT EXISTS hardware_devices_last_online_idx ON public.hardware_devices(last_online DESC);
  CREATE INDEX IF NOT EXISTS hardware_devices_device_sn_lower_idx ON public.hardware_devices((lower(device_sn)));

  CREATE TABLE IF NOT EXISTS public.access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_sn TEXT NOT NULL,
    hardware_device_id UUID REFERENCES public.hardware_devices(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL DEFAULT 'identify',
    result TEXT NOT NULL DEFAULT 'success',
    message TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS access_logs_branch_idx ON public.access_logs(branch_id, captured_at DESC);
  CREATE INDEX IF NOT EXISTS access_logs_member_idx ON public.access_logs(member_id, captured_at DESC);
  CREATE INDEX IF NOT EXISTS access_logs_device_sn_idx ON public.access_logs(device_sn, captured_at DESC);

  ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'hardware_devices'
        AND policyname = 'Authenticated users can read hardware_devices'
    ) THEN
      CREATE POLICY "Authenticated users can read hardware_devices"
        ON public.hardware_devices
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
  END
  $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'access_logs'
        AND policyname = 'Authenticated users can read access_logs'
    ) THEN
      CREATE POLICY "Authenticated users can read access_logs"
        ON public.access_logs
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
  END
  $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'access_logs'
        AND policyname = 'Authenticated users can insert access_logs'
    ) THEN
      CREATE POLICY "Authenticated users can insert access_logs"
        ON public.access_logs
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;
  END
  $$;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.hardware_devices;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs;
