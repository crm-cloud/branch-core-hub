
# Comprehensive Ice Bath Booking Fix

## Audit Findings

After tracing the entire flow from plan creation to member booking, here are the identified issues:

### Finding 1: Plan has NO benefits linked
The ANNUAL PLAN (`33c0f0f5-bdae-47ea-a584-fd2b5fd4487c`) has **zero rows** in the `plan_benefits` table. The Ice Bath Access benefit type exists in `benefit_types` but was never saved to the plan (likely due to the 400 error we fixed earlier). The benefit shown as "Other / Unlimited" on the Benefit Tracking page comes from a stale state.

**Fix:** This is a data issue -- the plan needs to be re-edited and saved with Ice Bath Access selected. The code fix from earlier (safeBenefitEnum) should now prevent the 400 error.

### Finding 2: Slot generation uses wrong benefit_type
In `benefitBookingService.ts`, `generateDailySlots()` inserts `benefit_type: benefitType` directly into `benefit_slots`. If a custom code is passed (e.g., `ice_bath_access`), it will fail with 400 since the DB enum doesn't include it.

**Fix:** Apply `safeBenefitEnum()` in `generateDailySlots()` and `createSlot()`.

### Finding 3: ManageSlotsDrawer settings lookup mismatch
Line 76 of `ManageSlotsDrawer.tsx` looks up settings with `s.benefit_type === benefitType`, but in the DB the record is stored as `benefit_type: 'other'` with `benefit_type_id` holding the actual UUID. So it never finds the settings.

**Fix:** Match by `benefit_type_id` first, then fall back to `benefit_type`.

### Finding 4: BookBenefitSlot and benefit_slots query mismatch
The member booking page (`BookBenefitSlot.tsx`) fetches all slots for a branch/date. Slots are stored with `benefit_type: 'other'` for custom types. The slot display and benefit matching logic needs to use `benefit_type_id` for accurate identification.

### Finding 5: Benefit balance display shows "Other" label
`BenefitBalanceCard.tsx` uses `benefitTypeLabels[balance.benefit_type]` which maps `'other'` to "Other" instead of the actual benefit name like "Ice Bath Access". The balance calculation in `benefitService.ts` also matches usage by `benefit_type` enum value -- all custom types collapse to `'other'`, making distinct tracking impossible.

**Fix:** Extend the benefit data model to carry `benefit_type_id` through the balance calculation, and use it for display names.

---

## Implementation Plan

### Step 1: Fix slot generation to use safeBenefitEnum

**File:** `src/services/benefitBookingService.ts`

- `generateDailySlots()` (line 174): Change `benefit_type: benefitType` to `benefit_type: safeBenefitEnum(benefitType) as BenefitType`
- `createSlot()` (line 196): Same fix for the slot insert
- Add `benefit_type_id` parameter to both functions so it gets stored alongside the safe enum

### Step 2: Fix ManageSlotsDrawer settings lookup

**File:** `src/components/benefits/ManageSlotsDrawer.tsx`

- Line 76: Change from `s.benefit_type === benefitType` to also match by `benefit_type_id`
- Add `benefitTypeId` prop to the drawer
- Pass the UUID through from the settings page when opening the drawer

### Step 3: Fix getAvailableSlots to filter by benefit_type_id

**File:** `src/services/benefitBookingService.ts`

- Update `getAvailableSlots()` to accept an optional `benefitTypeId` parameter
- When provided, filter by `benefit_type_id` instead of `benefit_type` enum

### Step 4: Extend benefit balance model with benefit_type_id

**File:** `src/services/benefitService.ts`

- Add `benefit_type_id` to the `MemberBenefitBalance` interface
- Include `benefit_type_id` in `fetchMembershipWithBenefits` select query
- Update `calculateBenefitBalances` to match usage by `benefit_type_id` when available (so "other" type benefits for Ice Bath don't collide with "other" type benefits for, say, Spa)
- Add a `label` field to `MemberBenefitBalance` populated from benefit_types name

### Step 5: Fix BenefitBalanceCard to show actual names

**File:** `src/components/benefits/BenefitBalanceCard.tsx`

- Use the new `label` field from balance instead of hardcoded `benefitTypeLabels[benefit_type]`
- Fall back to `benefitTypeLabels` for standard enum types

### Step 6: Fix BookBenefitSlot display

**File:** `src/pages/BookBenefitSlot.tsx`

- The query already joins `benefit_type_info:benefit_types(...)`, so display already works
- Ensure slot filtering and credit checking uses `benefit_type_id` instead of just `benefit_type`

### Step 7: Fix BenefitTracking page (admin)

**File:** `src/pages/BenefitTracking.tsx`

- Update to pass `benefit_type_id` when recording usage, so the ledger correctly tracks Ice Bath vs other "other" benefits

---

## Data Fix Required

After the code changes are deployed, the admin needs to:
1. Go to Plans, edit the ANNUAL PLAN
2. Add "Ice Bath Access" as a benefit (it should now save correctly with safeBenefitEnum)
3. Go to Settings > Benefits, configure slot settings for Ice Bath Access
4. Generate slots using the Manage Slots drawer

---

## Files Summary

| File | Change |
|------|--------|
| `src/services/benefitBookingService.ts` | Apply safeBenefitEnum in slot generation; add benefit_type_id support |
| `src/services/benefitService.ts` | Add benefit_type_id to balance model; use for distinct tracking |
| `src/components/benefits/ManageSlotsDrawer.tsx` | Fix settings lookup; add benefitTypeId prop |
| `src/components/benefits/BenefitBalanceCard.tsx` | Show actual benefit name instead of "Other" |
| `src/pages/BenefitTracking.tsx` | Pass benefit_type_id for accurate usage recording |
| `src/pages/BookBenefitSlot.tsx` | Use benefit_type_id for credit checking |
| `src/hooks/useBenefitBookings.ts` | Update hook signatures for benefit_type_id |
