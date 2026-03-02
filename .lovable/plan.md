

# Comprehensive Fix Plan: Real-time Refresh, System Health, Plans, Trainers, AI Fitness, Lockers, Public Website, Communication Hub, WhatsApp Chat

## Issues & Root Causes

### 1. Staff Creation Requires Hard Refresh
`AddEmployeeDrawer` invalidates `['employees']` but `Employees.tsx` queries with `['all-staff']`. The query keys don't match, so the list never refreshes after creation.
**Fix:** Add `queryClient.invalidateQueries({ queryKey: ['all-staff'] })` to `AddEmployeeDrawer` onSuccess. Audit all other drawers/mutation flows for similar mismatches.

### 2. System Health Not Recording Errors
The `ErrorBoundary` only captures React render crashes (rare). Console errors, network failures, backend function errors, and database constraint violations are NOT captured. The system needs:
- A global `window.onerror` and `window.onunhandledrejection` listener to catch ALL frontend JS errors
- Edge functions need try/catch blocks that log to `error_logs`
- A client-side helper service that wraps console.error to also write to `error_logs`

**Fix:** Create a `src/services/errorLogService.ts` that installs global error handlers. Add it to `main.tsx`. Update edge functions to log errors. Add `source` field properly.

### 3. Plans Page - Member Count Not Clickable
The plan cards show member counts (e.g., "1 member") but clicking doesn't show a member list.
**Fix:** Add a Sheet/Drawer that opens when clicking the member count badge, showing the list of active members on that plan (query `memberships` joined with `members` and `profiles`).

### 4. Trainers Not Showing for All Branches
The `useTrainers` hook has `enabled: !!branchId` — when `branchId` is empty string (All Branches), `!!''` is `false`, so the query is disabled entirely.
**Fix:** Change `enabled` to `enabled: branchId !== undefined` or simply `enabled: true` since the service already handles empty string correctly.

### 5. AI Fitness Planner Redesign
Current page is complex and lacks: default plans, random assignment option, clean plan display.
**Fix:** Redesign with clearer tabs: "Generate AI Plan", "Templates Library", "Assign to Member". Add a "Quick Shuffle" button for random daily workout generation. Clean up the plan output display.

### 6. Locker Release Without Approval
Currently `releaseLocker` is directly callable without approval. For plans that include lockers, accidental release should be prevented.
**Fix:** Add a confirmation dialog with a reason field. Log the release action in `audit_logs`. For plans with locker benefit, show a warning that releasing will remove the locker benefit.

### 7. Public Website Not Synced with CMS
The website loads CMS theme but uses hardcoded trainers, classes, FAQs, stats. These should come from the CMS `ThemeSettings` or the database.
**Fix:** Update `PublicWebsite.tsx` to use CMS theme data for hero text, colors, contact info. Pull real trainers from DB. Pull real plans for pricing section.

### 8. Communication Hub Redesign
Current Announcements page is basic. Needs unified communication dashboard with realtime logs.
**Fix:** Redesign `Announcements.tsx` as a full Communication Hub with tabs: Announcements, Broadcast, Logs (realtime), Templates. Add realtime subscription on `communication_logs`.

### 9. WhatsApp Chat Redesign
Current chat UI is functional but dated.
**Fix:** Redesign with modern chat bubble styling, contact sidebar with avatar/status, message status indicators, better mobile responsiveness. Keep existing realtime subscription.

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/employees/AddEmployeeDrawer.tsx` | Add `['all-staff']` to invalidation list |
| `src/hooks/useTrainers.ts` | Fix `enabled` condition for empty branchId |
| `src/services/errorLogService.ts` | **NEW** - Global error capture service (window.onerror, unhandledrejection, console.error wrapper) |
| `src/main.tsx` | Initialize error log service |
| `src/components/common/ErrorBoundary.tsx` | Add `source: 'frontend'` to error log inserts |
| `src/pages/SystemHealth.tsx` | Add "Test Error Capture" button, improve empty state |
| `src/pages/Plans.tsx` | Add clickable member count → opens member list drawer |
| `src/pages/Trainers.tsx` | Fix by updating useTrainers enabled condition |
| `src/pages/AIFitness.tsx` | Redesign with cleaner layout, quick shuffle, better plan display |
| `src/pages/Lockers.tsx` | Add confirmation dialog with reason for release, audit log warning |
| `src/pages/PublicWebsite.tsx` | Sync hero/pricing/trainers with CMS and DB data |
| `src/pages/Announcements.tsx` | Redesign as Communication Hub with realtime logs |
| `src/pages/WhatsAppChat.tsx` | Redesign with modern 2026 chat UI |

## Execution Order
1. Fix query key mismatches (staff, trainers) — critical bugs
2. Create error log service + install global handlers
3. Plans member list drawer
4. AI Fitness page redesign
5. Locker release workflow improvement
6. Public website CMS sync
7. Communication Hub redesign
8. WhatsApp Chat redesign

