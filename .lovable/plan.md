# Member Portal Hardening — Round 2

End-to-end fix pass for the member-facing flows: payments, plans, requests, fitness plan visibility, booking UX, and content.

---

## 1. POS RPC `v_code_row not assigned yet` (MemberStore checkout)

**Cause:** In `create_pos_sale`, `v_code_row record` is only populated inside the `IF p_discount_code_id IS NOT NULL AND v_discount > 0` block. Later at line 178 the condition `... AND v_code_row.id IS NOT NULL` accesses the record unconditionally, which raises `record "v_code_row" is not assigned yet` whenever a checkout is made **without** a coupon — exactly what members hit on `/member-store`.

**Fix:** New migration that recreates `create_pos_sale` with a `v_coupon_loaded boolean := false` flag. Set it to `true` only when the coupon row is actually loaded, and gate the UPDATE/INSERT at line 178 on that flag instead of touching `v_code_row.id`. Also harden by initializing `v_code_row := NULL` is not allowed for `record`, so the boolean flag is the correct pattern.

---

## 2. Member-facing Purchase drawer is admin-shaped

Currently `PurchaseMembershipDrawer` shows: GST toggle, partial-payment toggle, discount amount + reason, locker selector, payment method dropdown including Cash/Card/UPI/Bank/Wallet/Razorpay-link. That is the back-office shape. Members should not see any of those.

**Fix:** Add a `mode: 'staff' | 'member'` prop (default `staff`, preserves all existing back-office screens). When `mode === 'member'`:

- Hide: GST toggle, Discount fields, Locker selector card, Partial payment card, Payment Method dropdown.
- Force `paymentMethod = 'razorpay_link'` and `isPartialPayment = false`, `discountAmount = 0`, `includeGst = false`.
- Replace footer button label with **"Pay Now"** (instead of Complete Purchase).
- After RPC success, if `redirectToCheckout`, navigate to `/member/pay?invoice=<id>` (already implemented) — but for `mode='member'` always force this redirect.
- Show a simple summary card: Plan, Start/End, Total, and "Secure online payment" microcopy with the Razorpay logo from `public/assets/payment-logos/razorpay.svg`.

`MemberPlans.tsx` will pass `mode="member"`. `MemberDashboard` and any other member-side caller too.

---

## 3. PT package purchasing for members (`/my-pt-sessions`)

Currently the page only displays sessions and shows "Contact the front desk to purchase a package". There is **no** member-facing PT purchase flow.

**Fix:**
1. New component `src/components/pt/PurchasePTPackageDrawer.tsx` (member-mode by default).
   - Lists active PT packages from `pt_packages` filtered by branch.
   - Shows price, sessions, validity.
   - Optional trainer preference (dropdown of branch trainers, optional).
   - Single CTA "Pay Now" — creates a `pos_sale`/invoice via existing `create_pos_sale` RPC OR a dedicated `purchase_pt_package` RPC if one exists; otherwise creates invoice + `member_pt_packages` row in pending state and routes to `/member/pay?invoice=<id>`.
2. `MyPTSessions.tsx`: replace the "contact front desk" empty state with a primary **"Buy PT Package"** button that opens the drawer. Also add the button in the header for renewals.
3. Backend: if no atomic RPC exists for PT purchase, add `purchase_pt_package(p_member_id, p_package_id, p_branch_id, p_trainer_id, p_payment_source, p_idempotency_key)` returning `{invoice_id, member_pt_package_id}` — mirrors `purchase_member_membership` pattern. Member PT package row stays `pending` until payment webhook flips it to `active`.

---

## 4. Re-design `/my-plans` (remove duplicate "No active membership" noise)

When there is no active membership the page currently shows:
- Top-right "Buy Membership" button
- Big alert "No active membership — Pick a plan below or talk to the front desk to get started." with "Browse plans" button
- Then the actual plan grid with "Buy plan" buttons on each card

The middle alert duplicates everything below.

**Fix:** Replace the warning Alert with a softer, smaller status strip (single line, info-tone), drop the redundant "Browse plans" CTA. Keep the header CTA. When dues exist, surface a Pay-Now ribbon at top instead.

Also align the header to a Vuexy-style hero card matching `MyDiet`/`MyWorkout` (rounded-2xl gradient, status pill).

---

## 6. `/my-diet` and `/my-workout` not showing assigned plan + request flow

**Investigation result:** The pages query `member_fitness_plans` filtered by `member_id` and `plan_type`. They render correctly when a row exists. If no plan shows for an actual assignment, the row is being written under the **wrong member id** or wrong `plan_type` casing. Need to verify the assignment writer.

**Fix:**
1. Audit `src/pages/fitness/*` create/assign flows and confirm they insert into `member_fitness_plans` with: correct `member_id` (member.id, not user_id), `plan_type` exactly `'diet'` or `'workout'`, and `status = 'active'` (some queries may need `status` filter).
2. Add `status` filter to the query (`.eq('status','active')` if column exists) so old archived plans stop hiding the active one — and broaden ordering.
3. **"Request New Plan" must create an actionable request, not a dead link.** Currently both pages link to `/my-requests`, which has no diet/workout request button.

