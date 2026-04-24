
## Plan — 9-item cleanup pass

Note: items 1 and 7 in your message are duplicates ("Auto-purge webhook logs older than 90 days"). Treating as one workstream → 8 distinct changes.

---

### 1) Refresh members list after freeze / gift / redeem
**Problem:** `QuickFreezeDrawer.onSuccess` only invalidates `['members']`. `RedeemPointsDrawer` invalidates `['rewards-ledger']` + `['member-details']` but not the members list. `CompGiftDrawer` doesn't trigger a members refresh either.

**Fix:**
- `src/components/members/QuickFreezeDrawer.tsx` — call `invalidateMembersData(queryClient)` (the unified helper that also refreshes membership distribution / dashboard stats) inside `handleFreeze` after success.
- `src/components/members/RedeemPointsDrawer.tsx` — add `invalidateMembersData(queryClient)` to the `onSuccess` so the points column refreshes immediately on the members list.
- `src/components/members/CompGiftDrawer.tsx` — add the same helper after both the auto-approve and approval-request branches succeed.
- `src/pages/Members.tsx` — keep the existing `onSuccess` but also let it call `invalidateMembersData` (single source of truth).

### 2) Member-side diet/workout from unified plan source
**Problem:** `MyDiet.tsx` reads from the legacy `diet_plans` table (currently empty — 0 rows) while trainers now save into `member_fitness_plans` (`plan_type='diet'`). Members never see diet plans built in the new flow. `MyWorkout.tsx` already reads `member_fitness_plans` correctly.

