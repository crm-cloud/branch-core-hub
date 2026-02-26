

# Audit Findings & Fix Plan

## Issues Identified

### Issue 1: Trainer can create PT packages — should be admin/manager only
The PT Sessions page (`/pt-sessions`) has a "Create Package" button visible to all roles including trainers. The route allows `trainer` access. The `PTSessionsPage` renders the create button unconditionally without role check.

**Fix:** Add role check in `PTSessionsPage` — only show "Create Package" button for `owner`, `admin`, `manager`. Trainers should still view packages/sessions but not create them.

### Issue 2: Trainer dashboard shows 0 clients — only PT clients, not general clients
`useTrainerData()` fetches clients from `member_pt_packages` only (line 259). There are no active PT packages in DB (`member_pt_packages` is empty). But there IS a member (Jessica Lekhari) with `assigned_trainer_id` pointing to the trainer. General training clients are completely ignored.

**Fix:** Update `useTrainerData()` to fetch TWO types of clients:
- **General clients**: members where `assigned_trainer_id = trainer.id`
- **PT clients**: from `member_pt_packages` where `trainer_id = trainer.id` and `status = 'active'`

Return both lists separately so the dashboard and MyClients can show them distinctly.

### Issue 3: Trainer dashboard still links to `/ai-fitness` instead of Plan Builder
Line 113 in `TrainerDashboard.tsx` links to `/ai-fitness` for "Create Fitness Plan" quick action. This route is now restricted to owner/admin.

**Fix:** Change link from `/ai-fitness` to `/trainer-plan-builder`.

### Issue 4: Global plans not visible to members
`fitness_plan_templates` table is empty — no global plans exist yet. But even if they did, `MyWorkout.tsx` doesn't query `fitness_plan_templates` or `member_fitness_plans` for assigned plans. It only uses the workout shuffler.

**Fix:** In `MyWorkout.tsx`, add a query for `member_fitness_plans` (custom assigned plans) AND `fitness_plan_templates` (global/public plans). Show assigned plans with priority over shuffler. Add a tab or section for "My Assigned Plan" vs "Daily Shuffle".

### Issue 5: MyClients only shows PT clients, not general training clients
Same root cause as Issue 2. The page only renders clients from `useTrainerData().clients` which only queries `member_pt_packages`.

**Fix:** After fixing `useTrainerData()`, update `MyClients.tsx` to show two sections: "General Training Clients" and "Personal Training Clients".

---

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useMemberData.ts` | In `useTrainerData()`, add query for general clients (`members.assigned_trainer_id`). Return `generalClients` + `ptClients` separately |
| `src/pages/TrainerDashboard.tsx` | Show general + PT client counts separately; fix quick action link from `/ai-fitness` to `/trainer-plan-builder` |
| `src/pages/MyClients.tsx` | Show two sections: General Training Clients and PT Clients |
| `src/pages/PTSessions.tsx` | Hide "Create Package" button for trainers (only show for admin/manager/owner) |
| `src/pages/MyWorkout.tsx` | Add query for assigned plans (`member_fitness_plans`), show assigned plan tab with priority over shuffler |

## Execution Order
1. Fix `useTrainerData()` to fetch general + PT clients
2. Update TrainerDashboard and MyClients to show both client types
3. Fix quick action link and PT package creation access
4. Add assigned plan display to MyWorkout

