## Goals

1. **Logo missing in "Header + Horizontal" mode** — `AppHeader` (standalone variant) doesn't render a brand/logo at all; only `GlobalSearch` sits on the left. Add a logo block on the left of the header.
2. **Horizontal menu not centered** — `TopModulesBar` left-aligns inside a full-width band. Center the nav items so it looks balanced and stays responsive.
3. **Dashboard widgets blank on refresh** — Recharts `ResponsiveContainer` measures parent height on first paint; in the new stacked layout the initial layout pass yields 0 height for the lower charts (Membership Distribution, Live Access Feed, Revenue, Attendance) until a resize fires.

## Changes

### 1. `src/components/layout/AppHeader.tsx` — add logo on the left
- Fetch `organization_settings` (logo_url, name) via `useQuery` (same pattern as `AppLayout`).
- Prepend a brand block before the search area:
  - If `logo_url` → `<img className="max-h-8 object-contain" />`
  - Else → text "Incline" / org name in `text-lg font-bold`.
- Keep `variant="hybrid"` unchanged (logo already drawn by `AppLayout` band in compact hybrid mode) — only render the brand block when `variant === 'standalone'`.
- Adjust container so layout becomes: `[Brand] [Search] ... [Right actions]` using `flex items-center gap-4`.

### 2. `src/components/layout/AppLayout.tsx` — center the horizontal menu in `horizontal-stacked`
- Wrap `TopModulesBar` in a centered container:
  ```tsx
  <div className="hidden lg:block sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
    <div className="mx-auto max-w-7xl flex justify-center">
      <TopModulesBar groups={...} bare />
    </div>
  </div>
  ```
- Pass `bare` so `TopModulesBar` doesn't double-draw border/background.
- `TopModulesBar` nav already uses `flex items-center gap-1`; with the centered wrapper the buttons collapse to natural width and sit centered. On narrow desktops the inner `ScrollArea` keeps it scrollable.

### 3. `src/components/layout/TopModulesBar.tsx` — small responsive tweak
- Change `nav` to `flex items-center justify-center gap-1` when `bare` so items center within whatever width the parent gives. (Current `gap-1` left-aligned remains fine for the compact `hybrid` band, so apply `justify-center` only in `bare` + center case — simplest: always allow `justify-center` since ScrollArea handles overflow.)

### 4. Fix dashboard charts not rendering on refresh
Root cause: `ResponsiveContainer` reads parent height on mount; in stacked layout the first measurement returns 0 because the chart container is inside `overflow-auto` `<main>` whose initial scroll-height isn't settled when Recharts measures.

Fix in `src/components/dashboard/DashboardCharts.tsx` (and any other chart card with the same issue):
- Replace the wrapper `<div className="h-[300px]">` with an explicit fixed-height div AND give `ResponsiveContainer` `minHeight={300}` plus `debounce={50}` so it re-measures after layout settles. Example:
  ```tsx
  <div className="h-[300px] w-full">
    <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={50}>
      ...
    </ResponsiveContainer>
  </div>
  ```
- Apply to: `RevenueChart`, `AttendanceChart`, `MembershipDistribution` pie chart, and any other ResponsiveContainer in the file.
- For the Live Access Feed (which is a list, not Recharts), check `src/components/devices/LiveAccessLog.tsx` for a `loading` state that may be silently empty on first render — ensure it shows skeleton until data resolves rather than a blank box.

## Out of scope
- No changes to nav modes/preferences storage.
- No changes to mobile header.
- No RBAC, data, or RLS changes.

## Verification
- Switch to "Header + Horizontal": logo visible on left of header; module bar centered; resize from 1024 → 1440 stays centered; narrow widths scroll horizontally.
- Hard refresh `/` (Dashboard): all four chart/widget cards render content immediately, no empty grey boxes.
- Other modes (vertical / collapsed / hybrid) unchanged visually.
