# Fix 4 Member Profile / Search Issues

## 1. RPC error: `column reference "branch_id" is ambiguous` in `search_command_trainers`

**Cause:** In the `RETURN QUERY` block, the function's RETURN TABLE column `branch_id` collides with `t.branch_id` inside the subquery `SELECT branch_id FROM public.user_visible_branches(v_uid)`. Postgres can't tell whether `branch_id` in that subquery references the outer OUT param or the function's own column.

**Fix (migration):** Recreate `public.search_command_trainers` qualifying the column inside the subquery:
```sql
WHERE t.branch_id IN (
  SELECT uvb.branch_id FROM public.user_visible_branches(v_uid) uvb
)
```
No signature/grant changes.

---

## 2. Registration form download returns only the signature image

**Cause:** `MemberRegistrationForm.handleSaveDigital` saves only the signature canvas (`canvas.toBlob → image/png`) into `member_documents` as the registration form. The actual rendered registration HTML is never captured.

**Fix:** In `src/components/members/MemberRegistrationForm.tsx`:
- Render the full registration form HTML to a canvas using `html2canvas` (already used elsewhere — confirm; otherwise use a lightweight `jspdf` + `html2canvas` flow).
- Composite the printed registration form + the captured signature into a single PDF (preferred) or PNG.
- Upload the composite as `Registration-{memberCode}-signed.pdf` with `contentType: 'application/pdf'`.
- Save `file_name` with `.pdf` extension and matching MIME so download/open serves the full form, not just the sig.

If `html2canvas`/`jspdf` not installed, add them. Fall back to building a printable HTML string and using `html2canvas` on a hidden render container that includes the signature dataURL embedded as `<img>`.

---

## 3. Recent Activity — group + paginate

**File:** `src/components/members/MemberProfileDrawer.tsx` (the `recentActivity` block ~line 858 and render ~line 1732).

**Changes:**
- Remove the hard `.slice(0, 12)` cap.
- Group items by date (Today / Yesterday / `dd MMM yyyy`) using `date-fns` `isToday`, `isYesterday`, `format`.
- Within each day group, also sub-group by `badge` (Check-in/out, Payment, Membership, PT) collapsed by default with a count badge — expand on click.
- Add client-side pagination: show 5 day-groups per page with Prev/Next + "Showing X–Y of Z" footer.
- Keep the realtime invalidations already wired.

Render pattern: section header per day → list of grouped activity rows → pagination control at card footer.

---

## 4. Cancel button for pending memberships in Membership History

**Context:** A queued/upcoming membership shows status `pending`. Without a way to cancel it, the member appears to have multiple obligations and may flip to overdue.

**Changes in `MemberProfileDrawer.tsx` Membership History card (~line 1507):**
- For each row where `m.status === 'pending'` (or `'scheduled'`), show a small destructive ghost `Button` "Cancel" beside the status badge.
- On click, open the existing `CancelMembershipDrawer` but pass that specific `m` instead of always `activeMembership`. Promote `cancelTarget` state to hold the selected membership; default to `activeMembership` when triggered from the action menu.
- Pending cancellation should call the same atomic RPC (`cancel_membership`) — already supports any membership_id by contract.
- After success, invalidate `['member-details', memberId]` and `['memberships']` queries so it disappears immediately.

Add a confirmation note in the drawer when target is pending: "This plan hasn't started yet — no refund will be issued unless a payment was already recorded."

---

## Files Edited
- `supabase/migrations/<new>.sql` — recreate `search_command_trainers`
- `src/components/members/MemberRegistrationForm.tsx` — full-form PDF capture
- `src/components/members/MemberProfileDrawer.tsx` — grouped paginated activity + pending cancel button
- `src/components/members/CancelMembershipDrawer.tsx` — accept any membership prop, add pending-state copy
- `package.json` — add `html2canvas`, `jspdf` if missing
