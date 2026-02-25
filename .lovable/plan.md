

# Comprehensive System Audit and Feature Completion Plan

## Summary

This plan covers 4 major workstreams across HRM/Payroll, UI/UX, Member Lifecycle Automation, RBAC enforcement, and a CMS audit. Each section details the root cause, fix, and files affected.

---

## 1. HRM, Attendance & Payroll Engine

### 1A. Staff Attendance in HRM

**Current State:** Staff attendance exists at `/staff-attendance` but is NOT linked from the HRM page. The HRM Payroll tab does a stub calculation with no real attendance data integration.

**Fix:**
- Add a 4th tab "Attendance" to the HRM page (`src/pages/HRM.tsx`) that embeds a branch-filtered staff attendance log (reusing the `useStaffAttendance` hook).
- Show check-in/out times, duration, and daily totals per employee.

### 1B. Fix Contracts Tab -- Base Salary + Commission %

**Current State:** The `contracts` table schema has `salary` (numeric) and `terms` (jsonb) but NO `trainer_id` column. The `CreateContractDrawer` tries to pass `trainerId` but the column doesn't exist, so trainer contracts silently fail.

**Fix (DB Migration):**
- Add `trainer_id` column (uuid, FK to trainers) to `contracts` table.
- Add `commission_percentage` column (numeric, default 0) to `contracts` table.
- Add `base_salary` column (numeric, default 0) to `contracts` table -- for clarity alongside existing `salary` field.

**Fix (UI):**
- Update `CreateContractDrawer` to include a "Commission %" input field.
- Display Base Salary and Commission % in the Contracts tab table.

### 1C. Payroll Calculator -- Dynamic Calculation

**Current State:** `calculatePayroll` in `hrmService.ts` does `(monthlySalary / 30) * attendanceDays` with zero deductions and zero commission. The UI in the Payroll tab just shows static salary with a "Process" button that only toasts.

**Fix:**
- Enhance `calculatePayroll` to:
  - Pro-rate base salary by attendance: `(salary / workingDays) * daysPresent`
  - Query `trainer_commissions` table for the employee's trainer (if linked) to sum PT commission for the month.
  - Calculate: `grossPay = proRatedSalary + ptCommission`
  - Apply standard deductions (PF 12%, ESI if applicable).
  - Return: `{ basePay, ptCommission, grossPay, pfDeduction, esiDeduction, netPay }`
- Update the Payroll tab UI to show these breakdown columns.

### 1D. Payslips -- PDF Download + Email

**Fix:**
- Add a "Download Payslip" button per employee row in the Payroll tab.
- Use the existing `pdfGenerator.ts` pattern to generate a payslip PDF with: employee name, code, month, base pay, commission, deductions, net pay, company details.
- Add a "Send via Email" button (placeholder -- logs to communication_logs for now, actual email requires SMTP integration).

---

## 2. UI/UX Overhaul

### 2A. Analytics Dashboard -- Vuexy Premium

**Current State:** Already uses gradient hero cards, bar charts, pie charts. The styling is already close to Vuexy.

**Fix (Enhancement):**
- Add `refetchInterval: 60000` to analytics queries for near-real-time updates.
- Apply deeper gradient cards with `shadow-lg shadow-indigo-500/20` and `rounded-2xl` consistently.
- Add subtle hover animations (`hover:shadow-xl transition-shadow`) to all stat cards.
- Ensure chart tooltip styles use dark bg with rounded corners (already partially done).

### 2B. Settings -> Benefits -- Clean Card Grid

**Current State:** `BenefitSettingsComponent.tsx` renders 3 sections vertically: BenefitTypesManager, FacilitiesManager, and Slot Booking Settings. The Slot Booking section renders one large card per benefit type with 10+ form fields each -- visually overwhelming.

**Fix:**
- Redesign the Slot Booking Settings section:
  - Replace the expanded form cards with a compact grid of "Benefit Cards" (icon + name + on/off toggle + "Configure" button).
  - Clicking "Configure" opens a Sheet/Drawer with the full settings form.
  - This reduces vertical scroll significantly.
- Keep BenefitTypesManager and FacilitiesManager as-is (they already work well).

---

## 3. Member Lifecycle & Automations

### 3A. Renewal Invoice -- Auto-Generate 7 Days Before Expiry

**Current State:** The `send-reminders` edge function already sends notifications 7/3/1 days before expiry. But it does NOT generate a pending invoice.

**Fix (DB Migration):**
- Create a SQL function `generate_renewal_invoices()` that:
  1. Finds active memberships expiring in exactly 7 days.
  2. Checks if a renewal invoice already exists for that membership.
  3. If not, creates a `pending` invoice with the plan's base price.
  4. Inserts a notification for the member: "Your renewal invoice has been generated."
