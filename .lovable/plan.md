Plan:

1. Fix Members list status display
- Update `src/pages/Members.tsx` so a member is shown as `active` when they have an `active` membership whose `end_date` is today or later.
- Do not require `start_date <= today` for the main member status, because commercially the membership is already assigned/active.
- Keep expired/no-membership members as `inactive`, and frozen memberships as `frozen`.

2. Add “Membership yet to start” badge inline near Joined date
- Add a helper that detects: membership status is `active`, `start_date` is in the future, and `end_date` is still valid.
- In the table row, show a small amber badge near the Joined column, for example:
  - Joined: `03 May 26`
  - Badge: `Starts 23 May` / `Yet to start`
- Keep the Membership column showing the plan name and dues badge as it does now.

3. Keep MIPS/hardware access blocked before start date
- Do not enable `hardware_access_enabled` before `membership.start_date`.
- The existing access function already uses `start_date <= current_date` before enabling hardware access. I will preserve that rule so Bhagirath cannot enter before the future start date.

4. Make MIPS access turn on automatically from the start date
- Add/adjust a backend scheduled sync function that runs daily and re-evaluates member hardware access for:
  - memberships starting today,
  - memberships ending/expired,
  - frozen/overdue state changes if already covered by the access evaluator.
- This will call the existing `evaluate_member_access_state(...)` RPC so access events and MIPS sync behavior stay centralized.
- Schedule it with the existing backend scheduler alongside membership expiry automation.

5. Validate Bhagirath’s case
- Confirm Bhagirath remains:
  - Member UI status: `active`
  - Plan: `Annual Plan`
  - Badge: `Membership yet to start` / `Starts 23 May`
  - Dues: `₹14,000`
  - MIPS access: disabled until `2026-05-23`, then automatically enabled by scheduled sync.

Technical notes:
- UI changes will be in `src/pages/Members.tsx` only unless shared helpers already exist.
- Backend automation will be implemented as a database function + scheduler migration because that is structure/logic, not direct data editing.
- I will not use a migration for one-off data updates. If any existing data needs re-evaluation after the logic change, I will use the appropriate data operation tool instead.