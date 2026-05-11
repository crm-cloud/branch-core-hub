## Goals

1. Show **who is online right now** (live presence) on the Audit Logs page (and reuse elsewhere).
2. **Remove the "Page 1/3" stat card** — it's just pagination, not a metric.
3. Refresh the Audit Logs page to a **2026-grade UI/UX** that makes "who did what, when, where" instantly scannable across the whole app.

No business-logic changes. Audit triggers and `audit_logs` schema stay as-is (already cover 25+ tables with `actor_name` + `target_name`).

---

## Part A — Live Online Presence

### Backend
- Add `last_seen_at timestamptz` to `public.profiles` (nullable, indexed).
- New RPC `touch_presence()` — `SECURITY DEFINER`, sets `profiles.last_seen_at = now()` for `auth.uid()`. RLS-safe.
- New view `online_users_v` returning `user_id, full_name, role, last_seen_at` for users active in the last 5 minutes.
- RLS: only authenticated staff (owner/admin/manager/staff) can read the view.

### Frontend
- New global hook `usePresenceHeartbeat()` mounted once in `AppLayout`:
  - Joins a Supabase Realtime presence channel `presence:app` with `{ user_id, full_name, role }`.
  - Calls `touch_presence()` every 60s and on `visibilitychange`.
  - Leaves channel on unmount / sign-out.
- New hook `useOnlineUsers()` — subscribes to the same channel, returns deduped `{ id, name, role }[]`.
- New component `OnlinePresencePill` — green pulsing dot + count + hover popover listing avatars/names/roles. Drop-in for sidebar header and audit page.

### Audit page integration
- Add `OnlinePresencePill` to the page header next to "Audit Logs".
- Replace the removed "Page" KPI with a new **"Online Now"** stat card (live count from `useOnlineUsers`).

---

## Part B — Remove the Page card

- Drop the 4th `StatCard` ("Page 1 / 3") from `AuditLogs.tsx`.
- Move pagination context ("Page X of Y") into the timeline card footer where it belongs.

---

## Part C — 2026 Audit Logs UI/UX

### Layout overhaul
```
┌─────────────────────────────────────────────────────────────┐
│  Audit Logs            🟢 4 online   [Refresh] [Export]     │
├─────────────────────────────────────────────────────────────┤
│  [Total 252] [Today 12] [Most Active: Members] [Online: 4]  │
├─────────────────────────────────────────────────────────────┤
│  Quick chips: [Today][24h][7d][30d][90d]  [All me] [Errors] │
│  Search ▢   Category ▢  Actor ▢  Action ▢  Table ▢          │
├─────────────────────────────────────────────────────────────┤
│  TIMELINE (sticky date headers)                             │
│   • 2:16 PM  🟢 Rajat Lekhari (Owner)                       │
│              Updated trainer — Ritesh Sharma                 │
│              Members · trainers · 3 fields changed           │
│              [Open record →]   [▼ View diff]                 │
└─────────────────────────────────────────────────────────────┘
```

### Concrete changes
1. **Actor identity row (top of every entry)**
   - Avatar circle with initials (color hashed from user_id).
   - `Full Name` · role badge (Owner/Admin/Manager/Staff/Trainer/System).
   - Live green dot if actor is currently in `useOnlineUsers()`.
2. **Primary line**: action verb + resolved `target_name` ("Created invoice — INV-2026-0042").
3. **Meta line**: `Category` · `table` · `N fields changed` · branch (when present) · relative time ("2 min ago"), absolute time on hover.
4. **Right-side actions**: `Open record →` (deep link from `auditMeta`), copy ID, expand diff.
5. **Diff view**: keep current red→green chips but collapse unchanged system fields (id, created_at, updated_at) by default with "Show all" toggle.
6. **Sticky date headers** that stay visible while scrolling that group.
7. **"My activity" toggle chip** that filters `actor = current user`.
8. **Severity colors**: DELETE entries get a subtle left-border accent in destructive color so they stand out.
9. **Empty / loading / error** states all redesigned with proper illustrations (lucide icon + helper copy + reset-filters CTA).
10. **Density toggle** (Comfortable / Compact) persisted in localStorage.
11. **Realtime tail**: subscribe to `audit_logs` INSERT and prepend new entries with a soft highlight pulse — no manual refresh needed.
12. **Keyboard**: `/` focuses search, `r` refresh, `e` export, `j/k` navigate entries, `Enter` expands.

### Files
- New: `supabase/migrations/<ts>_presence.sql` (column, RPC, view, RLS).
- New: `src/hooks/usePresence.ts` (heartbeat + online list).
- New: `src/components/presence/OnlinePresencePill.tsx`.
- New: `src/components/audit/AuditTimelineEntry.tsx` (extracted, redesigned).
- Edit: `src/components/layout/AppLayout.tsx` (mount heartbeat + pill in header).
- Edit: `src/pages/AuditLogs.tsx` (remove Page card, add Online card + pill, wire realtime tail, new layout, density toggle, hotkeys).
- Edit: `src/lib/audit/auditMeta.ts` (small helpers: relative time formatter, system-field list).

---

## Out of scope
- Backfilling historical `actor_name` (already addressed previously).
- Per-page analytics ("which screens users are on"). True page-presence would need route broadcasting — happy to add as a follow-up if you want it.
- Mobile-specific redesign beyond responsive breakpoints already in use.

## Open question
Do you want the "online" indicator to show **just a count** (privacy-friendly) or **names + avatars in a popover** (more useful for ops)? Default in this plan = **count + popover with names/roles** visible to Owner/Admin/Manager only; Staff sees count only.
