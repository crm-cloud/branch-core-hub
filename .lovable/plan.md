

# Trainer Assignment, Fitness Plans, Progress & Earnings Overhaul

## 1. Trainer Assignment — General vs Personal Training

**Current state:** `AssignTrainerDrawer` only does "General Training Assignment" (sets `members.assigned_trainer_id`). PT requires separate purchase via `PurchasePTDrawer`. Both work independently but the UI doesn't clarify the distinction.

**Fix:**
- Rename the drawer subtitle from "General Training Assignment" to show the assignment type clearly
- Add an info card explaining: "General trainer guides your overall gym experience. For Personal Training sessions, purchase a PT package separately."
- Ensure that when a PT package is purchased (`PurchasePTDrawer`), it also updates `members.assigned_trainer_id` if not already set (auto-link)
- In `PurchasePTDrawer`, after successful purchase, invalidate `trainers-utilization` query so trainer client counts update
- Add `pt_share_percentage` display in PT purchase flow so admin sees what commission the trainer earns

## 2. AI Fitness — Restrict to Admin/Owner Only, Enhance Trainer Manual Plan Creation

**Current state:** AI Fitness page is available to trainers and managers. Members can see workout/diet through MyWorkout/MyDiet but can't generate plans.

**Fix:**
- Remove `trainer` and `manager` from AI Fitness route in `App.tsx` — only `owner` and `admin` can generate AI plans
- Remove `AI Fitness` from `trainerMenuConfig` and `managerMenuConfig` in `menu.ts`
- Create a new **Trainer Plan Builder** page (`/trainer-plan-builder`) for trainers to manually create workout and diet plans:
  - **Workout tab**: Day-wise plan builder (Day 1, Day 2... Day 7) with exercise name, sets, reps, rest time, equipment, notes per exercise
  - **Diet tab**: Meal-wise plan (Breakfast, Mid-Morning, Lunch, Evening Snack, Dinner, Pre/Post Workout) with food items, quantity, calories, protein, carbs, fats, fiber per item, meal time
  - Save as template or assign directly to a client
  - Trainer can view their clients and assign/override plans
- Add "Trainer Plan Builder" to `trainerMenuConfig` under Training section
- Keep existing `AssignPlanDrawer` for assigning templates to members

## 3. Member Progress — Record & View with Photos

**Current state:** `RecordMeasurementDrawer` exists and supports photos. `MeasurementProgressView` shows measurement history. But trainers have no direct access to record measurements for their clients from the MyClients page.

**Fix:**
- Add "Record Progress" button to each client card in `MyClients.tsx` that opens `RecordMeasurementDrawer`
- Add "View Progress" button that opens a drawer/dialog showing `MeasurementProgressView` for that client
- In the member's `MyProgress` page, add a photo gallery section that shows uploaded progress photos with dates (front/side/back comparison view)

## 4. Global Plans vs Custom Plans — Plan Assignment Architecture

**Current state:** Plans are stored in `member_fitness_plans` (assigned) and `fitness_plan_templates` (templates). The workout shuffler generates daily workouts from a static exercise library. No clear distinction between "global/default" and "custom/override" plans.

**Fix:**
- Add a "Plan Library" page accessible to admin/owner (`/plan-library`) that manages global workout and diet plan templates
- When a trainer assigns a custom plan to a member, it overrides any global plan
- In `MyWorkout`/`MyDiet` member pages, check for custom plan first; if none, fall back to global plan
- Add `is_override` flag or `priority` field to `member_fitness_plans` to distinguish custom from global
- The workout shuffler continues to work as a daily variety engine, but assigned plans take precedence

## 5. Trainer Earnings — PDF Download (Payslip)

**Current state:** `TrainerEarnings.tsx` shows monthly stats, session list, and commission totals. No PDF download.

**Fix:**
- Add a "Download Payslip" button to the earnings page header
- Generate a branded PDF using the existing `pdfGenerator` utility containing:
  - Trainer name, month, branch
  - Base salary (from `trainers.salary` or `trainers.hourly_rate`)
  - Session breakdown (count, rate, total)
  - Commission breakdown (PT package sales)
  - Total earnings
  - Deductions placeholder
  - Net payable
- Style as a professional payslip with gym branding

---

## Files to Change

| File | Change |
|------|--------|
| `src/App.tsx` | Restrict AI Fitness to `owner`/`admin`, add route for trainer plan builder |
| `src/config/menu.ts` | Remove AI Fitness from trainer/manager menus, add Trainer Plan Builder to trainer menu |
| `src/pages/MyClients.tsx` | Add "Record Progress" and "View Progress" buttons per client |
| `src/components/members/PurchasePTDrawer.tsx` | Auto-set `assigned_trainer_id`, invalidate trainer queries, show commission info |
| `src/components/members/AssignTrainerDrawer.tsx` | Add info card explaining General vs PT training |
| `src/pages/TrainerEarnings.tsx` | Add PDF payslip download with full breakdown |
| **New:** `src/pages/TrainerPlanBuilder.tsx` | Trainer manual plan builder (workout day-wise + diet meal-wise with macros) |
| `src/pages/MyWorkout.tsx` | Priority: custom assigned plan > global plan > shuffler |
| `src/pages/MyDiet.tsx` | Priority: custom assigned plan > global plan |

## Execution Order

1. Fix AI Fitness access (restrict to admin/owner)
2. Build Trainer Plan Builder page (workout + diet manual creation)
3. Add progress recording/viewing to MyClients
4. Enhance AssignTrainerDrawer + PurchasePTDrawer
5. Add payslip PDF download to TrainerEarnings
6. Implement plan priority logic (custom > global > shuffler)