In `MemberRequests.tsx`, add two new request cards:
- **Request New Diet Plan** → creates a `tasks` row of type `diet_plan_request`, branch-scoped, assigned to the member's `assigned_trainer_id` if present, otherwise unassigned (so any branch trainer/admin/manager can pick it up). Also writes an `approval_requests` row for tracking + appears in member's Request History.
- **Request New Workout Plan** → same flow with type `workout_plan_request`.

Both open right-side Sheets with: goal, timeframe, special notes (fields). On submit, an internal notification fires for the branch's trainers + admins.

Direct deep links: `/my-diet` and `/my-workout` "Request New Plan" buttons now open the corresponding Sheet on `/my-requests` via query param `?open=diet|workout`.

---

## 7. Merge "Book & Schedule" + "Book Benefit Slots" into a calendar-first booking page

**Fix:**
1. Make `MemberClassBooking.tsx` (`/member-class-booking`) the single entry point and rebrand it as **Book & Schedule**. It already supports filter chips (All/Recovery/Classes/PT) and a date jump popover.
2. Promote the date selection: render an inline week-view calendar strip (Mon–Sun) at the very top, with a "Pick date" popover to jump farther. Selected date drives the agenda — facilities (recovery), classes, and PT slots all load **only for that date**, instead of dumping a flat list of every available date below the fold.
3. Remove "Book Benefit Slots" sidebar entry (`/book-benefit-slot`) from the member menu in `src/config/menu.ts`. Keep the route alive but redirect to `/member-class-booking` so old links don't 404.
4. Show empty-state per-day: "Nothing scheduled for this date" with quick chips to jump to next available day.

---

## 8. Member Requests — diet & workout request actions

Covered in #6. New cards in `MemberRequests.tsx`:
- Request Diet Plan (creates task → trainer/staff)
- Request Workout Plan (creates task → trainer/staff)

Tasks are written to `tasks` table with `category = 'fitness_plan'`, `branch_id`, `priority = 'medium'`, and assigned to `member.assigned_trainer_id` (when present). Internal `notifications` rows fan out to branch admins + trainers using the existing realtime notification helper.

History list at the bottom of `/my-requests` already iterates `approval_requests` — extend `getRequestTypeLabel` to recognize the new reference types `diet_plan_request` and `workout_plan_request`.

---

## 9. `/member-announcements` shows nothing

**Investigation result:** The query is correct. The `announcements` table is currently empty for this branch, so the empty-state renders truthfully. Two parts to the fix:

1. **No code bug** — the page is working. Improve the empty state to make this obvious: show a friendly "Your gym hasn't posted anything yet — check back soon" panel with a faint illustration, instead of the current minimal message.
2. **Admin-side seeding path:** verify `/announcements` (admin page) write path actually inserts with `target_audience IN ('all','members')` and not staff-only. Currently the OR filter `target_audience.eq.all,target_audience.eq.members,target_audience.is.null` is correct. The likely real issue is the admin form defaults `target_audience` to `'staff'`. Audit `src/pages/Announcements.tsx` and the create dialog; default to `'all'` for member-visible posts and surface the audience picker prominently.

---

## Files to be Created / Edited

**New files:**
- `supabase/migrations/<ts>_fix_create_pos_sale_v_code_row.sql`
- `supabase/migrations/<ts>_purchase_pt_package_rpc.sql` (if no atomic RPC exists)
- `src/components/pt/PurchasePTPackageDrawer.tsx`

**Edited:**
- `src/components/members/PurchaseMembershipDrawer.tsx` — `mode` prop, member-only UI
- `src/pages/MemberPlans.tsx` — remove duplicate alert, pass `mode="member"`, hero header
- `src/pages/MemberDashboard.tsx` — pass `mode="member"` to drawer
- `src/pages/MyPTSessions.tsx` — Buy PT Package button + drawer wiring
- `src/pages/MyDiet.tsx`, `src/pages/MyWorkout.tsx` — robust query + deep-link Request CTA
- `src/pages/MemberRequests.tsx` — new Diet/Workout request cards + sheet handlers + URL `?open=` autoload
- `src/pages/MemberClassBooking.tsx` — calendar-first layout, week strip
- `src/pages/BookBenefitSlot.tsx` — convert to redirect to `/member-class-booking`
- `src/config/menu.ts` — remove duplicate entry, rename remaining one to "Book & Schedule"
- `src/pages/MemberAnnouncements.tsx` — improved empty state
- `src/pages/Announcements.tsx` (+ creation dialog) — default audience to `all`, prominent picker

---

## Out of Scope

- Razorpay verification flow itself (already in place via `verify-payment` and `payment-webhook`).
- Re-design of trainer/admin dashboards.
- Member-side WhatsApp request fallback (separate ticket).

Ready to implement on approval.