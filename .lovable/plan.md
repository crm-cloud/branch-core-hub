

# Reset All Database Tables

---

## Approach

Create a one-click "Reset All Data" button in the existing Demo Data settings page that calls a new edge function to truncate all public tables. Using `TRUNCATE ... CASCADE` handles foreign key dependencies automatically.

---

## Implementation

### 1. New Edge Function: `reset-all-data`

A backend function that:
- Requires authentication and owner/admin role check
- Runs `TRUNCATE` with `CASCADE` on all public tables **except** `profiles`, `user_roles`, and `branches` (to preserve auth-linked data and the base branch)
- Optionally truncates those too if a `full_reset=true` flag is passed
- Uses the service role key for elevated permissions

Tables to truncate (in one CASCADE statement):
```
members, memberships, membership_plans, plan_benefits,
member_attendance, membership_freeze_history, membership_free_days,
invoices, invoice_items, payments, payment_transactions, payment_reminders,
pos_sales, ecommerce_orders, products, product_categories, inventory, stock_movements,
trainers, trainer_availability, trainer_commissions, trainer_change_requests,
pt_packages, pt_sessions, member_pt_packages,
classes, class_bookings, class_waitlist,
equipment, equipment_maintenance,
lockers, locker_assignments,
leads, lead_followups,
employees, contracts, staff_attendance, payroll_rules,
expenses, expense_categories,
announcements, notifications, notification_preferences,
approval_requests, audit_logs, communication_logs,
feedback, tasks, templates,
benefit_types, benefit_packages, benefit_settings, benefit_slots, benefit_bookings, benefit_usage, member_benefit_credits,
diet_plans, diet_templates, fitness_plan_templates, member_fitness_plans, member_measurements,
exercises, workout_plans, workout_templates, ai_plan_logs,
discount_codes, referrals, referral_rewards, referral_settings,
wallets, wallet_transactions,
access_devices, device_access_events, biometric_sync_queue,
whatsapp_messages, settings, integration_settings,
branch_settings, branch_managers, staff_branches,
member_branch_history, expense_category_templates,
permissions, role_permissions
```

Then optionally: `profiles, user_roles` (full reset).

### 2. Update DemoDataSettings.tsx

Add a red "Reset All Data" button above the existing "Load Demo Data" button with:
- A confirmation dialog (AlertDialog) requiring the user to type "RESET" to confirm
- Loading state while the function runs
- Success/error feedback via toast

---

## Files

| File | Action |
|------|--------|
| `supabase/functions/reset-all-data/index.ts` | **Create** - Edge function to truncate all tables |
| `src/components/settings/DemoDataSettings.tsx` | **Edit** - Add Reset All Data button with confirmation |

---

## Technical Details

### Edge Function (`reset-all-data/index.ts`)
```text
- POST only, requires Authorization header
- Validates caller has owner role via service role client
- Executes: TRUNCATE table1, table2, ... RESTART IDENTITY CASCADE
- If full_reset=true in body, also truncates profiles and user_roles
- Returns { success: true, tables_cleared: count }
```

### DemoDataSettings.tsx Changes
- Add AlertDialog with text input confirmation ("Type RESET to confirm")
- Red destructive button: "Reset All Data"
- On confirm: calls `supabase.functions.invoke('reset-all-data')`
- After success, show toast and optionally prompt to reload demo data

