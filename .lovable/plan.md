## Goal

Audit and make the following pages **truly real-time** — data updates the moment something changes in the database, no manual refresh required:

- `/attendance-dashboard` (Members / Staff Check-in / Staff Log / History tabs)
- `/classes`
- `/feedback`
- `/all-bookings`
- `/store`
- `/finance`
- `/payments`
- `/approvals`

## Audit findings

| Page | Current behaviour | Gap |
|---|---|---|
| Attendance Dashboard | TanStack Query, invalidates only after own mutations | No DB push → tab opened on Page A doesn't update when Page B / hardware writes |
| Classes | Plain queries, no realtime | Same |
| Feedback | Queries + own-mutation invalidation | No realtime when a member submits feedback |
| All Bookings | Queries + own-mutation invalidation | New bookings from members/portal don't appear |
| Store | Queries only | New POS sale, member order, stock change → invisible |
| Finance | Queries + own invalidation | New payment / POS sale / expense from other users → invisible |
| Payments | Queries + own invalidation | New invoice / payment from billing → invisible |
| Approvals | Has `postgres_changes` on `approval_requests` | Subscription works but `approval_requests` is **not in `supabase_realtime` publication**, so events never arrive |

Underlying issue: only ~21 tables are members of the `supabase_realtime` publication. Most operational tables (`staff_attendance`, `feedback`, `class_bookings`, `benefit_bookings`, `pt_sessions`, `classes`, `products`, `pos_sales`, `expenses`, `payments`, `approval_requests`, …) are **not**, so any postgres_changes subscription on them silently no-ops.

## Plan

### 1. Database migration — enable change streams

Add the missing tables to the `supabase_realtime` publication and set `REPLICA IDENTITY FULL` so payloads include the full row (needed for filters / row-level diffs):

```text
approval_requests, staff_attendance, feedback,
class_bookings, benefit_bookings, pt_sessions, classes, class_waitlist,
products, pos_sales, inventory,
expenses, expense_categories, payments
```

(Already in publication: `invoices`, `member_attendance`, `members`, `notifications`, `tasks`, `whatsapp_messages`, etc.)

### 2. New shared hook — `src/hooks/useRealtimeInvalidate.ts`

Tiny utility so every page wires realtime in 3 lines instead of repeating channel boilerplate. Filters by `branch_id` when a branch is selected (defense-in-depth via RLS already in place).

```text
useRealtimeInvalidate({
  channel: 'page-attendance',
  tables: ['member_attendance', 'staff_attendance'],
  invalidateKeys: [
    ['member-attendance-dashboard'],
    ['staff-attendance-log'],
    ['attendance-history'],
  ],
})
```

Internals:
- One Supabase channel per page, `event:'*'`, `schema:'public'`, one subscription per table
- On any event → `queryClient.invalidateQueries({ queryKey })` for each listed key (prefix match)
- Light debounce (250 ms) to coalesce bursts (e.g. bulk POS imports)
- Auto-cleanup on unmount; safe to re-mount (channel name is per-page)

### 3. Wire each page

Add **one** hook call per page, listing only the tables/queries that page actually shows:

| Page | Tables subscribed | Queries invalidated |
|---|---|---|
| AttendanceDashboard | `member_attendance`, `staff_attendance`, `members`, `profiles` | dashboard, staff-log, history, weekly-trends, force-entry |
| Classes | `classes`, `class_bookings`, `class_waitlist` | all class-listing & booking-count queries |
| Feedback | `feedback` | `feedback` |
| AllBookings | `class_bookings`, `benefit_bookings`, `pt_sessions` | all-class-bookings, all-benefit-bookings, all-pt-sessions, monthly-bookings |
| Store | `products`, `inventory`, `invoices`, `pos_sales` | store-products, member-store-orders, store-pos-sales, store-inventory-stats |
| Finance | `payments`, `pos_sales`, `expenses`, `invoices` | finance-income, finance-pos-sales, finance-expenses, pending-expenses, gst-invoices, monthly-report |
| Payments | `payments`, `invoices`, `payment_transactions` | payments, invoices, all-overdue-invoices, member-overdue-invoices |
| Approvals | already has its own subscription → migrate to shared hook for consistency, now actually fires once table is in publication |

### 4. Small UX touch

Add a subtle "Live" pill (green pulsing dot) in each page header so the user can see realtime is active. No more confusion about whether to refresh.

## Out of scope

- No business-logic changes; only realtime wiring.
- No manual refresh buttons removed (kept as a fallback) — just no longer required.
- Member-facing pages (MyBookings etc.) — separate audit if you want.

## Files touched

- **New migration** — alter publication + replica identity for ~14 tables
- **New** `src/hooks/useRealtimeInvalidate.ts`
- **Edit** `src/pages/AttendanceDashboard.tsx`, `Classes.tsx`, `Feedback.tsx`, `AllBookings.tsx`, `Store.tsx`, `Finance.tsx`, `Payments.tsx`, `ApprovalQueue.tsx` (one hook call each + optional Live pill)

## Verification

1. Open `/feedback` in tab A, submit feedback as a member from tab B → row appears in A within ~500 ms with no refresh.
2. Open `/attendance-dashboard` and trigger a MIPS check-in → member appears instantly in the Members tab.
3. Open `/approvals`; create an approval request from another window → counter and list update live (this fixes the silently-broken existing subscription).
4. `/store`: create a POS sale → POS Sales tab updates instantly.
5. `/payments` / `/finance`: record a payment → both pages reflect it without refresh.
