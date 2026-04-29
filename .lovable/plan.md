## Audit finding

You're right — this is inconsistent. The project already has a consistent pattern:

| Service | How it's modeled today |
|---|---|
| Sauna (M/F) | `benefit_types` row → attached to plans via `plan_benefits` (with frequency + limit) → sold à la carte via `benefit_packages` |
| Ice Bath (M/F) | same |
| **3D Body Scanning** | already exists as a `benefit_types` row (category `service`, code `3d_body_scanning`) |

But in the previous step I added **direct columns** (`body_scan_allowed`, `posture_scan_allowed`, `scans_per_month`) on `membership_plans` and a separate quota engine that reads them. That created two parallel systems for the same concept.

**Decision:** unify HOWBODY scans onto the existing benefit-type pattern. Treat them like sauna/ice-bath: one benefit type per scan kind, attached to a plan via `plan_benefits` (with monthly limit), sold as add-on credits via `benefit_packages` → `member_benefit_credits`. Remove the parallel plan flags.

---

## What changes

### 1. Database — collapse to one model

**Migration:**
- Reuse the existing `3d_body_scanning` benefit type as **Body Composition Scan** (rename label, keep code), and create a sibling **Posture Scan** type (code `howbody_posture`, category `service`, `is_bookable=false` — booking happens at the device, not via the slot system).
- Drop the parallel columns added last round: `membership_plans.body_scan_allowed`, `posture_scan_allowed`, `scans_per_month`. Drop the values from `benefit_type` enum if used (`body_scan`, `posture_scan`) — they're not needed since we use `benefit_type_id` (the FK), not the enum, for these.
- Rewrite `public.howbody_scan_quota(_member_id, _kind)` to read from the unified ledger:
  1. plan limit = sum of `plan_benefits.limit_count` for that benefit type on the active membership (interpreted as monthly when `frequency='monthly'`, total when `'per_membership'`, etc.)
  2. used = count of HOWBODY reports in the relevant period
  3. add-on remaining = sum of `member_benefit_credits.credits_remaining` matching the benefit type
- Replace the `howbody_*_to_measurements` mirror trigger so it also **decrements one credit** from the oldest non-expired `member_benefit_credits` row when the plan quota is exhausted (FIFO).

### 2. Admin UI — remove the parallel "Scanner Access" section

**Plans → Add/Edit Plan drawer:**
- Delete the `PlanScannerAccessSection` I added.
- Admins simply add the **Body Composition Scan** or **Posture Scan** benefit type using the existing benefit picker, and set the limit/frequency exactly like sauna or ice bath. No special UI.
- The Plan card "HOWBODY Scan" badge stays, but it's now derived: shown when any benefit on the plan has `benefit_type_id` matching the scan types.

**Plans → Add-On Packages tab:**
- No change. Admins create a "5× Body Scans / 60 days" pack via the existing `AddBenefitPackageDrawer` — same flow used for "10 Sauna Sessions".

**Settings → Benefit Types:**
- The seeded `Body Composition Scan` and `Posture Scan` rows are managed exactly like sauna/ice-bath rows. Admins can rename, deactivate, or set icons.

### 3. Edge functions — read the unified quota

- `howbody-bind-user`: still calls the new `howbody_scan_quota` RPC, which now uses the benefit ledger underneath. Same external behavior.
- `howbody-body-webhook` / `howbody-posture-webhook`: after the upsert, call new SQL helper `consume_scan_credit_if_needed(_member_id, _kind)` which:
  - Checks if plan benefit covers this scan in the current period.
  - If not, decrements oldest valid `member_benefit_credits` row by 1.
  - If neither, logs the scan anyway but flags it `unauthorized=true` (admin sees in webhook log).

### 4. Member UI — no visible change

- `ScanQuotaStrip` and `HowbodyReportsCard` keep working — they call the same `useScanQuota` hook, which reads the rewritten RPC.
- Display labels switch to plain "Body Composition · 2 of 5 this month" — driven by the benefit type's `name` column.

### 5. Member self-purchase

- "Buy Add-On Scans" already routes to `/store`. The existing add-on flow (which sells sauna/ice-bath credits) will sell scan credits the same way once the seeded benefit packages exist.
- Optional: add a "Body Scanner" filter chip in the add-ons store for discoverability.

---

## Why this is the right call

1. **Single source of truth.** Plan benefits, add-on credits, and consumption all flow through `plan_benefits` + `member_benefit_credits`. No special-case columns on `membership_plans`.
2. **Admins already know the pattern.** They configure scans the same way they configure sauna/ice-bath/PT — no new mental model.
3. **Receipts, GST, and the ledger work for free.** Add-on scan packs go through the same invoicing pipeline. No bespoke billing.
4. **Future-proof.** Adding "InBody scan", "VO2 max test", or any other measurement service is just one more benefit type row — no schema change.
5. **Removes the duplicate `body_scan` / `posture_scan` enum values** I added — they were never needed because we identify the type by FK, not by enum.

---

## Technical Section

**Migration steps**
1. `UPDATE benefit_types SET name='Body Composition Scan', icon='Scan' WHERE code='3d_body_scanning';`
2. `INSERT` Posture Scan benefit type per branch (skip on conflict).
3. `ALTER TABLE membership_plans DROP COLUMN body_scan_allowed, DROP COLUMN posture_scan_allowed, DROP COLUMN scans_per_month;`
4. `CREATE OR REPLACE FUNCTION howbody_scan_quota` — rewrite to read from `plan_benefits` (joined to active membership) + `member_benefit_credits`.
5. `CREATE FUNCTION consume_scan_credit_if_needed(_member_id, _kind)` returning `boolean` (true if a credit was consumed).
6. Update both webhook trigger functions (or the webhook edge functions) to call it.

**Files to change**
- `src/components/plans/AddPlanDrawer.tsx` — remove `PlanScannerAccessSection`, scanner state, scanner fields in INSERT.
- `src/components/plans/EditPlanDrawer.tsx` — same removal + drop the separate scanner UPDATE.
- `src/components/plans/PlanScannerAccessSection.tsx` — **delete**.
- `src/pages/Plans.tsx` — change the badge condition to look for scan benefit types in `plan_benefits` instead of the dropped columns.
- `supabase/functions/howbody-bind-user/index.ts` — already calls the RPC; behavior unchanged.
- `supabase/functions/howbody-body-webhook/` & `howbody-posture-webhook/` — call `consume_scan_credit_if_needed`.
- One migration for schema + RPC rewrite.

**Files unchanged**
- `MyProgress.tsx`, `ScanQuotaStrip`, `HowbodyReportsCard`, `HowbodyReportDrawer`, `useHowbodyReports`, `howbody-report-pdf` edge function — all still work via the RPC.

---

## Out of scope
- Migrating any existing plans that were configured with the old toggle (none in production yet).
- Refactoring sauna/ice-bath to ever depart from this pattern.