- Schedule via `pg_cron` to run daily at 2 AM UTC.

### 3B. Automated Birthday Notifications

**Current State:** The `send-reminders` edge function already handles birthday wishes (section 2, lines 88-116). It checks `profiles.date_of_birth`, matches today's month/day, and inserts a birthday notification. This is already working.

**Assessment:** No change needed -- birthday automation is already implemented.

### 3C. Dashboard Sync -- Instant State Updates

**Current State:** React Query uses `staleTime: 2 minutes` and `refetchOnWindowFocus: false`. After a payment or renewal, the member dashboard won't reflect changes until the cache expires.

**Fix:**
- After mutations (payment recording, membership purchase, benefit booking), ensure `queryClient.invalidateQueries` is called for the affected query keys.
- Audit key mutation handlers in `billingService`, `membershipService`, `benefitBookingService` to ensure they invalidate: `['member-data']`, `['active-membership']`, `['pending-invoices']`.
- This is primarily a React Query cache invalidation audit -- most mutations already do this, but we need to verify completeness.

---

## 4. Strict RBAC Enforcement

### Current RBAC State (from App.tsx audit):

| Route | Current Roles | Required Change |
|-------|---------------|-----------------|
| `/analytics` | owner, admin, **manager** | Remove manager (financial data) |
| `/finance` | owner, admin, **manager** | Remove manager |
| `/payments` | owner, admin, **manager** | Remove manager |
| `/hrm` | owner, admin, **manager** | Remove manager |
| `/settings` | owner, admin | Correct (already restricted) |
| `/audit-logs` | owner, admin | Correct |
| `/staff-attendance` | owner, admin, manager, staff, trainer | Correct (self-attendance) |
| `/products`, `/product-categories` | owner, admin, **manager** | Keep (ops management) |
| `/pos` | owner, admin, manager, **staff** | Correct (reception POS) |

**Fix:**
- Update `App.tsx` route guards:
  - `/analytics` -> `['owner', 'admin']` (block manager from financial analytics)
  - `/finance` -> `['owner', 'admin']` (block manager from finance overview)
  - `/payments` -> `['owner', 'admin']` (block manager from payment records)
  - `/hrm` -> `['owner', 'admin']` (block manager from HRM/payroll)
- Update `menu.ts`:
  - Move Analytics, Finance, Payments, HRM to `['owner', 'admin']` only.
  - Keep manager access to: Members, Leads, Attendance, Plans, Classes, POS, Invoices, Lockers, Tasks, Approvals.
- Staff menu already correctly blocks HRM, Analytics, and Payroll.
- Trainer routes already correctly restrict to own data only.
- Member routes already correctly restrict to personal profile, wallet, bookings.

---

## 5. Public Website / CMS Audit

### Current State:

**Working:**
- Public website at `/` renders a full-featured landing page with hero, features, classes, trainers, pricing, testimonials, FAQ, and contact form.
- Lead capture form works via `capture-lead` edge function.
- CMS at `/settings?tab=website` (redirected from `/website-cms`) allows editing gym name, tagline, contact info, social links, hero content, features, pricing plans, testimonials, and theme colors.

**Issues Found:**
1. **CMS uses localStorage only** -- `cmsService.ts` stores all theme data in `localStorage`. This means:
   - Changes made on one browser/device don't sync to others.
   - The public website (visited by potential members) reads from the VISITOR's localStorage, not the admin's. So CMS changes are effectively invisible to website visitors.
2. **PublicWebsite.tsx hardcodes most content** -- TRAINERS, STATS, CLASSES, FAQS, FEATURES_ADVANCED are all hardcoded arrays (lines 46-86). The CMS-managed `theme.features` and `theme.pricingPlans` are used in some sections, but the majority of content is static.
3. **No database persistence** -- The `organization_settings` table exists and stores org-level settings, but the CMS doesn't use it for website content.

**Fix:**
- Migrate CMS storage from localStorage to the `organization_settings` table in the database.
- Update `cmsService.ts` to read/write from the database instead of localStorage.
- Update `PublicWebsite.tsx` to load theme/content from the database so all visitors see the admin-configured content.
- Keep the hardcoded TRAINERS/CLASSES/FAQS as fallback defaults when no CMS data exists.

---

## Execution Order

