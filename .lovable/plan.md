
# Cmd+K Command Center — Plan

Goal: turn the current search-only palette (which navigates to dead `?highlight=` URLs) into a fast, role/branch-aware command center that opens the actual record drawers and exposes daily actions.

## 1. Backend — Secure search RPCs (new migration)

Add `SECURITY DEFINER` SQL functions, all enforcing role + branch scope server-side using `has_role`, `staff_branches`, `employees`, `trainers`, and `members`. Branch arg is optional; when null, the function returns rows for every branch the caller can see.

Helper (private):
- `user_visible_branches(_uid uuid) returns setof uuid` — returns:
  - all branch IDs if owner/admin
  - `staff_branches.branch_id` rows for managers
  - `employees.branch_id` / `trainers.branch_id` for staff/trainer
  - `members.branch_id` for members (limited use)

New RPCs (each `LIMIT` capped at 10, accept `search_term text`, `p_branch_id uuid default null`, `p_limit int default 10`):
- `search_command_members` — wraps existing `search_members` but strictly intersects with `user_visible_branches`. Returns id, name, member_code, phone, email, status, branch_id, branch_name.
- `search_command_invoices` — by invoice_number, member name, member_code; returns id, invoice_number, status, total_amount, amount_paid, member_id, member_name, branch_id, branch_name.
- `search_command_leads` — by name/phone/email; returns id, full_name, phone, email, status, branch_id, branch_name. Hidden from staff if lead not in their branches.
- `search_command_trainers` — by name/phone/code; returns id, full_name, trainer_code, is_active, branch_id, branch_name. Trainer role: only self.
- `search_command_payments` — by reference, member name, invoice number; returns id, reference, amount, payment_method, paid_at, invoice_id, member_id.
- `search_command_bookings` — by member name, class/facility name; returns id, kind ('class'|'facility'|'pt'), title, when_at, status, branch_id, branch_name, related_id.
- `search_command_tasks` — by title; returns id, title, status, priority, due_at, assignee_name, related_type, related_id.

