

# Fix Manager Menu & Role-Based Sidebar Filtering

## Problem
The sidebar shows ALL items from `adminMenuConfig` to managers without filtering by each item's `roles` array. Managers see items like Analytics, Finance Overview, Payments, HRM, System Health, Audit Logs, and Settings — which are restricted to `['owner', 'admin']` only. Route protection blocks access correctly, but the menu creates confusion by showing inaccessible links.

## Root Cause
In `AppSidebar.tsx`, both desktop and mobile sidebars iterate `section.items` and render every item without checking if the current user's role is in `item.roles`.

## Fix

### 1. Create a dedicated `managerMenuConfig` in `src/config/menu.ts`

Instead of sharing `adminMenuConfig`, create a manager-specific menu that only includes what managers should see:

**Manager gets:**
- Dashboard (not Analytics)
- Members & Leads: Leads, Members, Attendance, Plans, Referrals, Feedback
- Training & Bookings: Classes, PT Sessions, Trainers, All Bookings, AI Fitness
- E-Commerce: POS, Products, Categories, Store Orders, Discount Coupons
- Finance: Invoices only (no Overview, no Payments)
- Operations: WhatsApp, Announcements, Equipment, Lockers, Devices
- Admin & HR: Staff Attendance, Tasks, Approvals (no HRM, no System Health, no Audit Logs, no Settings)

**Manager does NOT get:**
- Analytics, Finance Overview, Payments, HRM, System Health, Audit Logs, Settings

### 2. Update `getMenuForRole()` to return `managerMenuConfig` for managers

Add a check: if user has `manager` role but NOT `owner` or `admin`, return `managerMenuConfig`.

### 3. Add sidebar-level item filtering as a safety net

In `AppSidebar.tsx`, filter `section.items` by checking if any of the user's roles appear in `item.roles`. This prevents any future menu config mistakes from leaking unauthorized items.

### 4. Filter empty sections

After filtering items, skip rendering sections that have zero visible items.

---

## Files to Change

| File | Change |
|------|--------|
| `src/config/menu.ts` | Add `managerMenuConfig`, update `getMenuForRole` to check for manager without admin/owner |
| `src/components/layout/AppSidebar.tsx` | Add role-based item filtering in both desktop and mobile nav as safety net |

## Execution Order
1. Add `managerMenuConfig` to menu.ts with correct items
2. Update `getMenuForRole` routing logic
3. Add sidebar item filtering safety net

