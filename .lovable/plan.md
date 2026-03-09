
# Fix Plan: Query Bugs, AI Fitness Redesign, Public Website CMS Sync, Staff Login

## 1. Critical Query Bug Fixes

### 1a. `employees` Relationship Error in HRM
**File:** `src/pages/HRM.tsx` (line 58)
**Bug:** `employees(employee_code, profile:user_id(full_name))` — `employees.user_id` FK points to `auth.users`, not `profiles`. Supabase cannot traverse `user_id -> profiles`.
**Fix:** Use a 2-step fetch pattern (as noted in project memory). Fetch contracts first, then enrich with profile data by fetching `profiles` separately using the employee's `user_id`.

### 1b. `members(full_name)` Error in Analytics
**File:** `src/pages/Analytics.tsx` (line 183)
**Bug:** `members(full_name)` — `members` table has no `full_name` column. Name lives in `profiles`.
**Fix:** Change to `members(member_code, profiles:user_id(full_name))` (same pattern used in `Invoices.tsx`, `Dashboard.tsx` etc.). Update the UI mapping from `invoice.members?.full_name` to `invoice.members?.profiles?.full_name`.

### 1c. Staff Dashboard Login Crash
**File:** `src/pages/StaffDashboard.tsx` (line 29-34)
**Bug:** `.single()` throws a hard error if no employee record exists for the logged-in staff user, crashing the entire dashboard.
**Fix:** Change `.single()` to `.maybeSingle()` so it returns null instead of throwing. The existing fallback on line 36 already handles the null case.

## 2. Database Migration

Add a FK from `employees.user_id` to `profiles.id` so that Supabase PostgREST can resolve the `profiles:user_id(full_name)` join pattern consistently:

```sql
-- employees.user_id currently references auth.users(id)
-- Add an additional FK to profiles for PostgREST joins
ALTER TABLE public.employees
  ADD CONSTRAINT employees_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

This lets the HRM query work as `employees(employee_code, profiles:user_id(full_name))` without needing the 2-step fetch pattern.

## 3. AI Fitness Page Redesign

**File:** `src/pages/AIFitness.tsx` (full rewrite)

Redesign with 3 clear tabs and modern Vuexy styling:

- **"Generate AI Plan" tab:** Cleaner two-column layout. Left: member info form (name, age, gender, height, weight, goals, experience). Right: generated plan display with structured cards for each day/meal. Add a "Quick Shuffle" button that randomizes exercise order using the deterministic seeded randomizer (member ID + date).
- **"Templates Library" tab:** Card grid of saved templates with difficulty badges, goal tags, and assign/delete actions. Add a "Default Plans" section showing built-in starter templates (Beginner Full Body, Weight Loss, Muscle Building).
- **"Assign to Member" tab:** Member search dropdown, plan selection (from generated or template), date range picker, and assign button.

Key improvements:
- Remove the cluttered nested tabs (plan type inside generate tab)
- Plan type (workout/diet) becomes a toggle at the top level
- Generated plan renders as structured day cards, not raw JSON
- Add "Random Daily Workout" quick action

## 4. Public Website CMS/DB Sync

**File:** `src/pages/PublicWebsite.tsx`

Currently uses hardcoded arrays (TRAINERS, STATS, CLASSES, FAQS). Fix:

- **Trainers section:** Fetch real trainers from `trainers` table joined with `profiles` for name/avatar. Fall back to hardcoded data if DB returns empty.
- **Pricing section:** Fetch real plans from `membership_plans` table (active ones). Show actual prices and benefits from `plan_benefits`.
- **Stats section:** Use CMS theme `stats` if configured, otherwise compute from DB (member count, trainer count, branch count).
- **Classes section:** Fetch upcoming classes from `classes` table.
- **FAQs, Features:** Keep from CMS theme settings or fall back to hardcoded defaults.
- **Hero, Contact info:** Already partially synced via theme; ensure all CMS fields are used (gym name, tagline, address, phone, email, social links).

## 5. Files to Change

| File | Change |
|------|--------|
| **DB Migration** | Add `employees_user_id_profiles_fkey` FK |
| `src/pages/HRM.tsx` | Fix contracts query to use `profiles:user_id(full_name)` via new FK |
| `src/pages/Analytics.tsx` | Fix invoice query: `members(member_code, profiles:user_id(full_name))` |
| `src/pages/StaffDashboard.tsx` | Change `.single()` to `.maybeSingle()` on employee query |
| `src/pages/AIFitness.tsx` | Full redesign with 3 tabs, quick shuffle, structured plan display |
| `src/pages/PublicWebsite.tsx` | Sync trainers/plans/classes/stats from DB, keep CMS theme for styling |

## Execution Order

1. DB migration (add FK for employees -> profiles)
2. Fix critical query bugs (Analytics, HRM, StaffDashboard)
3. Redesign AI Fitness page
4. Sync Public Website with DB data
