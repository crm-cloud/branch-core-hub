
## Goal

Tie HOWBODY scans into the existing plan/benefit/add-on system so admins can:
1. Allow scans on a plan, set a monthly cap, and sell extra scans as add-on packs.
2. Auto-mirror every body scan into `member_measurements` so the existing Progress tab "just works".
3. Let members view & download their HOWBODY reports from `/my-progress`.

Builds on what already exists (`howbody_body_reports`, `howbody_posture_reports`, `member_measurements`, `benefit_packages`, `membership_plans.body_scan_allowed/posture_scan_allowed/scans_per_month`).

---

## 1. Plans ↔ Scans (Admin UI)

**Plans → Edit Plan drawer** (`src/components/plans/EditPlanDrawer.tsx` + AddPlanDrawer):
- Add a "Body Scanner Access" section with:
  - Toggle: Body Composition Scan allowed
  - Toggle: Posture Scan allowed
  - Number: Scans per month (0 = unlimited when either toggle on; blank = none)
- Persist directly to `membership_plans.body_scan_allowed / posture_scan_allowed / scans_per_month` (columns already exist).
- Show a small "Body Scan" badge on each plan card in `Plans.tsx` when enabled.

**Plans → Add-On Packages tab** (`BenefitPackagesPanel` + `AddBenefitPackageDrawer`):
- Seed two new `benefit_types` rows per branch on first use: `body_scan` and `posture_scan` (category: `wellness`, `is_bookable=false`).
- The existing add-on drawer already supports any benefit_type, so admins can create e.g. "5 Extra Body Scans – ₹999 / 60 days".
- These are sold through the existing `MemberStore` "Buy Add-Ons" flow — no new checkout needed.

---

## 2. Scan Quota Engine (single source of truth)

New SQL function `public.howbody_scan_quota(_member_id uuid, _kind text)` returns:
```
{ allowed: boolean, used_this_month: int, plan_limit: int, addon_remaining: int, total_remaining: int, reason: text }
```
Logic:
1. Find active membership + plan capability flag for `_kind` (`body` / `posture`). If not allowed → `allowed=false, reason='plan_no_scan'`.
2. Count scans this calendar month from `howbody_body_reports` / `howbody_posture_reports`.
3. Sum unconsumed add-on credits from `member_benefits` where `benefit_type IN ('body_scan','posture_scan')` and not expired.
4. `allowed = (plan_limit=0) OR (used < plan_limit) OR (addon_remaining > 0)`.

Used by:
- `howbody-bind-user` edge function (replace inline counting in lines 60-78 with one RPC call).
- New `MyProgress` UI badge ("3 of 5 scans used this month • 2 add-on credits").

Add-on consumption: when a webhook arrives and the plan quota is already exhausted, decrement one `member_benefits` credit (FIFO oldest expiry) inside the body/posture webhook handlers.

---

## 3. Auto-mirror Scans → `member_measurements`

Both webhook functions (`howbody-body-webhook`, `howbody-posture-webhook`) get a new step after the report upsert:

**Body webhook** maps:
- `weight` → `weight_kg`
- `pbf` → `body_fat_percentage`
- (height stays from member's last manual entry; HOWBODY doesn't push height)
- Sets `recorded_at = test_time`, `recorded_by = NULL`, `notes = 'HOWBODY auto-sync'`

**Posture webhook** updates the same row (same `data_key` window) with:
- `posture_type`, `body_shape_profile` (already columns in `member_measurements`)

Strategy: upsert into `member_measurements` keyed by `(member_id, recorded_at)` rounded to the minute, so a body+posture pair from one session merges into one measurement row. This means the existing `MyProgress` charts and 3D avatar update automatically — zero UI work for the chart side.

---

## 4. Member Progress Tab — HOWBODY surface

`src/pages/MyProgress.tsx`:
- Add a **"Body Scan Reports"** card listing the last 6 `howbody_body_reports` + `howbody_posture_reports` for the member.
- Each row shows: date, type icon (Body / Posture), key metric (Health Score or Posture Type), and two buttons:
  - **View** → opens a new in-app drawer `HowbodyReportDrawer` rendering the same content blocks as `HowbodyPublicReport` but inside `AppLayout` (no token needed — RLS ensures member can read own rows).
  - **Download PDF** → calls new edge function `howbody-report-pdf` (returns a styled HTML→PDF using existing PDF pattern in the project). File saved with name `Incline-BodyReport-<date>.pdf`.
