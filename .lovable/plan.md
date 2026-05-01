## Goal

Replace ad-hoc HTML/print-based PDFs, toast-only payroll, and direct `user_roles` mutations with a unified branded PDF system, a real multi-stage payroll workflow, and secure RPC-based role management with full audit.

---

## Part 1 — Branded Document Generator

### 1.1 Brand resolver

Create `src/lib/brand/useBrandContext.ts`:
- Hook returning `{ companyName, legalName, logoUrl, website, supportEmail, branch: { name, address, phone, email, gstin } }`.
- Pulls from `branches` (logo_url, gstin, address, phone, email) + `app_settings` (company name fallback, website).
- Cached via TanStack Query, keyed by `branch_id`.
- Default legal name: `"The Incline Life by Incline"`.

### 1.2 Unified PDF builders (`src/utils/pdfBlob.ts`)

Refactor existing file into a single shared module returning `Blob`s using jsPDF + autoTable. All builders accept a `BrandContext` parameter and share:
- `drawHeader(doc, brand, docTitle, docNumber, issueDate)` — logo (loaded as base64 if `logoUrl` present), company name, branch address block, GSTIN, doc title + number on right.
- `drawFooter(doc, brand)` — legal name, website, support email, page X/Y, "Computer-generated".
- `drawMetaBlock(doc, { recipient, code, branch, preparedBy, qr? })` — uses `qrcode` lib (already common; add if missing) for reference QR.

Builders to implement/refactor:
1. `buildInvoicePdf(data, brand)` — line items, GST split (CGST/SGST/IGST when `is_gst_invoice`), totals, status watermark for `paid/void/refunded`.
2. `buildReceiptPdf(data, brand)` — Receipt #, payment method, transaction id, paid date, amount paid, balance due, GST breakdown, signature block.
3. `buildPayslipPdf(data, brand)` — uses **finalized** payroll item only; earnings vs deductions table, attendance summary, net pay in words.
4. `buildWorkoutPlanPdf(data, brand)` — member name/code, trainer, goal, validity, day-by-day exercises table, notes.
5. `buildDietPlanPdf(data, brand)` — member, trainer, goal, validity, meals table with macros/calories, notes.
6. `buildContractPdf(data, brand)` — replaces existing HTML contract with branded PDF including signature placeholders.

`src/utils/pdfGenerator.ts` (current HTML-window approach for payslip/invoice) is removed; all callers switched to the Blob API + `downloadBlob(blob, filename)` helper.

### 1.3 Document actions component

`src/components/documents/DocumentActions.tsx`:
Buttons: **Download Invoice**, **Download Receipt** (only when paid), **Print** (opens blob in new tab), **Share WhatsApp**, **Share Email**. Share actions upload the blob to the existing `documents` storage bucket (signed URL) and call `send-whatsapp` / `send-email` edge functions with the link.

Used by: `InvoiceViewDrawer`, `Invoices`, `MyInvoices`, `MemberProfileDrawer`, `Payments`, `MyWorkout`, `MyDiet`, `HRM` payslip, `ContractSign`, `TrainerEarnings`.

### 1.4 Workout / Diet pages

- `MyWorkout.tsx` and `MyDiet.tsx`: add `Download PDF` button (top-right of plan card) wired to `buildWorkoutPlanPdf` / `buildDietPlanPdf` with the resolved trainer name + member/code from auth profile.

---

## Part 2 — Real Payroll Workflow

### 2.1 Schema (migration)

Extend existing `payroll_runs` and add `payroll_items`:

```sql
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS
  -- stages: draft | calculated | review | adjusted | approved | processed | paid
  reviewed_by uuid, reviewed_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  processed_by uuid, processed_at timestamptz,
  paid_at timestamptz, notes text;

CREATE TABLE payroll_items (
  id uuid PK,
  run_id uuid REFERENCES payroll_runs ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- snapshot of original calculation
  calc_base numeric, calc_pt_commission numeric, calc_ot numeric,
  calc_deductions numeric, calc_gross numeric, calc_net numeric,
  calc_attendance jsonb, -- present/half/late/missing/leave counts
  -- final adjusted values
  final_base numeric, final_pt_commission numeric, final_ot numeric,
  final_bonus numeric DEFAULT 0, final_deductions numeric DEFAULT 0,
  final_advance numeric DEFAULT 0, final_penalty numeric DEFAULT 0,
  final_gross numeric, final_net numeric,
  adjustment_reason text,
  status text DEFAULT 'draft', -- draft | reviewed | approved | processed | paid
  payslip_url text,
  UNIQUE (run_id, user_id)
);

CREATE TABLE payroll_audit (
  id uuid PK, run_id uuid, item_id uuid, actor_id uuid,
  action text, before jsonb, after jsonb, reason text,
  created_at timestamptz DEFAULT now()
);
```

### 2.2 RPCs

