

# Comprehensive Audit & Fix Plan

## 1. CRITICAL: Frozen Membership Shows "No Plan" — Allows Overriding

**Root cause:** In `MemberProfileDrawer.tsx` line 542:
```ts
const activeMembership = memberDetails?.memberships?.find((m: any) => m.status === 'active');
```
This ignores `frozen` memberships entirely. A frozen member sees "No Plan" → "Add Plan" → can purchase a new plan, which creates a second membership record and effectively overrides the frozen one.

**Fix:** Change to find `active` OR `frozen` membership:
```ts
const activeMembership = memberDetails?.memberships?.find(
  (m: any) => m.status === 'active' || m.status === 'frozen'
);
```

Also apply the same fix in:
- `Members.tsx` line 97-103 (`getActiveMembership` logic) — must include `frozen` status
- `PurchaseMembershipDrawer.tsx` line 72-86 — the `active-membership-check` query only checks `status = 'active'`. Must also check `status = 'frozen'` so the drawer blocks purchase when frozen
- The button text logic (line 666) should show "Frozen" text instead of "Add Plan" for frozen members

**Additionally:** Add a server-side guard in the purchase flow — before inserting a new membership, check if any `active` or `frozen` membership exists and block if so.

## 2. Branch Selector — Classes, PT Sessions, Lockers

**Classes page** (line 27): Uses `effectiveBranchId` directly — works correctly.  
**PT Sessions** (line 47-48): Uses `effectiveBranchId` and `branchFilter` — works correctly.  
**Lockers** (line 36): Already has `branchLoading` guard from prior fix — works correctly.

No code changes needed here. The branch selector itself works; the issue was likely transient loading states already fixed.

## 3. Sidebar Shows "Default" Instead of Organization Name

**Root cause:** `BrandLogo` component (AppSidebar.tsx line 28-39) queries `organization_settings` for `name`. The stored value in the database is literally "Default" — it's not a code bug, it's a data issue. However, the fallback text says `'Incline'` which is the project name.

**Fix:** Update the fallback to show nothing/logo when name is "Default", and surface the org name editor more prominently. Also, ensure the sidebar respects theme colors better.

## 4. Theme System — Sidebar Always Dark

**Root cause:** All 6 themes in `ThemeContext.tsx` define dark sidebar backgrounds (`--sidebar-background` with low lightness values like 10-12%). This means regardless of theme choice, the sidebar is always a dark color variant.

**Fix:** Add a `sidebarMode` option (`'light' | 'dark'`) to the theme system. When `light`, use high-lightness sidebar values (white/light background with dark text). Update the sidebar CSS to use `--sidebar-foreground` properly. This gives a modern 2026 look where the sidebar can be white/light with colored accents.

## 5. Analytics Page UI/UX Audit

The Analytics page already uses Vuexy-style rounded cards, gradient stat cards, and recharts. However, it has hardcoded `text-slate-800` colors instead of using theme-aware CSS variables, meaning it won't adapt to themes properly.

**Fix:** Replace all `text-slate-800` with `text-foreground`, `text-slate-600` with `text-muted-foreground`, `shadow-indigo-100` with `shadow-primary/5` to make it theme-aware. Also add branch filtering (currently missing — queries all branches).

## 6. System Health — Database Error Audit

Need to query current errors. Known remaining issues from prior fixes:
- `membership_plans.features` column doesn't exist (PublicWebsite)
- `pt_sessions.session_date` → should be `scheduled_at` (already fixed in AllBookings, check TrainerDashboard)
- DialogTitle accessibility warnings across multiple drawers

**Fix:** Run through all error categories and apply remaining fixes.

## 7. Profile — Recent Activity Human-Readable

**Current state:** Line 291 shows `activity.action_description` which comes from the `audit_log_trigger_function`. The trigger generates descriptions like: `Rajat Lekhari created lockers "d4f8-4e80-94b7-5561063d6bfe"` — using UUIDs when the record has no human-readable name column.

**Fix:** The trigger already tries `name`, `full_name`, `member_code`, `invoice_number`, `title` fields. For tables like `lockers`, the record name falls back to the UUID. Update the trigger to also check `locker_number` for lockers. Additionally, in the Profile UI, truncate/format the description to hide UUIDs.

## 8. Occupancy Gauge — Hardcoded Capacity of 50

**Root cause:** `OccupancyGauge` component (line 10) defaults `capacity = 50`. The Dashboard passes no capacity prop (line 340).

**Fix:** 
- Add a `capacity` column to `branches` table (or use `organization_settings`)
- Query the branch capacity in the Dashboard and pass it to `OccupancyGauge`
- Provide a UI field in Branch Settings to configure capacity

## 9. Staff Dashboard — Daily Operations Audit

The staff menu (config/menu.ts lines 96-145) already has: Dashboard, Follow-Up Center, Members, Attendance, Leads, Feedback, Classes, PT Sessions, All Bookings, Benefit Tracking, POS, Invoices, Payments, Equipment, Lockers, Tasks, WhatsApp, Announcements, Staff Attendance.

This is comprehensive for daily operations. Staff should NOT have access to: Plans management, Trainers management, Analytics, Finance Overview, Settings, System Health, Audit Logs, HRM, Device Management.

**Current state:** Staff menu correctly excludes these admin items. No changes needed to menu config.

**Fix:** Ensure the `ProtectedRoute` in `App.tsx` blocks staff from admin-only routes (already done).

---

## Database Migration

```sql
-- Add branch_capacity to branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 50;

-- Update audit trigger to include locker_number
-- (Update the audit_log_trigger_function to check locker_number)
```

## Files to Change

| File | Change |
|------|--------|
| `src/components/members/MemberProfileDrawer.tsx` | Include `frozen` status in activeMembership lookup; show "FROZEN - [Plan Name]" instead of "No Plan"; block purchase actions |
| `src/pages/Members.tsx` | Include `frozen` in active membership detection |
| `src/components/members/PurchaseMembershipDrawer.tsx` | Block purchase when membership is frozen; query both active AND frozen |
| `src/contexts/ThemeContext.tsx` | Add light sidebar mode option; update theme definitions |
| `src/components/layout/AppSidebar.tsx` | Support light/dark sidebar via theme context |
| `src/components/dashboard/OccupancyGauge.tsx` | Accept capacity from branch settings |
| `src/pages/Dashboard.tsx` | Query branch capacity; pass to OccupancyGauge |
| `src/pages/Analytics.tsx` | Replace hardcoded slate colors with theme-aware variables; add branch filtering |
| `src/pages/Profile.tsx` | Format activity descriptions to hide UUIDs |
| **DB Migration** | Add `capacity` to `branches`; update audit trigger for `locker_number` |

## Execution Order
1. Fix frozen membership logic (critical business bug)
2. Fix PurchaseMembershipDrawer to block frozen members
3. Theme system light sidebar + org name fix
4. Occupancy capacity from branch settings
5. Analytics page theme-aware colors
6. Profile activity human-readable formatting
7. System health error fixes

