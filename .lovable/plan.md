## Audit findings (recap)

The hardware-failure fallback exists — it's the **"Staff Check-in" tab** in `/attendance-dashboard`, backed by atomic `staff_check_in` / `staff_check_out` RPCs. Data path is healthy. The screenshots show "0" because:
1. The big top search bar is **member-only** — typing a staff name ("Ritesh Sharma", "Bhagirath") returns "No members found", so users assume the system is broken.
2. Self-check-in is (correctly) disabled, but there is no clear hierarchy UI telling a manager / admin where to record the punch.
3. `/staff-attendance` redirects to `/attendance-dashboard`, so the deprecated self-service page is no longer reachable (good — matches your policy).

---

## Hierarchy policy (locked in, per your direction)

**Nobody marks their own attendance. Everyone — including owner/admin — must pass the turnstile (biometric).**
The manual flow on `/attendance-dashboard` is a **biometric-failure fallback only**, and it must enforce a strict "punch up" rule:

| Actor (logged-in user) | Can manually check in / out |
|---|---|
| Owner | Admin · Manager · Staff · Trainer (NOT self) |
| Admin | Manager · Staff · Trainer (NOT self, NOT other admins, NOT owner) |
| Manager | Staff · Trainer in same branch (NOT self, NOT other managers, NOT admin/owner) |
| Staff / Trainer | nobody (no access to this tab) |

Self-row is always disabled with helper text "Your attendance must be recorded by a higher authority."
Owner's row is only actionable by another owner (effectively requires a second owner present).

---

## Plan

### A. Fix the misleading top search bar
- Add a **mode toggle** above the search input: `Members` ⇄ `Staff` (drives `activeTab`).
- Placeholder + empty-state copy switch with the mode ("Search staff by name or code…" / "No staff found for '<query>'").
- Staff mode is only shown to roles that can record staff attendance (owner / admin / manager).

### B. Enforce the hierarchy in the Staff Check-in tab
- Replace the current single guard (`canRecordStaff` + manager-self block) with a per-row `canRecordFor(actorRoles, targetRoles, isSelf)` helper.
- Implement the matrix above. Disabled rows show the reason inline ("Only an owner can record this", "Self-attendance not allowed", etc.).
- Add a small **"Hierarchy"** info chip at the top of the tab that opens a popover explaining who-can-punch-whom, so the rule is discoverable.
- Each manual entry continues to write through `staff_check_in` RPC and is tagged `Manual` in the source column (already audited).

### C. Banner on the Staff Check-in tab
> "Use only when the biometric turnstile is offline. Every entry is audited and tied to your user."

### D. Optional hardening (recommend, ask before building)
- Require a short **reason** (free text, ≥ 5 chars) when manually checking someone in — stored in `staff_attendance.notes`. Forces accountability.
- Auto-notification (in-app / WhatsApp) to the target user "Your attendance was recorded by <actor> at <time>" so any misuse surfaces immediately.

### Not building
- Self check-in for any role (per your direction).
- Any change to `MyAttendance` / member-side flows.

### Files to edit
- `src/pages/AttendanceDashboard.tsx` — mode toggle, copy fixes, hierarchy matrix, info popover, banner, optional reason field.
- `src/lib/auth/permissions.ts` — add `canRecordAttendanceFor(actorRoles, targetRoles)` helper so the rule is reusable and testable.

No DB migration. No RPC change. No new dependencies.

### Open question
Do you want the optional **reason field + target-user notification** (section D) included now, or keep the change scoped to A-B-C only?