- `payroll_create_run(branch, period_start, period_end)` → calls `compute_payroll` per active staff, inserts `payroll_items` with `calc_*` and matching `final_*` defaults, status `draft`.
- `payroll_adjust_item(item_id, patch jsonb, reason)` → updates `final_*`, recomputes `final_gross/net`, logs to `payroll_audit`, status `adjusted`.
- `payroll_review_item(item_id)` / `payroll_approve_run(run_id)` / `payroll_process_items(item_ids[])` / `payroll_mark_paid(item_ids[], method, ref)` — each transitions status, logs audit, requires role.
- Stage gating enforced server-side; payslip generation blocked until `approved`.

### 2.3 UI — `src/pages/HRM.tsx` Payroll tab

Replace toast-only `processPayroll` with a real flow:
1. **Create Run** drawer — pick period + branch.
2. **Run Detail** page (`/hrm/payroll/:runId`) showing items table:
   - Columns: staff, attendance summary badges, calculated net, adjustments, final net, status.
   - Inline drawer per row: edit bonus / deductions / advance / penalty / OT hours / commission / attendance override, with **reason** required.
   - Show original calculated values side-by-side with final values + audit timeline.
3. Action bar: `Review Selected` → `Approve` → `Process Selected` / `Process All` (only enabled per stage). `Download Payslip` only after `approved`, uses `final_*` values via `buildPayslipPdf`.

Service: `src/services/payrollService.ts` wrapping all RPCs + queries.

---

## Part 3 — Secure Admin Role Management

### 3.1 RPCs (migration)

```sql
CREATE TABLE role_change_audit (
  id uuid PK, target_user_id uuid, actor_id uuid,
  action text, -- 'assigned' | 'removed' | 'requested' | 'approved' | 'rejected'
  role app_role, branch_id uuid,
  reason text, before jsonb, after jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE role_change_requests (
  id uuid PK, target_user_id uuid, requested_by uuid,
  role app_role, branch_id uuid, action text, reason text,
  status text DEFAULT 'pending', -- pending | approved | rejected
  decided_by uuid, decided_at timestamptz, decision_reason text,
  created_at timestamptz DEFAULT now()
);
```

RPCs (all `SECURITY DEFINER`, role-gated):
- `assign_user_role(target, role, branch_id, reason)`:
  - Validates caller is owner/admin.
  - For `manager/staff/trainer`: requires `branch_id`, upserts into `staff_branches`.
  - For `owner/admin`: if caller is admin (not owner), creates pending `role_change_request` instead of direct insert.
  - Inserts into `user_roles` (idempotent), logs `role_change_audit`.
- `remove_user_role(target, role, reason)`:
  - Blocks if removing the **last owner or last admin** (`SELECT count(*) FROM user_roles WHERE role=...`).
  - Same approval gate for owner/admin removal.
- `decide_role_change_request(request_id, approve bool, reason)` — owner-only.
- `get_role_permission_impact(target, role, action)` — returns JSON of pages/permissions gained or lost (computed from a static mapping table) for the impact preview.

### 3.2 Service + UI (`src/pages/AdminRoles.tsx`)

- Replace direct supabase inserts/deletes with `roleService.assign / remove`.
- **Assign drawer** additions:
  - Branch selector (required for manager/staff/trainer).
  - Reason textarea (required).
  - **Permission impact preview** panel populated from `get_role_permission_impact` showing pages/actions the user will gain.
  - Banner if action requires owner approval ("This change will be sent for approval").
- Last-owner/admin guard surfaces server error toast — additionally do client-side warning when count would drop to 0.
- New tab **Approval Queue** (owner only) listing pending `role_change_requests` with Approve/Reject + reason.
- New tab **Audit Log** showing `role_change_audit` (actor, target, action, role, branch, reason, time).

---

## Files

**New**
- `src/lib/brand/useBrandContext.ts`
- `src/components/documents/DocumentActions.tsx`
- `src/services/payrollService.ts`
- `src/services/roleService.ts`
- `src/pages/PayrollRunDetail.tsx`
- `supabase/migrations/<ts>_branded_payroll_roles.sql`

**Modified**
- `src/utils/pdfBlob.ts` (expanded; becomes the single PDF entry point)
- Delete usage of `src/utils/pdfGenerator.ts` (file kept only as thin re-export shim or removed)
- `src/pages/Invoices.tsx`, `src/pages/MyInvoices.tsx`, `src/components/invoices/InvoiceViewDrawer.tsx`, `src/pages/Payments.tsx`
- `src/pages/MyWorkout.tsx`, `src/pages/MyDiet.tsx`
- `src/pages/HRM.tsx`, `src/pages/TrainerEarnings.tsx`
- `src/pages/AdminRoles.tsx`
- `src/App.tsx` (route for payroll run detail)

---

## Out of scope

- Payment gateway integration for actual salary disbursal (only marks status `paid` with method + reference).
- Multi-currency PDFs (INR only).
- Bulk re-issuing historical invoices in new branded format (new downloads only).
