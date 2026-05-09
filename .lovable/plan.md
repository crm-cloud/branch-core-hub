
## Goal

Enhance the Dashboard with new fitness-focused growth widgets inspired by the uploaded references:
1. A row of **delta KPI cards** ("Current Members", "New Members", "Today's Visitors") showing absolute value + period-over-period change with up/down arrows.
2. A **"Members Counting" interactive bar chart** with a period switcher (Weekly / Monthly / Yearly) and a hover tooltip styled like the reference (dark pill with colored dot).
3. Compact joined-summary chips: **Joined this Week / 7 days / This Month / This Year**.

All additions are pure presentation widgets that read existing tables (`members`, `member_attendance`) — no schema changes, no edits to existing widgets, queries, or business logic. Existing Hero card, secondary KPIs, charts, CRM widgets, and below-fold lazy sections remain untouched.

## What gets built

### 1. New component: `src/components/dashboard/MemberGrowthCards.tsx`
Three KPI cards in a `grid grid-cols-1 sm:grid-cols-3 gap-4` row, matching the dark/Vuexy tile in image-402 but using semantic tokens so they adapt to light/dark theme:
- **Current Members** — `count(members) where status='active'` for branchFilter; delta vs 30 days ago.
- **New Members This Month** — `count(members) where created_at >= startOfMonth`; delta vs previous month with % change.
- **Today's Visitors** — `count(member_attendance) where check_in >= today`; delta vs same day last week.

Each card: large `text-4xl font-bold` value, small green/red delta line with `ArrowUp`/`ArrowDown` lucide icon and `(±x.xx%)`, top-right circular icon badge (`Users`, `UserPlus`, `Eye`). Uses `rounded-2xl shadow-lg` per project standards.

### 2. New component: `src/components/dashboard/MembersCountingChart.tsx`
Recharts `BarChart` with:
- Period switcher pill (Weekly / Monthly / Yearly) using shadcn `ToggleGroup`.
- Bars rendered as rounded pills (`radius={[12,12,12,12]}`, narrow `barSize={28}`); inactive bars use `hsl(var(--muted))`, the hovered/active bar uses `hsl(var(--primary))`.
- Custom dark tooltip (rounded card, small colored dot + period label + "N members") matching image-401.
- Dashed horizontal grid lines, no axis lines, muted tick labels.
- Data source: aggregates `members.created_at` (joined per period) for the selected branch — Weekly = last 7 days by day, Monthly = last 7 months by month, Yearly = last 6 years by year.

### 3. New component: `src/components/dashboard/JoinedSummaryStrip.tsx`
A 4-chip strip under the chart (Today / 7 days / This Month / This Year) using small rounded badges with icon + count. Driven by a single TanStack query that runs four parallel `count` queries.

### 4. Wire-up in `src/pages/Dashboard.tsx`
Insert the new section **between the Hero gradient card and the existing Secondary Stats Row**:

```text
[Hero Gradient Card]            ← unchanged
[MemberGrowthCards]             ← NEW (3 KPI tiles with deltas)
[Secondary Stats Row]            ← unchanged
[Charts Row: Revenue | Attendance]   ← unchanged
[MembersCountingChart + JoinedSummaryStrip]   ← NEW (full-width card)
[CRM Widgets Row]                ← unchanged, still lazy
[Bottom Row]                     ← unchanged
[AI Insights Row]                ← unchanged
```

Lazy-load `MembersCountingChart` via `React.lazy` so Recharts doesn't grow first paint. KPI cards stay eager (small + above fold).

## Technical Notes

- **Queries**: separate `useQuery` per widget, keys `['member-growth-kpis', branchFilter]` and `['members-counting', branchFilter, period]`. All filter by `branchFilter` exactly like existing widgets.
- **Delta math**: done client-side from two `count: 'exact', head: true` calls per metric; no RPCs needed.
- **Theming**: every color via semantic tokens (`text-emerald-600` for positive delta, `text-destructive` for negative, `bg-card`, `bg-primary`, `text-muted-foreground`). No hardcoded hex.
- **Skeletons**: each new widget ships its own skeleton matching its layout.
- **Accessibility**: ARIA labels on the period toggle, focus rings, ≥44px tap targets.
- **No edits** to: existing StatCard rows, RevenueChart, AttendanceChart, OccupancyGauge, AccountsReceivableWidget, ExpiringMembersWidget, LiveAccessLog, AI Insights, MemberVoiceWidget, hero card, or the dashboard-stats query.

## Files

- `src/components/dashboard/MemberGrowthCards.tsx` (new)
- `src/components/dashboard/MembersCountingChart.tsx` (new)
- `src/components/dashboard/JoinedSummaryStrip.tsx` (new)
- `src/pages/Dashboard.tsx` (additive edits only — 2 new sections inserted)

## Out of scope

- No changes to RBAC, no new tables, no migrations, no edge functions.
- No redesign of existing widgets — purely additive.