- Add a **scan-quota strip** at the top: "Body Scans: 2/5 this month · Posture: 1/5 · Add-on credits: 0 · [Buy More]" → links to `/store?tab=addons`.
- New `useHowbodyReports(memberId)` hook handles the dual-table fetch with TanStack Query.

RLS: add `SELECT` policy on `howbody_body_reports` / `howbody_posture_reports` for `auth.uid() = (SELECT user_id FROM members WHERE id = member_id)`.

---

## 5. PDF Download Edge Function

New `supabase/functions/howbody-report-pdf/index.ts`:
- Auth required (`getClaims`); validate the requesting user owns the member row.
- Inputs: `{ dataKey, reportType }`.
- Renders branded HTML (Incline header, member name, scan datetime, all metrics, recommendations) and returns a PDF via `https://esm.sh/pdf-lib` or the existing receipt generator pattern (whichever the project already uses — will reuse to stay consistent).
- Public report page also gets a "Download PDF" button that calls a sibling public endpoint validated by the opaque token.

---

## 6. Notifications

When a body or posture webhook completes, insert a row into `notifications` for the member: "Your new HOWBODY scan is ready — view in Progress." This plugs into the existing realtime bell.

---

## Technical Section

**Migrations**
- Add `SELECT` RLS policies on `howbody_body_reports` and `howbody_posture_reports` for the owning member.
- Insert seed `benefit_types` rows (`body_scan`, `posture_scan`) per branch (idempotent ON CONFLICT).
- Create `public.howbody_scan_quota(_member_id uuid, _kind text) RETURNS jsonb` (SECURITY DEFINER, search_path=public).
- Create trigger function `howbody_mirror_to_measurements()` on `howbody_body_reports` AFTER INSERT/UPDATE → upserts into `member_measurements`. Same for posture (updates only the posture/shape columns).

**Edge function changes**
- `howbody-bind-user`: replace inline quota math (lines 60-78) with `rpc('howbody_scan_quota', { _member_id, _kind: 'body' or 'posture' })`. Currently bind doesn't know which scan type — extend body to optionally accept `kind` and bind once per kind, or check `body OR posture` like today (acceptable v1).
- `howbody-body-webhook` / `howbody-posture-webhook`: after upsert, if plan quota was already exhausted, consume one `member_benefits` credit of matching type (FIFO oldest `expiry_date`).
- New `howbody-report-pdf` edge function (auth) and `howbody-public-report-pdf` (token-gated).

**Files to create**
- `src/components/progress/HowbodyReportDrawer.tsx`
- `src/components/progress/HowbodyReportsCard.tsx`
- `src/components/progress/ScanQuotaStrip.tsx`
- `src/hooks/useHowbodyReports.ts`
- `supabase/functions/howbody-report-pdf/index.ts`
- `supabase/functions/howbody-public-report-pdf/index.ts`
- One migration file (RLS + seeds + RPC + triggers)

**Files to modify**
- `src/pages/MyProgress.tsx` — add quota strip + reports card
- `src/components/plans/AddPlanDrawer.tsx` & `EditPlanDrawer.tsx` — add scanner access section
- `src/pages/Plans.tsx` — show "Body Scan" badge on plan card
- `src/pages/HowbodyPublicReport.tsx` — add "Download PDF" button
- `supabase/functions/howbody-bind-user/index.ts` — use new quota RPC
- `supabase/functions/howbody-body-webhook/index.ts` & `howbody-posture-webhook/index.ts` — measurement mirror trigger handles it; just add notification + add-on consumption fallback
- `supabase/config.toml` — register two new edge functions

No new secrets needed; HOWBODY credentials already configured.

---

## Out of scope (flag for later)

- Bind UX picking `body` vs `posture` explicitly (currently treated as one quota pool).
- Trainer-side comparison view of a member's HOWBODY trend.
- Auto-suggesting workout/diet adjustments from scan deltas.
