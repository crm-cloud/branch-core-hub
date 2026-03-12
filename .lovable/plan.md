

# Performance Optimization: Pagination, Skeletons, Caching & Error Logging

## Current State

- **Members**: `select('*', ...)` with `.limit(100)`, no pagination UI, spinner-only loading
- **Invoices**: `select('*', ...)` with `.limit(100)`, client-side filtering, spinner-only loading
- **Attendance**: No pagination (fetches today's data, acceptable scope)
- **PT Sessions**: No pagination, fetches all packages
- **React Query staleTime**: Already 2 minutes globally — good baseline
- **ErrorBoundary**: Already wraps `<BrowserRouter>` at top of `App` — good
- **Error logging**: `initGlobalErrorLogging` already captures fetch errors including 400/406 — already implemented

## Plan

### 1. Server-Side Pagination (Members + Invoices)

**Members (`src/pages/Members.tsx`)**:
- Add `page` state (default 0), `pageSize = 20`
- Replace `.limit(100)` with `.range(page * pageSize, (page + 1) * pageSize - 1)`
- Use `{ count: 'exact', head: false }` in select to get total count
- Trim `select('*')` to: `id, member_code, user_id, branch_id, status, created_at, assigned_trainer_id, profiles:user_id(full_name, email, phone, avatar_url), branch:branch_id(name, code), memberships(id, status, start_date, end_date, plan_id, membership_plans(name))`
- Add pagination controls at bottom (Previous/Next + page indicator)
- For search RPC: reduce `p_limit` to 20, pass page offset

**Invoices (`src/pages/Invoices.tsx`)**:
- Same pagination pattern: `page` state, `.range()`, `{ count: 'exact' }`
- Trim select to: `id, invoice_number, status, total_amount, amount_paid, due_date, created_at, member_id, pos_sale_id, members(member_code, profiles:user_id(full_name)), invoice_items(description, reference_type)`
- Move `statusFilter` to server-side: `.eq('status', statusFilter)` when not 'all'
- Add pagination controls

**PT Sessions (`src/pages/PTSessions.tsx`)**:
- Add `.limit(50)` to active packages query (already scoped by branch)

### 2. Skeleton Loaders

Create a reusable `TableSkeleton` component in `src/components/ui/table-skeleton.tsx`:
```
- Props: rows (default 8), columns (default 6)
- Renders Table with skeleton header + N skeleton rows
- Each row has Skeleton cells matching column widths
```

Replace the spinner in:
- `Members.tsx` (line 360-362)
- `Invoices.tsx` (loading state)
- `PTSessions.tsx` (loading state)
- `Dashboard.tsx` (stat cards when loading)

Add `StatCardSkeleton` for dashboard stat cards.

### 3. Optimistic Updates & Caching

**Stale time increase** (`src/App.tsx` line 104):
- Change `staleTime: 1000 * 60 * 2` → `1000 * 60 * 5` (5 minutes) for cached navigation

**Optimistic update for trainer assignment** (`AssignTrainerDrawer.tsx`):
- Use `queryClient.setQueryData` to optimistically update the member's `assigned_trainer_id` before the mutation completes
- On error, roll back via `onError` callback

**Optimistic update for member status** (freeze/activate):
- Same pattern in `QuickFreezeDrawer` — update local cache before server confirms

### 4. Realtime Live Check-in (Already Partially Done)

`LiveAccessLog` already subscribes to realtime. Verify `access_device_events` is in `supabase_realtime` publication. If not, add migration.

### 5. PublicWebsite Duplicate Key Fix

Console shows duplicate key `Trainer` in `PublicWebsite.tsx` line 207. Fix by using `index` or `trainer.id` as key instead of a static string.

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/ui/table-skeleton.tsx` | New — reusable skeleton table component |
| `src/pages/Members.tsx` | Pagination state, `.range()`, selective columns, skeleton loader, pagination UI |
| `src/pages/Invoices.tsx` | Pagination, server-side status filter, selective columns, skeleton loader |
| `src/pages/PTSessions.tsx` | Add `.limit(50)`, skeleton loader |
| `src/pages/Dashboard.tsx` | Skeleton cards while loading |
| `src/App.tsx` | Increase staleTime to 5 min |
| `src/components/members/AssignTrainerDrawer.tsx` | Optimistic UI update |
| `src/pages/PublicWebsite.tsx` | Fix duplicate key warning |

## Execution Order

1. Create `TableSkeleton` component
2. Members page: pagination + selective fetch + skeleton
3. Invoices page: pagination + server-side filter + skeleton
4. Dashboard skeleton cards
5. App.tsx staleTime bump
6. AssignTrainer optimistic update
7. PublicWebsite key fix

