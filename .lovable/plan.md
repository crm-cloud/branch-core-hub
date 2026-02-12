

# Global Branch Context + EditPlanDrawer 400 Fix

## Problem 1: Branch Selector Not Persisting Across Actions

Currently, each page manages its own `selectedBranch` state independently. When "All Branches" is selected (the default), create actions like "Add Member" or "Add Plan" receive `undefined` as the branch ID, which causes failures or data without proper branch assignment.

**Solution:** Create a `BranchContext` (React Context) that holds the selected branch globally. All pages and drawers will consume this context instead of managing their own state. When creating records, if "All Branches" is selected, the system will auto-resolve to the first available branch.

## Problem 2: EditPlanDrawer 400 Error on plan_benefits

The same enum bug fixed in `AddPlanDrawer` still exists in `EditPlanDrawer`. Line 214 inserts `benefit_type: benefitType as any` without validating against known enum values, causing a 400 when custom benefit types are used.

---

## Changes

### 1. New File: `src/contexts/BranchContext.tsx`

A React Context providing:
- `selectedBranch` (string, defaults to `'all'`)
- `setSelectedBranch` (setter)
- `effectiveBranchId` -- resolves to the selected branch ID, or falls back to the first branch when "all" is selected (for create actions)
- `branches` -- the full branches list

Wraps the app inside `App.tsx` (alongside existing providers).

### 2. Update Pages to Use BranchContext

Remove local `selectedBranch` state and `useBranches()` calls from individual pages. Instead, consume from context:

**Pages to update:**
- `src/pages/Members.tsx` -- remove local branch state, use context
- `src/pages/Plans.tsx` -- remove local branch fetch, use context
- `src/pages/Dashboard.tsx` -- use context for branch filtering
- Other pages with BranchSelector (Attendance, Classes, Trainers, etc.)

The BranchSelector component stays the same -- it just reads/writes from context instead of props.

### 3. Fix EditPlanDrawer 400 Error

**File:** `src/components/plans/EditPlanDrawer.tsx`

Line 214: Change `benefit_type: benefitType as any` to `benefit_type: safeBenefitEnum(benefitType) as any`

Import `safeBenefitEnum` from `@/lib/benefitEnums`.

---

## Technical Details

### BranchContext Implementation

```text
// src/contexts/BranchContext.tsx
const BranchContext = createContext<{
  selectedBranch: string;           // 'all' or a UUID
  setSelectedBranch: (id: string) => void;
  effectiveBranchId: string | undefined;  // first branch ID when 'all', otherwise selectedBranch
  branches: Branch[];
}>(...);

// effectiveBranchId logic:
// selectedBranch === 'all' ? branches[0]?.id : selectedBranch
```

### Members.tsx Change (example)

```text
// BEFORE:
const { data: branches = [] } = useBranches();
const [selectedBranch, setSelectedBranch] = useState('all');
const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;
<AddMemberDrawer branchId={branchFilter} />

// AFTER:
const { selectedBranch, setSelectedBranch, effectiveBranchId, branches } = useBranchContext();
const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;
<AddMemberDrawer branchId={effectiveBranchId} />
```

Key difference: `branchFilter` (for queries) can still be `undefined` to fetch all branches. But `effectiveBranchId` (for create actions) always resolves to a real branch ID.

### EditPlanDrawer Fix

```text
// Line 214 - BEFORE:
benefit_type: benefitType as any,

// AFTER:
benefit_type: safeBenefitEnum(benefitType) as any,
```

---

## Files Summary

| File | Change |
|------|--------|
| New: `src/contexts/BranchContext.tsx` | Global branch state context |
| `src/App.tsx` | Wrap app with BranchProvider |
| `src/pages/Members.tsx` | Use BranchContext, pass `effectiveBranchId` to create drawers |
| `src/pages/Plans.tsx` | Use BranchContext for branch ID |
| `src/pages/Dashboard.tsx` | Use BranchContext |
| `src/components/plans/EditPlanDrawer.tsx` | Add `safeBenefitEnum()` to fix 400 error |
| Other pages with BranchSelector | Migrate to context (Attendance, Classes, Trainers, etc.) |

