

# Deep Audit: Remove All Duplicate Branch Selectors + Fix Build Errors

## Audit Results

Here is every file that has a **duplicate/local** branch selector that conflicts with the global AppHeader selector:

| File | Problem | Fix |
|------|---------|-----|
| `src/pages/Members.tsx` | Imports `BranchSelector` + `useBranches`, renders per-page selector (line 253) while also using `useBranchContext` | Remove `BranchSelector` import, remove `useBranches` import, remove the `<BranchSelector>` JSX block (lines 253-258) |
| `src/pages/Dashboard.tsx` | Imports `BranchSelector`, renders per-page selector (line 274-279) while also using `useBranchContext` | Remove `BranchSelector` import, remove the `<BranchSelector>` JSX block |
| `src/pages/Finance.tsx` | Local `useState('all')` + inline `<Select>` branch dropdown (lines 24, 33-39, 306-316). Does NOT use `useBranchContext` at all | Replace with `useBranchContext()`, remove local state + inline branch query + inline `<Select>` UI |
| `src/pages/Integrations.tsx` | Local `useState('all')` + `useBranches()` + `<BranchSelector>` (lines 54, 62, 103-108) | Replace with `useBranchContext()`, remove all local branch logic + selector UI |
| `src/pages/PTSessions.tsx` | Local `useState("")` + `useBranches()` (lines 33-34). **Also has build error: `useTrainers` and `useDeactivateTrainer` not found** | Replace with `useBranchContext()`, fix missing imports |
| `src/pages/DeviceManagement.tsx` | Uses `useBranchContext` correctly but **has build error: `queryClient` used without declaration** | Add `const queryClient = useQueryClient()` |
| `src/pages/Trainers.tsx` | Uses `useBranchContext` correctly but **has build error: `useTrainers` and `useDeactivateTrainer` not imported** | Add missing imports from `@/hooks/useTrainers` |
| `src/components/settings/IntegrationSettings.tsx` | Local `useState('all')` + `useBranches()` + `<BranchSelector>` (lines 57, 65, 108-113) | Replace with `useBranchContext()`, remove local branch logic + selector UI |
| `src/components/settings/ReferralSettings.tsx` | Local `useState('')` + inline branch query + inline `<Select>` (lines 16, 28-35, 122-133) | Replace with `useBranchContext()`, remove local branch logic + selector UI |

### Files that correctly use `useBranches()` and should NOT be changed:
- `src/contexts/BranchContext.tsx` -- the source of truth
- `src/components/settings/BranchSettings.tsx` -- manages branches themselves
- `src/components/employees/AddEmployeeDrawer.tsx` -- needs branch list for assignment dropdown (not filtering)
- `src/components/settings/UserSettings.tsx` / `AdminUsers.tsx` -- needs branch list for user creation form (not filtering)

## Execution Plan

### Fix 1: Build Errors (Critical)

**`src/pages/DeviceManagement.tsx`** -- Add `useQueryClient` import and declaration:
```typescript
const queryClient = useQueryClient();
```

**`src/pages/Trainers.tsx`** -- Add missing hook imports:
```typescript
import { useTrainers, useDeactivateTrainer } from '@/hooks/useTrainers';
```

### Fix 2: Remove Duplicate Selectors from Pages Using Context

**`src/pages/Members.tsx`:**
- Remove `import { BranchSelector }` (line 7)
- Remove `import { useBranches }` (line 22)
- Remove `<BranchSelector ... />` JSX block (lines 253-258)

**`src/pages/Dashboard.tsx`:**
- Remove `import { BranchSelector }` (line 5)
- Remove `<BranchSelector ... />` JSX block (lines 274-279)

### Fix 3: Migrate Remaining Pages to Global Context

**`src/pages/Finance.tsx`:**
- Replace local `useState('all')` + inline branches query with `useBranchContext()`
- Remove the inline `<Select>` dropdown (lines 306-316)
- Replace all `selectedBranch` references with context values
- Use `effectiveBranchId` for `AddExpenseDrawer` branchId prop

**`src/pages/Integrations.tsx`:**
- Replace `useBranches()` + `useState('all')` with `useBranchContext()`
- Remove `<BranchSelector>` from JSX
- Remove `BranchSelector` and `useBranches` imports

**`src/pages/PTSessions.tsx`:**
- Replace `useBranches()` + `useState("")` with `useBranchContext()`
- Use `effectiveBranchId` as `branchId`
- Add missing hook imports if any

**`src/components/settings/IntegrationSettings.tsx`:**
- Replace `useBranches()` + `useState('all')` with `useBranchContext()`
- Remove `<BranchSelector>` from JSX

**`src/components/settings/ReferralSettings.tsx`:**
- Replace inline branches query + `useState('')` with `useBranchContext()`
- Remove the inline branch `<Select>` UI
- Use `effectiveBranchId` for the branch-specific settings query

## Summary

- **2 build errors** fixed (DeviceManagement missing `queryClient`, Trainers missing imports)
- **2 pages** with duplicate selectors cleaned (Members, Dashboard -- already on context but render extra selector)
- **5 files** migrated from local branch state to global context (Finance, Integrations, PTSessions, IntegrationSettings, ReferralSettings)
- **0 new components** needed
- Total: **9 files** modified