All RPCs:
- `EXECUTE ON FUNCTION ... TO authenticated`
- Use `auth.uid()` server-side; never trust caller-supplied user.
- Use `unaccent` + `ilike '%' || term || '%'` against an indexed expression where it already exists.
- Skip silently (return zero rows) for `member` role on every command-center RPC except `search_command_invoices` filtered to own member_id (so we don't accidentally power admin Cmd+K for members).

## 2. Frontend rebuild — `src/components/search/GlobalSearch.tsx`

Rewrite as composition of small pieces in `src/components/search/`:

```text
search/
  GlobalSearch.tsx            // entry, hotkey, dialog wrapper
  useCommandCenter.ts         // state: query, debounced term, active section
  useCommandSearch.ts         // useQuery hooks per RPC, role-gated
  usePageShortcuts.ts         // builds page list from menu config + role
  useRecentCommands.ts        // localStorage MRU per user id
  sections/
    PageResults.tsx
    ActionResults.tsx
    MemberResults.tsx
    LeadResults.tsx
    InvoiceResults.tsx
    PaymentResults.tsx
    BookingResults.tsx
    TaskResults.tsx
    TrainerResults.tsx
    RecentResults.tsx
    EmptyState.tsx
    ResultRow.tsx             // shared row with branch badge + status badge
```

Key behaviour:
- Hotkey: `⌘K` / `Ctrl+K`. Footer shows `Enter`, `⌘+Enter`, `Esc` hints.
- 250 ms debounce; queries gated `enabled: term.length >= 2`.
- All RPC calls via TanStack Query with keys like `['cmdk', 'members', term, branchFilter]`.
- Branch scoping: pass `branchFilter` from `useBranchContext()` (undefined when "All Branches" is selected and user is owner/admin).
- Role gating uses `hasAnyRole` from `AuthContext`:
  - `member` → palette only shows page shortcuts for member menu + their own invoices. No admin entities.
  - `trainer` → trainers (self), my-clients (members in their branch limited by RPC), classes/PT bookings.
  - `staff` → members, leads, invoices, payments, bookings, tasks within own branch.
  - `manager` → same as staff but across assigned branches; can switch via BranchSelector.
  - `owner`/`admin` → everything; respects current `selectedBranch`.
- Page shortcuts built from `getMenuForRole(roles)` (already exists in `src/config/menu.ts`) — no hardcoded arrays. Filter by `query.toLowerCase()` on label.
- Status badges reuse the existing badge classes (active/paid/overdue/hot/cold/overdue task) per Vuexy palette.
- Branch badge shows `branch_name` from RPC payload on every entity row.
- Loading: per-section shimmer skeleton (3 rows). Error: inline subtle text + retry. Empty + no query: shows Recent (top 8), then Actions, then Pages.

## 3. Result selection — open drawers, not dead links

Use a small registry keyed by entity type. Where a drawer already exists in-place, route to the page with a query param the page already consumes (or add minimal support):

| Entity | Action | Mechanism |
|---|---|---|
| Member | open profile drawer | navigate `/members?member=<id>` (already supported) |
| Invoice | open invoice drawer | navigate `/invoices?invoice=<id>` (already supported) |
| Lead | open lead profile drawer | extend `Leads.tsx` to read `?lead=<id>` and open `LeadProfileDrawer` |
| Payment | open invoice drawer | navigate `/invoices?invoice=<invoice_id>` |
| Booking | open booking detail | navigate `/all-bookings?booking=<id>` (add small effect to AllBookings to scroll/highlight row when no drawer exists) |
| Trainer | open trainer profile drawer | extend `Trainers.tsx` to read `?trainer=<id>` and open `TrainerProfileDrawer` |
| Task | open task detail drawer | extend `Tasks.tsx` to read `?task=<id>` and open `TaskDetailDrawer` |

For pages without a drawer, the row is scrolled into view and gets a 1.5 s `ring-2 ring-indigo-500` highlight via a tiny `useHighlightRow(id)` hook reading `?focus=<id>`.

## 4. Actions — grouped under "Actions"

A new `commandActions.ts` registry. Each entry: `{ id, label, icon, roles, run }`. `run` either:
- navigates with a query string the destination page interprets to auto-open the right drawer (e.g. `/members?new=1`), or
- triggers a global event via a tiny zustand store (`commandBus`) the relevant page subscribes to. We will use the navigate+query-param approach for simplicity and add the small `useEffect` consumers where missing.

Actions and their routes:
- Add Member → `/members?new=1`
- Create Lead → `/leads?new=1`
- Sell Membership → `/members?sell=1`
- Renew Membership → `/members?renew=1`
- Collect Payment → `/payments?new=1`
- Create Invoice → `/invoices?new=1`
- Check In Member → `/attendance-dashboard?checkin=1`
- Force Entry → `/attendance-dashboard?force=1`
- Book Facility → `/all-bookings?facility=1`
- Book Class → `/all-bookings?class=1`
- Sell Benefit Add-on → `/pos?addon=1`
- Sell PT Package → `/pt-sessions?new=1`
- Assign Locker → `/lockers?assign=1`
- Open WhatsApp Chat → `/whatsapp-chat`
- Create Task → `/tasks?new=1`
- Create Approval Request → `/approvals?new=1`

Each action has a `roles` array. Members see no admin actions; trainers see only Create Task and Open WhatsApp Chat. The pages already render their drawers under state — we add a tiny `useEffect` that flips the corresponding `setOpen(true)` when the query flag is present and removes it from the URL.

## 5. Recent commands

`useRecentCommands.ts` stores last 8 selected entries in `localStorage` under key `cmdk:recent:<user_id>`. Stored shape: `{ kind, id, label, sublabel, route, ts }`. Recent shows when query is empty.

## 6. Keyboard hints + UI polish

- Footer bar inside `CommandDialog`: `↵ Open · ⌘↵ Primary action · Esc Close` with kbd badges.
- Section headers use existing uppercase muted style.
- Result row: 8-square icon tile (per entity colour), title, sublabel, branch badge (slate), status badge (color-coded).
- Performance: per-RPC queries run in parallel via TanStack Query. `staleTime: 30s` to make repeat searches instant.

## 7. Cleanup

- Remove all `?highlight=` references in `GlobalSearch.tsx`.
- Delete old direct `from('members')`/`from('profiles')` queries from the palette.
- Keep `src/components/ui/command.tsx` untouched (shadcn primitive).

## 8. Acceptance check (manual)

- Owner switches branch via header → Cmd+K member results filter accordingly.
- Manager assigned to one branch cannot find a member from another branch.
- Staff cannot see leads from other branches.
- Trainer sees only their clients and their classes/PT.
- Member's Cmd+K shows only member-menu page shortcuts; no admin records.
- Selecting a member opens `MemberProfileDrawer` with the right member.
- Selecting a payment opens its invoice drawer.
- Selecting an action ("Add Member") opens the right drawer on landing.
- All operations succeed without page reload.

## Files to create

- `supabase/migrations/<ts>_command_center_search_rpcs.sql`
- `src/components/search/useCommandCenter.ts`
- `src/components/search/useCommandSearch.ts`
- `src/components/search/usePageShortcuts.ts`
- `src/components/search/useRecentCommands.ts`
- `src/components/search/commandActions.ts`
- `src/components/search/sections/*` (one per section above)
- `src/hooks/useHighlightRow.ts`

## Files to modify

- `src/components/search/GlobalSearch.tsx` — full rewrite as composition root.
- `src/pages/Leads.tsx` — read `?lead=<id>` and `?new=1`, open drawers.
- `src/pages/Trainers.tsx` — read `?trainer=<id>` and `?new=1`.
- `src/pages/Tasks.tsx` — read `?task=<id>` and `?new=1`.
- `src/pages/AllBookings.tsx` — read `?booking=<id>` (highlight row) and `?facility=1` / `?class=1` (open booking drawer).
- `src/pages/Payments.tsx` — read `?new=1` (open Record Payment).
- `src/pages/AttendanceDashboard.tsx` — read `?checkin=1` and `?force=1`.
- `src/pages/Lockers.tsx` — read `?assign=1`.
- `src/pages/POS.tsx` — read `?addon=1`.
- `src/pages/PTSessions.tsx` — read `?new=1`.
- `src/pages/Approvals.tsx` — read `?new=1`.
- `src/pages/Members.tsx` — already supports `?member=`; add `?new=1`, `?sell=1`, `?renew=1` (open existing drawers).
- `src/pages/Invoices.tsx` — already supports `?invoice=`; add `?new=1`.

No `?highlight=` consumers remain after this change.
