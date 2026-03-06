

# Plan: PT Package Refactor, Amortized Commissions, Paid Freeze, Ad Banners & Follow-Up Recording

## 1. Database Migration (Single SQL migration)

### 1a. PT Packages — Add `package_type` and `duration_months`
```sql
ALTER TABLE public.pt_packages
  ADD COLUMN package_type text NOT NULL DEFAULT 'session_based',
  ADD COLUMN duration_months integer;
```
Current schema has `total_sessions` (required) and `validity_days`. For duration-based packages, `total_sessions` will be set to 0 (or a nominal value) and `duration_months` drives the logic.

### 1b. Trainer Commissions — Add `release_date`
The table already has `amount`, `status`, `commission_type`. Add:
```sql
ALTER TABLE public.trainer_commissions
  ADD COLUMN release_date date DEFAULT CURRENT_DATE;
```
This enables amortized monthly payouts. Existing rows get today's date (backward-compatible).

### 1c. Ad Banners — New table
```sql
CREATE TABLE public.ad_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  redirect_url text,
  title text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read active banners" ON public.ad_banners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage banners" ON public.ad_banners FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));
```

### 1d. Follow-Up Activities — New table for recording follow-up actions
```sql
CREATE TABLE public.follow_up_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  reference_type text NOT NULL, -- 'payment', 'renewal', 'lead', 'inactive', 'task'
  reference_id text NOT NULL,
  action_taken text NOT NULL, -- 'called', 'whatsapp', 'visited', 'email', 'other'
  notes text,
  next_follow_up_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.follow_up_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage follow-ups" ON public.follow_up_activities FOR ALL TO authenticated USING (true);
```

### 1e. Update `purchase_pt_package` RPC — Amortized Commissions
Replace the existing function to support both package types and split commissions by month for duration-based packages.

## 2. PT Package Create/Edit UI

**Files:** `src/components/pt/AddPTPackageDrawer.tsx`, `src/components/pt/EditPTPackageDrawer.tsx`

- Add a radio toggle at the top: "Session Pack" vs "Monthly Duration"
- If Session Pack: show existing `total_sessions` + `price` fields, set `package_type = 'session_based'`
- If Monthly Duration: show `duration_months` input + `price` (total price), hide `total_sessions`, auto-set `validity_days = duration_months * 30`, set `package_type = 'duration_based'`, `total_sessions = 0`
- Fix the form submission to include `package_type` and `duration_months` in the insert payload
- The `ptService.createPTPackage` already does a generic insert, so it will pass through new columns automatically once types refresh

## 3. Amortized Commission Engine

**File:** Update the `purchase_pt_package` DB function:
- After creating `member_pt_packages`, check if the package is `duration_based`
- If yes: calculate total commission, divide by `duration_months`, loop and insert N rows into `trainer_commissions` with staggered `release_date` values (+0, +1, +2 months)
- If session-based: insert single commission row with `release_date = CURRENT_DATE` (current behavior)

**File:** `src/services/hrmService.ts` (line 244-251)
- Change commission query from filtering by `created_at` to filtering by `release_date`:
  ```
  .gte('release_date', startDate).lte('release_date', endDate)
  ```
- This ensures only released commissions count toward the payroll month

**File:** `src/pages/TrainerEarnings.tsx` — Same filter change for the trainer's own earnings view

## 4. Paid Freeze Logic

**File:** `src/components/members/FreezeMembershipDrawer.tsx`
- Add a "Paid Freeze" toggle switch
- When ON: show "Freeze Fee Amount" input (pre-filled from branch settings if available)
- On submit: if paid freeze, after creating the freeze history record, also create an invoice:
  ```ts
  await supabase.from('invoices').insert({
    branch_id, member_id, total_amount: freezeFee, status: 'pending',
    due_date: startDate
  });
  // + invoice_item for 'Membership Freeze Fee'
  ```

**File:** `src/components/members/QuickFreezeDrawer.tsx` — Same paid freeze toggle

## 5. Member Dashboard — Frozen State Enhancement

**File:** `src/pages/MemberDashboard.tsx` (lines 157-180)
- When `isFrozen`: query `membership_freeze_history` for the active freeze record to get plan name and freeze dates
- Update the badge from "Membership Frozen" to "FROZEN - [Plan Name]"
- Add sub-text: "Frozen for X Days" (calculate from freeze record `start_date` to `end_date`)
- Show freeze end date so member knows when it lifts

## 6. Ad Banners

### Admin UI
**New file:** `src/components/banners/AdBannerManager.tsx`
- Table of banners with image preview, title, status toggle, delete
- "Add Banner" button opens a Sheet drawer with: image upload (to `documents` bucket), title, redirect URL, active toggle

**File:** `src/pages/Store.tsx` or `src/pages/POS.tsx`
- Add an "Ad Banners" tab to the existing POS/E-commerce section

### Member Dashboard
**File:** `src/pages/MemberDashboard.tsx`
- Below the welcome header, above stats: query `ad_banners` where `is_active = true` and `branch_id = member.branch_id`
- Render using Embla Carousel (already installed) with rounded-xl images, auto-play, clickable links

## 7. Follow-Up Center — Record Actions & Next Follow-Up Date

**New file:** `src/components/followup/RecordFollowUpDrawer.tsx`
- Sheet drawer with: action type dropdown (Called, WhatsApp, Visited, Email, Other), notes textarea, next follow-up date picker
- On submit: insert into `follow_up_activities` table

**File:** `src/pages/FollowUpCenter.tsx`
- Add a "Record Follow-Up" button on each item row (all 5 tabs)
- Show last follow-up activity inline if exists (query `follow_up_activities` by reference_type + reference_id)
- Add "Next Follow-Up" date badge on items that have a scheduled next date
- For leads tab: also update `leads.follow_up_date` when recording a follow-up with a next date

## Files to Change

| File | Change |
|------|--------|
| **DB Migration** | Add `package_type`, `duration_months` to `pt_packages`; `release_date` to `trainer_commissions`; create `ad_banners` table; create `follow_up_activities` table; update `purchase_pt_package` RPC |
| `src/components/pt/AddPTPackageDrawer.tsx` | Add session/duration toggle, duration_months field, package_type |
| `src/components/pt/EditPTPackageDrawer.tsx` | Same toggle + duration fields |
| `src/services/hrmService.ts` | Filter commissions by `release_date` instead of `created_at` |
| `src/pages/TrainerEarnings.tsx` | Filter commissions by `release_date` |
| `src/components/members/FreezeMembershipDrawer.tsx` | Add paid freeze toggle + invoice generation |
| `src/components/members/QuickFreezeDrawer.tsx` | Add paid freeze toggle + invoice generation |
| `src/pages/MemberDashboard.tsx` | Enhanced frozen state UI + ad banner carousel |
| **NEW** `src/components/banners/AdBannerManager.tsx` | Banner CRUD admin UI |
| `src/pages/Store.tsx` | Add "Ad Banners" tab |
| **NEW** `src/components/followup/RecordFollowUpDrawer.tsx` | Follow-up recording drawer |
| `src/pages/FollowUpCenter.tsx` | Record button, last activity display, next follow-up dates |

## Execution Order
1. DB migration (all schema changes + updated RPC)
2. PT Package UI (create/edit drawers with session vs duration toggle)
3. Amortized commission logic in HRM + TrainerEarnings
4. Paid freeze logic in freeze drawers
5. Member Dashboard frozen UI + ad banner carousel
6. Ad Banner admin manager
7. Follow-Up Center recording & next date tracking