**Fix:**
- Rewrite the `useQuery` in `src/pages/MyDiet.tsx` to query `member_fitness_plans` filtered by `plan_type='diet'` and the active `member_id`, ordered by `created_at desc`, taking the latest active row.
- Map the unified `plan_data` shape (`{ slots: [...], dailyCalories, macros, dietaryType, cuisine, notes }`) to the existing `MealEntry[]` UI; keep a small adapter so older `plan_data.meals[]` payloads still render.
- Resolve trainer name from `created_by → profiles.full_name` (mirror `MyWorkout`'s pattern), drop the `trainer:trainers!trainer_id` join.
- Keep the legacy `diet_plans` fetch as a silent fallback for one release in case any clinic still has rows there.

### 3) Highlight catalog meals vs custom AI suggestions
**Problem:** The AI generator already receives the gym's meal catalog as preferred foods, but the rendered plan never tells the trainer or member which items came from the catalog vs free-form AI suggestions.

**Fix:**
- Server side (`supabase/functions/generate-fitness-plan/index.ts`): when injecting `catalogMeals` into the AI prompt, also pass each meal's `id` and instruct the model to set `catalog_meal_id` on items it picks from the catalog. Validate after the response and force-match by exact name as a safety net.
- Type: extend `DietPlanContent` slot item shape with optional `catalog_meal_id?: string` and `source?: 'catalog' | 'ai' | 'manual'`.
- UI: in `MyDiet.tsx`, `PreviewPlan.tsx`, and `CreateManualDiet.tsx`, render a small "Gym Catalog" badge (success tone) next to items where `catalog_meal_id` is present, and a muted "AI" badge for the rest. Tooltip clarifies the difference.
- `MealSwapModal` already writes `catalog_meal_id` on swap; reuse that field as the source of truth.

### 4) Show source template on each member's plan
**Problem:** `member_fitness_plans.template_id` is now populated on bulk-assign, but the member-side and trainer-side views never display "Created from template: X".

**Fix:**
- Resolve the template name on read: in `MyDiet.tsx` and `MyWorkout.tsx`, when `plan.template_id` is non-null, fetch `fitness_plan_templates(id, name)` (single lookup, cached) and render a small "From template: NAME" chip in the plan meta strip.
- In `src/pages/MemberPlans.tsx` (trainer-side view of a member's assigned plans), add the same chip in each plan card.
- No DB change needed — column already exists.

### 5) Webhook log auto-purge (>90 days)
**Problem:** `payment_transactions` is the unified webhook delivery log (currently 1 row, but will grow unbounded). The activity panel will slow down as gateways send hundreds of events per day.

**Fix:**
- Migration: create a `purge_old_payment_webhook_logs()` SECURITY DEFINER SQL function that deletes `payment_transactions` rows where `source='webhook'` AND `received_at < now() - interval '90 days'`. Critically **never deletes `source='order'` rows** (those are the canonical order/link records the webhook handler needs to match against).
- Schedule via `pg_cron` daily at 03:30 IST using the **insert tool** (not migration tool — per project rules cron jobs use anon-key-bearing pg_net calls and shouldn't run on remix). Alternative: a pure SQL `cron.schedule(...)` call against the local SECURITY DEFINER function (no pg_net needed since it runs in-DB).
- Add an index on `(source, received_at)` to keep both the panel queries and the purge fast.

### 6) Tighten payment-webhook idempotency
**Problem:** Today the webhook re-runs `record_payment` whenever a duplicate `payment_link.paid` / PayU `success` event arrives. `record_payment` itself is idempotent on transaction_id, but we still pay the cost of the RPC call, the MIPS sync POST, and we log a duplicate `payment_transactions` insert. Worse, manual reconcile in `WebhookActivityPanel` doesn't check whether the invoice is already paid before calling the RPC.

**Fix:**
- In `supabase/functions/payment-webhook/index.ts`, before calling `record_payment` for `payment_link.paid` (Razorpay) and `success` (PayU), check whether a `payments` row with the same `transaction_id` already exists for the branch — if so, short-circuit to `{status: 'already_processed'}` 200, still persist the webhook log row for visibility, but skip the RPC and the MIPS sync.
- Compute and write `idempotency_key` on every `payment_transactions` webhook row (e.g. `${gateway}:${gatewayPaymentId || gatewayOrderId}:${eventType}`). The unique index already exists; switch the insert to `.upsert(..., { onConflict: 'idempotency_key', ignoreDuplicates: true })` so a redelivered webhook produces zero log noise.
- `WebhookActivityPanel` reconcile button: re-fetch invoice status before calling `record_payment`; if already `paid`, show "Already reconciled" toast instead.

### 7) Builder banner: "Started from template: NAME"
**Problem:** `?template=ID` silently hydrates `CreateAI`, `CreateManualWorkout`, `CreateManualDiet` and only flashes a toast. Trainers forget they're editing a copy of a template.

**Fix:**
- New small component `src/components/fitness/create/TemplateSourceBanner.tsx` — a soft amber rounded-xl card showing "Started from template: **{name}**" with a "Start fresh" link that calls a parent-supplied `onClear` to reset state, navigates to the same route without the `?template=` param via `setSearchParams({})`, and toasts "Cleared template — starting fresh".
- In each builder, store the loaded template's name in state (`sourceTemplateName`) when the existing `useEffect` finishes loading, then render `<TemplateSourceBanner name={sourceTemplateName} onClear={...} />` at the top of the form.
- For the in-place edit mode (`?template=ID&edit=1`) use a different copy: "Editing template: **{name}**" — and hide the "Start fresh" link (since edits would be saved back to the template).

### 8) (Optional, ties items 4 + 7 together) Trainer "draft loaded" indicator
The banner from item 7 already covers this — when a draft is hydrated from `?template=`, the persistent banner makes the source obvious. No separate change needed beyond item 7. If you want a distinct treatment for **drafts loaded from `localStorage` (planDraft.ts)** as opposed to **templates loaded via URL**, say so and I'll add a second banner variant.

---

### Files touched
- `src/components/members/QuickFreezeDrawer.tsx`, `RedeemPointsDrawer.tsx`, `CompGiftDrawer.tsx`
- `src/pages/MyDiet.tsx`, `MyWorkout.tsx`, `MemberPlans.tsx`
- `src/pages/fitness/CreateAI.tsx`, `CreateManualWorkout.tsx`, `CreateManualDiet.tsx`, `PreviewPlan.tsx`
- `src/components/fitness/create/TemplateSourceBanner.tsx` (new)
- `src/components/integrations/WebhookActivityPanel.tsx`
- `src/types/fitnessPlan.ts` (add `catalog_meal_id`, `source`)
- `supabase/functions/generate-fitness-plan/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- New migration: purge function + `(source, received_at)` index
- Cron job inserted via insert tool

### What I will NOT change
- Won't touch `src/integrations/supabase/client.ts` or `types.ts` (auto-generated)
- Won't deprecate the `diet_plans` table yet — only stop reading from it on the member side; legacy writes still possible until you confirm cutover

### Open question
**Cron scheduling:** Should the daily purge run as a pure in-DB `cron.schedule` (simpler, no anon key) or via `pg_net` posting to an edge function (matches the rest of your scheduled tasks)? The in-DB approach is what I'd recommend for a pure DELETE — happy to default to it unless you say otherwise.
