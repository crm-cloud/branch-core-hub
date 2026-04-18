

# Plan: "Diet & Workout Plans" Rebrand + POS/Payment/Messenger Fixes

## Package 1 — Rebrand AI Fitness → Diet & Workout Plans
**Files:** `src/pages/AIFitness.tsx`, `src/config/menu.ts`, `src/components/layout/AppSidebar.tsx`, any string ref to "AI Fitness"

- Rename all user-facing labels: page header, sidebar menu item, breadcrumbs, empty states, button copy, toasts, dialog titles → **"Diet & Workout Plans"**.
- Keep `/ai-fitness` route working. Add `/diet-workout-plans` as the canonical route; old route renders the same component (backward compat).
- Update `menu.ts` label + icon stays.

## Package 2 — Page Redesign (UX restructure)
**Files:** `src/pages/AIFitness.tsx` + new components in `src/components/fitness/`

New structure (top-to-bottom):
1. **Header**: title + subtitle + "Create New Plan" primary button (dropdown: Generate with AI / Build Manually).
2. **Top-level segmented switch**: `Workout Plans | Diet Plans` (single source of truth — drives content for all sections below).
3. **Tabs underneath the switch**: `Templates | Member Plans | Generate | Assign`.
   - **Templates**: grid of global templates with filter chips (goal, level, days/wk).
   - **Member Plans**: data table (member, plan, assigned date, status, actions). Filters: Active/Expired, Trainer.
   - **Generate**: cleaner form — explicit toggle "Global Template vs Personalized for Member" with member autocomplete only when Personalized; plan-type-specific input groups (workout: goal/level/days/equipment; diet: calories/diet style/restrictions).
   - **Assign**: lightweight flow to push existing template → member.
4. Output panel: structured editable preview with action bar (Save / Save as Template / Assign / Download PDF / WhatsApp / Email).
5. Stronger empty states (icon + headline + CTA), responsive grid (1/2/3 cols), Vuexy `rounded-2xl` cards with soft shadow.

## Package 3 — Loader Strategy (de-block the dumbbell)
**Files:** `src/App.tsx`, `src/components/auth/ProtectedRoute.tsx`, page-level layouts, `src/components/ui/page-skeleton.tsx` (new)

- **Keep** `GymLoader` only for: initial app bootstrap (before auth context resolves) and explicit "cold start" empty fallback.
- Replace lazy-route `Suspense` fallback with `null` (already partial) + per-page skeleton inside each route.
- `ProtectedRoute`: render the protected layout immediately; show a small inline spinner in the top bar while role check runs (no full-screen takeover).
- Add `<PageSkeleton variant="table|grid|form" />` reusable skeleton (sidebar layout already mounted, content area shows shimmer).
- Tab switches: render tab shell instantly, skeleton inside content area while query loads.

## Package 4 — POS Guest Identity Snapshot
**Migration + Files:** `pos_sales` schema, `src/pages/POS.tsx`, `src/services/storeService.ts`, `src/pages/Store.tsx`, `src/components/billing/InvoiceViewDrawer.tsx`

- Migration: add `pos_sales.customer_name TEXT NULL`, `customer_phone TEXT NULL`, `customer_email TEXT NULL`. Backfill not needed (NULL for legacy rows).
- `createPOSSale`: persist guest fields when no member; persist denormalized member name/phone/email snapshot when member is selected (so historical record is stable even if member is later edited).
- POS history / Invoice view / Store history: display order = `customer_name (snapshot) → member.profile.full_name → "Walk-in"`. Same rule for phone/email.

## Package 5 — POS Payment Lifecycle (real link flow)
**Migration + Files:** `src/pages/POS.tsx`, `src/services/storeService.ts`, `supabase/functions/create-razorpay-link/index.ts`, `supabase/functions/razorpay-webhook/index.ts`

- POS payment method selector now includes **"Send Payment Link"** alongside Cash / Card / UPI.
- When "Send Payment Link" is chosen:
  - `createPOSSale` creates `pos_sales` row with `payment_status='awaiting_payment'`.
  - Creates invoice with `status='pending'`, `amount_paid=0`. **Does NOT** insert a `payments` row.
  - Calls `create-razorpay-link` → gets short URL → delivers via WhatsApp (`send-message`) and/or email (`send-email`) to customer.
  - Returns the link to the cashier UI for copy/share fallback.
- `razorpay-webhook`: on `payment.captured`, call existing `record_payment` RPC → it updates invoice + inserts `payments` row + activates linked things atomically.
- Migration: add `pos_sales.payment_status TEXT DEFAULT 'paid'` (legacy stays 'paid'; new awaiting-link sales = 'awaiting_payment').
- Cash/Card/UPI flows unchanged — still mark paid immediately.

## Package 6 — Messenger: Hide Until Real
**Files:** `src/pages/Integrations.tsx`, `src/components/integrations/IntegrationSettings.tsx`, `supabase/functions/test-integration/index.ts`, `src/utils/communication.ts`

- Remove/hide all Messenger entry points (provider list, test buttons, channel selectors).
- `test-integration`: explicit reject with "Messenger not yet supported" if somehow invoked.
- Keep `meta-webhook` & `send-message` Messenger code paths intact (don't delete) so re-enabling later is one UI flag flip.
- Add a "Coming Soon" disabled card in Integrations page so users see roadmap intent.

## Files Summary
| File | Change |
|---|---|
| `src/pages/AIFitness.tsx` | Full redesign + rename |
| `src/config/menu.ts` | Rename label, add `/diet-workout-plans` |
| `src/App.tsx` | Add new route alias; lighter Suspense |
| `src/components/auth/ProtectedRoute.tsx` | Non-blocking auth check |
| `src/components/ui/page-skeleton.tsx` | **New** — reusable inline skeletons |
| `src/components/fitness/PlanTypeSwitch.tsx` + `MemberPlansTable.tsx` + `TemplateGrid.tsx` + `GenerateForm.tsx` | **New** — modular sub-components |
| Migration | `pos_sales`: customer_name/phone/email + payment_status |
| `src/pages/POS.tsx` | Send Payment Link option; guest fields wired |
| `src/services/storeService.ts` | Guest snapshot persistence; conditional invoice/payment creation |
| `supabase/functions/razorpay-webhook/index.ts` | Verify + call `record_payment` RPC |
| `src/pages/Store.tsx` + `InvoiceViewDrawer.tsx` | Display snapshot identity |
| `src/pages/Integrations.tsx` + `IntegrationSettings.tsx` | Remove Messenger from active UI |
| `supabase/functions/test-integration/index.ts` | Explicit reject for messenger |

## Acceptance Checklist
1. Sidebar shows "Diet & Workout Plans"; both `/ai-fitness` and `/diet-workout-plans` work.
2. No full-screen dumbbell on tab switches or normal navigations.
3. POS guest sale shows "John (guest phone)" in history, not "Walk-in".
4. POS "Send Payment Link" sale → invoice `pending`, no payment row, link delivered. After webhook → invoice `paid`, payment row inserted.
5. Messenger nowhere visible/configurable in Integrations.

## What I'm NOT Building
- Full Messenger backend implementation (hiding instead, per "either/or").
- Drag-and-drop manual plan builder (out of scope of this rename pass; existing form stays).
- Auth email branding.