| Step | Priority | Files | Description |
|------|----------|-------|-------------|
| 1 | Critical | DB Migration | Add `trainer_id`, `commission_percentage` to `contracts`; create `generate_renewal_invoices()` function + cron |
| 2 | High | `src/pages/HRM.tsx` | Add Attendance tab, fix Contracts display, enhance Payroll with breakdown + PDF download |
| 3 | High | `src/services/hrmService.ts` | Enhance `calculatePayroll` with commission + deductions |
| 4 | High | `src/components/hrm/CreateContractDrawer.tsx` | Add Commission % field |
| 5 | High | `src/App.tsx` | Tighten RBAC: remove `manager` from finance/analytics/hrm routes |
| 6 | High | `src/config/menu.ts` | Update admin menu roles for restricted items |
| 7 | Medium | `src/pages/Analytics.tsx` | Add refetchInterval, polish Vuexy shadows |
| 8 | Medium | `src/components/settings/BenefitSettingsComponent.tsx` | Redesign slot settings as compact card grid |
| 9 | Medium | `src/services/cmsService.ts` | Migrate from localStorage to database |
| 10 | Medium | `src/pages/PublicWebsite.tsx` | Load CMS content from database |

---

## Technical Details

### DB Migration SQL

```sql
-- Add trainer_id and commission to contracts
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES public.trainers(id),
  ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_salary numeric DEFAULT 0;

-- Renewal invoice generation function  
CREATE OR REPLACE FUNCTION generate_renewal_invoices()
RETURNS void AS $$
DECLARE
  ms RECORD;
  inv_exists boolean;
BEGIN
  FOR ms IN
    SELECT m.id as membership_id, m.member_id, m.branch_id, m.plan_id, 
           mp.name as plan_name, mp.price as plan_price
    FROM memberships m
    JOIN membership_plans mp ON m.plan_id = mp.id
    WHERE m.status = 'active'
    AND m.end_date = CURRENT_DATE + INTERVAL '7 days'
  LOOP
    -- Check if renewal invoice already exists
    SELECT EXISTS(
      SELECT 1 FROM invoices i 
      JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.member_id = ms.member_id 
      AND ii.reference_type = 'membership'
      AND i.status = 'pending'
      AND i.created_at > CURRENT_DATE - INTERVAL '7 days'
    ) INTO inv_exists;
    
    IF NOT inv_exists THEN
      -- Create renewal invoice (simplified)
      INSERT INTO invoices (branch_id, member_id, total_amount, status)
      VALUES (ms.branch_id, ms.member_id, ms.plan_price, 'pending');
      
      -- Notify member
      INSERT INTO notifications (user_id, title, message, type, category)
      SELECT user_id, 'Renewal Invoice Generated',
        'Your membership renewal invoice for ' || ms.plan_name || ' has been generated.',
        'info', 'billing'
      FROM members WHERE id = ms.member_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedule daily at 2 AM UTC
SELECT cron.schedule('generate-renewal-invoices', '0 2 * * *',
  $$SELECT generate_renewal_invoices()$$
);
```

### Payroll Calculator Enhancement

```typescript
// Enhanced calculatePayroll
export async function calculatePayroll(employeeId: string, month: string) {
  const employee = await getEmployee(employeeId);
  const startDate = `${month}-01`;
  const endDate = /* last day of month */;
  
  const attendance = await fetchEmployeeAttendance(employeeId, startDate, endDate);
  const workingDays = 26; // Standard Indian working days
  const daysPresent = attendance.length;
  const baseSalary = employee.salary || 0;
  const proRatedPay = (baseSalary / workingDays) * daysPresent;
  
  // Fetch PT commissions if employee has a linked trainer record
  let ptCommission = 0;
  const { data: trainerLink } = await supabase
    .from('trainers').select('id, pt_share_percentage')
    .eq('user_id', employee.user_id).maybeSingle();
  
  if (trainerLink) {
    const { data: commissions } = await supabase
      .from('trainer_commissions').select('amount')
      .eq('trainer_id', trainerLink.id)
      .gte('created_at', startDate).lte('created_at', endDate);
    ptCommission = commissions?.reduce((s, c) => s + c.amount, 0) || 0;
  }
  
  const grossPay = proRatedPay + ptCommission;
  const pfDeduction = Math.round(proRatedPay * 0.12);
  const netPay = grossPay - pfDeduction;
  
  return { baseSalary, proRatedPay, ptCommission, grossPay, pfDeduction, netPay, daysPresent, workingDays };
}
```

### CMS Migration Pattern

```typescript
// Updated cmsService.ts
export const cmsService = {
  async getTheme(): Promise<ThemeSettings> {
    const { data } = await supabase
      .from('organization_settings')
      .select('website_theme')
      .single();
    return data?.website_theme ? { ...DEFAULT_THEME, ...data.website_theme } : DEFAULT_THEME;
  },
  
  async saveTheme(theme: Partial<ThemeSettings>) {
    const current = await this.getTheme();
    const updated = { ...current, ...theme };
    await supabase
      .from('organization_settings')
      .update({ website_theme: updated })
      .eq('id', /* org id */);
    return updated;
  },
};
```

