## Goal
Make plan benefits + gift comps appear as one combined live total on:
1. **Member Profile → Benefits tab** (`BenefitsUsageTab` in `MemberProfileDrawer.tsx`)
2. **Benefit Tracking → Benefit Balances tab** (`BenefitBalancesGrid` on `BenefitTracking.tsx`)

Both currently show only plan entitlements (e.g. "Ice Bath 0/6") and ignore gifted comps. Goal: show e.g. **Ice Bath: 0/8 used (6 plan + 2 gift)** with a clear visual badge for the gift portion.

## Changes

### 1. `src/components/members/MemberProfileDrawer.tsx` — `BenefitsUsageTab`
- Add a `useQuery` for `member_comps` filtered by `member_id` joined with `benefit_types(id, name, code)`, plus realtime subscription on `member_comps` to invalidate.
- Build a `compMap` keyed by `benefit_type_id` summing `(comp_sessions - used_sessions)` across active comps.
- In `availableBenefits`, for each plan benefit add `compRemaining`. For unlimited plan benefits, still surface comps separately.
- Update each benefit row card to display:
  - Total = `(plan remaining) + (comp remaining)` with breakdown line `"6 plan + 2 gift"` shown as a small muted line under the count.
  - A small amber "Gift +N" badge next to the benefit name when `compRemaining > 0`.
  - Progress bar based on combined limit so the bar reflects real availability.
- Append any pure-gift benefits (comps for benefit_types not in the plan) as additional rows tagged "Gift only".

### 2. `src/pages/BenefitTracking.tsx` + `BenefitBalanceCard.tsx`
- In `BenefitTracking.tsx`, compute a merged `combinedBalances` array: for every balance returned by `useBenefitBalances`, add `compTotal`, `compRemaining` from the `comps` query already fetched. Append gift-only benefits not present in `balances`.
- Pass `combinedBalances` into a new `BenefitBalancesGrid` variant (extend component to accept optional `compRemaining`, `compTotal`, `planRemaining`, `planLimit`, `isGiftOnly`).
- Update `BenefitBalanceCard.tsx`:
  - Header: add amber `Gift +N` badge when comp portion > 0.
  - Body (non-unlimited): show `total used / total limit` as the headline; add a smaller secondary line `"X plan • Y gift"`.
  - Progress bar uses combined values.
  - Unlimited plan + comps: show `"Unlimited + N gift"`.
  - Gift-only: indigo accent + "Complimentary" badge.
- StatCard "Gift Sessions" already exists; keep as-is.

### 3. Realtime
- Both pages already subscribe to `member_comps` and `benefit_usage`. Verify the new queries' query keys are invalidated in the existing channels (add the `member-plan-benefits-comps` key in MemberProfileDrawer's invalidation list — currently it has its own subscription; add one for `member_comps` filtered by `member_id`).

## Out of scope
- Backend logic for consumption order (comp-first vs plan-first) — already handled server-side per memory.
- No DB migrations required; everything is read-side aggregation.

## Files touched
- `src/components/members/MemberProfileDrawer.tsx`
- `src/pages/BenefitTracking.tsx`
- `src/components/benefits/BenefitBalanceCard.tsx`
