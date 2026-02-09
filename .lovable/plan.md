
# Bug Fixes, Inventory Sync, Fitness Goals & Workout Shuffler Plan

---

## Issue 1: Approvals Page Crash (Critical Bug)

**Root Cause:** Lines 223 and 386 in `ApprovalQueue.tsx` call `format(new Date(data.startDate), ...)` and `format(new Date(request.created_at), ...)` without null checks. When `request_data` fields like `startDate` or `endDate` are null/undefined, `new Date(undefined)` produces "Invalid Date", causing the RangeError.

**Fix in `src/pages/ApprovalQueue.tsx`:**
- Wrap ALL `format(new Date(...))` calls in a safe helper function
- Create a `safeFormatDate` utility that returns 'Pending' or '-' for null/undefined values
- Apply to lines 223 (freeze period dates), 386 (created_at), and any reviewed_at references

```text
Helper function:
  safeFormatDate(value, formatStr, fallback = '-')
    if value is null/undefined -> return fallback
    try parse and format -> return formatted string
    catch -> return 'Invalid Date'
```

**Lines to fix:** 223, 386

---

## Issue 2: Store & Inventory Sync (POS Low Stock Warnings)

**Current State:** POS page (`POS.tsx`) fetches products but does NOT join the `inventory` table. No stock quantity is displayed or validated.

**Fix in `src/pages/POS.tsx`:**
- Modify product query (line 33) to join inventory: `products.select('*, product_categories(name), inventory(quantity, min_quantity)')`
- In the product card grid, add a yellow "Low Stock" badge when `inventory[0]?.quantity < (inventory[0]?.min_quantity || 5)`
- In `addToCart`, validate that requested quantity does not exceed available stock
- Show "Out of Stock" overlay and disable click when quantity is 0
- Show remaining stock count in cart items

**Lines to modify:** 30-46 (query), 301-327 (product cards), 170-179 (addToCart validation)

---

## Issue 3: Member Onboarding - Fitness Goals Dropdown

**Current State:** The `members` table already has a `fitness_goals` TEXT column. The `AddMemberDrawer` has a free-text Textarea for fitness goals (line 345-353). The `EditProfileDrawer` does NOT have a fitness goals field at all.

**Changes:**

**3a. `src/components/members/AddMemberDrawer.tsx` (line 345-353):**
- Replace the Textarea with a Select dropdown offering: 'Weight Loss', 'Muscle Gain', 'Endurance', 'General Fitness', 'Flexibility', 'Body Recomposition'
- Keep it as a required field

**3b. `src/components/members/EditProfileDrawer.tsx`:**
- Add fitness_goals to the formData state (line 25-31)
- Add a Select dropdown in the form for fitness goals
- Include fitness_goals in the profile update mutation

**3c. Edge function `create-member-user`:**
- Verify it already passes `fitnessGoals` to the members table insert (it does based on AddMemberDrawer code)

---

## Issue 4: Workout Shuffler UI on MyWorkout Page

**Current State:** `MyWorkout.tsx` shows a static trainer-assigned workout plan. The `workoutShufflerService.ts` exists with the seeded shuffle algorithm but is NOT used anywhere.

**Changes in `src/pages/MyWorkout.tsx`:**

Replace the current page with a dual-mode view:
1. **"Today's Workout" tab** - Uses the shuffler service to generate a daily randomized workout
   - Fetches member's fitness_goals from member data
   - Maps fitness goal to target muscle group for the day (using day-of-week split)
   - Calls `generateDailyWorkout(memberId, targetMuscle)` from workoutShufflerService
   - Displays exercises as interactive cards with "Mark as Done" toggle buttons
   - Shows a "Shuffle" button that regenerates (uses a different seed suffix)
   - Shows equipment type badges on each exercise

2. **"My Plan" tab** - Keeps the existing trainer-assigned plan view (current code)

**Data flow:**
```text
Member opens My Workout
  -> Get member.fitness_goals (e.g., "Muscle Gain")
  -> Get day of week -> map to target muscle (from DEFAULT_WEEKLY_SPLIT)
  -> Call generateDailyWorkout(memberId, targetMuscle)
  -> Display shuffled exercises with equipment info
  -> "Shuffle" button appends counter to seed for re-roll
```

**Fitness Goal to Exercise Priority Mapping:**
- Weight Loss: prioritize cardio, bodyweight, higher rep exercises
- Muscle Gain: prioritize barbell, dumbbell, machine exercises
- Endurance: prioritize cardio, bodyweight
- General Fitness: balanced mix of all equipment types

---

## Issue 5: System Health Check

**Create `SYSTEM_HEALTH_CHECK.md`** at project root with a checklist of critical workflows and their data integrity status based on audit findings.

---

## Files Summary

### Files to Modify (5)

| File | Changes |
|------|---------|
| `src/pages/ApprovalQueue.tsx` | Add safeFormatDate helper, wrap all date formatting calls |
| `src/pages/POS.tsx` | Join inventory table, add low stock badges, validate stock on add-to-cart |
| `src/components/members/AddMemberDrawer.tsx` | Replace fitness goals Textarea with Select dropdown |
| `src/components/members/EditProfileDrawer.tsx` | Add fitness_goals Select field to edit form |
| `src/pages/MyWorkout.tsx` | Add daily shuffler tab using workoutShufflerService |

### Files to Create (1)

| File | Description |
|------|-------------|
| `SYSTEM_HEALTH_CHECK.md` | Critical workflow checklist and audit status |

### No Database Changes Required
- `fitness_goals` column already exists on `members` table
- `exercises` table already created and seeded
- `workoutShufflerService.ts` already implemented

---

## Technical Details

### Safe Date Formatter (ApprovalQueue)
```typescript
const safeFormatDate = (value: any, fmt: string = 'dd MMM yyyy', fallback: string = '-') => {
  if (!value) return fallback;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return fallback;
    return format(date, fmt);
  } catch {
    return fallback;
  }
};
```

### POS Inventory Query Enhancement
```typescript
// Change from:
.select('*, product_categories(name)')
// To:
.select('*, product_categories(name), inventory(quantity, min_quantity, branch_id)')
```

### Workout Shuffler Integration
```typescript
import { generateDailyWorkout, DEFAULT_WEEKLY_SPLIT } from '@/services/workoutShufflerService';

// Map day of week to muscle group
const today = new Date().getDay(); // 0=Sun, 1=Mon...
const todaySplit = DEFAULT_WEEKLY_SPLIT[(today + 6) % 7]; // Adjust for Mon=0

// Generate workout
const workout = await generateDailyWorkout(member.id, todaySplit.targetMuscle);

// For "Shuffle" button - append counter to force different seed
const [shuffleCount, setShuffleCount] = useState(0);
// Modified seed in service would be: `${memberId}-${today}-${targetMuscle}-${shuffleCount}`
```
