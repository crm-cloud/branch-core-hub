# Fitness Templates, Common Plans, AI Insights & Edge Logs — Plan

## Diagnosis (root causes)

1. **"Templates present, no View/Edit/Delete UI"** — confirmed via DB: `fitness_plan_templates` has **0 rows**. The page only shows the 3 hardcoded `DEFAULT_TEMPLATES` (Built-in cards) which intentionally only have "Assign". Edit/Delete/View buttons live in the "Your Saved Templates" block, which never renders. Built-ins are also non-editable because they only exist in the React file.
2. **No "Common Plan" concept** — there is no flag/category to mark a plan as "shared / no PT required". Trainers must individually re-assign the same plan to every walk-in member.
3. **AI Insights goes blank on refresh** — `AIInsightsWidget` caches in `localStorage` with a 24h window, but the cache key requires the same `branchId` on next mount. When a user lands on Dashboard before `branchId` resolves (or switches branch context), state initializes empty and never re-hydrates.
4. **System Health is missing live Edge errors** — `error_logs` only receives writes from `ErrorBoundary` (frontend) + a couple of edge functions that opportunistically insert. Most edge functions don't, and there is no central capture wrapper.
5. **No AI generation for trainer/staff/member** — current "Create AI" route is exposed broadly. Needs role gating.

## Scope of changes

### A. Fitness Templates page (`/fitness/templates`)

- **Seed real templates into the DB** so the "Saved Templates" block (with View/Edit/Delete/Download) renders for the 3 starter plans (Beginner Full Body, Weight Loss Circuit, Muscle Building Split) + 3 starter diet templates (Balanced 1800kcal, High-Protein 2400kcal, Vegetarian 1600kcal). Use a one-time migration with a stable `system_template = true` flag (new column) so they aren't duplicated.
- **Make built-ins actionable**: Add `View` (opens `PlanViewerSheet`) on every card — both system and user-created. Hide `Delete` only on `system_template = true` (keep View/Edit/Assign/Download).
- **Common Plan flag**: Add column `is_common boolean default false` to both `fitness_plan_templates` and `member_fitness_plans`. New "Common Plans" filter chip on the Templates page (All / Common / PT-only). When assigning, expose a "Mark as Common (no trainer needed)" toggle in `AssignPlanDrawer`.
- **Bulk Assign for Common Plans**: New "Assign to many" button on common templates → opens a sheet with member multi-select (filter by tag, plan type, walk-ins) → creates one `member_fitness_plans` row per member referencing the same `template_id`.
- **AI generation gating**: `/fitness/create/ai` becomes admin/manager-only. Trainer/Staff/Member roles see only Manual + Templates. Update `CreateModePicker` to hide AI tile based on `hasAnyRole(["owner","admin","manager"])`.

### B. Member Plans page (`/fitness/member-plans`)

- **Group by member with Workout/Diet tabs**: Replace the flat card grid with a member-grouped list. Each member becomes one expandable row containing a small `Tabs` (Workout · Diet). Inside each tab: the active assignment + history. Keeps KPI strip and search/filters.
- Card actions stay (View / Share / Revoke) but move into each tab so workout actions don't bleed into diet.

### C. AI Insights persistence

- New table `ai_dashboard_insights`:
  ```
  id uuid pk
  branch_id uuid null         -- null = "All branches"
  user_id uuid                -- generated for this user
  insights jsonb              -- array of {icon,title,description,severity}
  generated_at timestamptz
  expires_at timestamptz      -- generated_at + 24h
  ```
  RLS: user can read/insert/update own rows scoped to their branch access.
- Widget loads from this table on mount (latest non-expired row for current `user_id` + `branch_id`), falls back to localStorage, then to empty state. On `Generate`, writes/upserts the row. This guarantees data survives refresh and branch switches.

### D. System Health — live edge-function errors

- New edge function `log-edge-error` (HTTP POST, service role) that other edge functions call to insert into `error_logs` with `source = 'edge_function'`.
- Add a tiny shared helper `supabase/functions/_shared/captureEdgeError.ts` exporting `captureEdgeError(fnName, err, ctx?)` — wraps the existing try/catch pattern already standardised in our edge functions.
- Retrofit the high-traffic edge functions (`send-whatsapp`, `whatsapp-webhook`, `process-comm-retry-queue`, `record-payment`, `mips-*`, `ai-dashboard-insights`, `ai-fitness-plan`) to call `captureEdgeError` in their catch blocks.
- System Health page: enable Supabase realtime on `error_logs` and subscribe for live updates; add a small "Live" pulse dot when subscribed. Already filters by source = `edge_function`, so the existing UI just lights up.
- Add a one-click "Copy AI fix prompt" button next to each edge error (already exists for frontend errors — extend the prompt template to mention which edge function and link to its logs).

## Out of scope / deferred

- Dropping legacy `diet_templates` / `workout_templates` tables (per prior memo).
- Importing historical Supabase edge logs into `error_logs` — only new errors will flow.

## Technical details

**Migration**
```sql
ALTER TABLE public.fitness_plan_templates
  ADD COLUMN IF NOT EXISTS is_common boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_template boolean NOT NULL DEFAULT false;

ALTER TABLE public.member_fitness_plans
  ADD COLUMN IF NOT EXISTS is_common boolean NOT NULL DEFAULT false;

CREATE TABLE public.ai_dashboard_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
ALTER TABLE public.ai_dashboard_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read" ON public.ai_dashboard_insights FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "self write" ON public.ai_dashboard_insights FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "self update" ON public.ai_dashboard_insights FOR UPDATE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs;
```
Plus a `INSERT … ON CONFLICT DO NOTHING` seed for the 6 system templates.

**Files**
- Migration: `supabase/migrations/<ts>_common_plans_and_insights.sql`
- Edited: `src/pages/fitness/Templates.tsx`, `src/pages/fitness/MemberPlans.tsx`, `src/pages/fitness/CreateModePicker.tsx`, `src/components/fitness/AssignPlanDrawer.tsx`, `src/components/dashboard/AIInsightsWidget.tsx`, `src/pages/SystemHealth.tsx`, `src/services/fitnessService.ts`
- New: `src/components/fitness/BulkAssignCommonDrawer.tsx`, `supabase/functions/_shared/captureEdgeError.ts`, `supabase/functions/log-edge-error/index.ts`
- Touched edge functions: ~8 to wire `captureEdgeError`.

After approval I'll implement in this order: migration → templates UI fixes → common plan flow → member plans tabbed view → AI insights persistence → edge-error capture + realtime.
