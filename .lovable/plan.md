

# Audit Findings and Fix Plan

## Issue 1: Edit Branch -- Manager Dropdown Shows "No change" Only

**Root Cause:** The `EditBranchDrawer.tsx` fetches potential managers from `user_roles` filtered by `['manager', 'admin', 'owner']`. This query works correctly. However, the dropdown shows only "No change" (as seen in screenshot) because there may be no users with `manager` role assigned yet. The actual bug is that when `currentManager` loads AFTER the `useEffect` sets `formData`, the `managerId` stays empty. The `useEffect` depends on `currentManager` but the query runs async -- the manager data arrives after the form already initialized.

**Fix:** The `useEffect` dependency on `currentManager` should properly set the `managerId` when data arrives. Currently it does depend on `currentManager`, so this should work. The real issue is the dropdown only shows users with `manager/admin/owner` roles. If the gym has staff who should manage branches, they won't appear. No code change needed for the manager pre-selection logic -- it already works. The screenshot shows the dropdown IS working (it shows "No change" as default). The user needs to assign the `manager` role to a staff member via Admin Roles page first, then that person will appear in the dropdown.

**However**, there is a UX improvement needed: show the current manager's name pre-selected instead of "No change", and add a helper text explaining what roles are eligible.

---

## Issue 2: Invoice Type Always Shows "Membership"

**Root Cause (Confirmed):** In `Invoices.tsx` line 262-264, the type badge logic is:
```tsx
{invoice.pos_sale_id ? 'POS' : 'Membership'}
```
This is a binary check -- if no `pos_sale_id`, it defaults to "Membership". But invoices can be for: Membership, Sauna/Ice Bath Top-Up, PT Package, Manual, Refund, etc. The `invoice_items.reference_type` column has values like `membership`, `membership_refund`, and the `description` field contains the actual item name (e.g., "Sauna Room M Top-Up").

**Fix:** Derive the invoice type from `invoice_items.reference_type` and `description`:
- If `pos_sale_id` exists: "POS"
- If `reference_type = 'membership_refund'`: "Refund"
- If description contains "Top-Up": "Add-On"
- If `reference_type = 'membership'`: "Membership"
- Else: "Manual"

Need to include `invoice_items` in the query join.

---

## Issue 3: Duplicate Menu Items -- "HRM" and "Employees" (All Staff)

**Root Cause (Confirmed):** In `menu.ts` lines 199-200, the Admin & HR section has BOTH:
- `HRM` -> `/hrm` (employees + contracts + payroll)
- `Employees` -> `/employees` (unified staff view with employees + trainers)

These overlap significantly. `HRM` page manages employees with contracts and payroll. `Employees` page (actually "All Staff") shows a unified view of employees + trainers.

**Fix:** Remove the `Employees` menu item. Merge the "All Staff" unified view (employees + trainers together) into the HRM page as an additional tab or as the default Employees tab. The HRM page already has Employees, Contracts, and Payroll tabs -- we just need it to also show trainers in the Employees tab (like the Employees page does).

---

## Issue 4: Staff Dashboard Missing Follow-Up Section

**Root Cause:** The `StaffDashboard.tsx` fetches `pendingLeads` count but does NOT display individual leads requiring follow-up. There's a stat card showing "Active Leads" count but no list of leads with their follow-up dates, notes, or quick actions.

**Fix:** Add a "Leads Requiring Follow-Up" card to the staff dashboard showing:
- Lead name, phone, source
- Follow-up date and status
- Quick action buttons: "Call", "Mark Contacted"
- Link to full Leads page

---

## Issue 5: Referrals & Rewards End-to-End Audit

**Current State:**
- **Admin view** (`Referrals.tsx`): Shows all referrals with referrer/referred names, codes, status. Shows rewards with claim action. This works.
- **Member view** (`MemberReferrals.tsx`): Shows referral code, copy/share link, referral history, rewards. This works.
- **Missing pieces:**
  1. No way for admin to CREATE a referral manually (when a walk-in mentions a member referred them)
  2. No referral code validation on the Auth page (the `?ref=` param isn't processed)
  3. No automatic reward generation when a referred lead converts to member
  4. The referral settings (reward amount, type) exist in Settings but aren't connected to reward auto-generation

**Fix:** 
- Add "Create Referral" button on admin Referrals page
- The `?ref=` parameter capture on Auth page needs to be wired to store the referral code during signup
- Add a trigger/RPC that creates a referral_reward when a referral status changes to 'converted'

---

## Issue 6: Benefits End-to-End for Male and Female

**Current State:** The gender filter in `MemberClassBooking.tsx` (lines 155-160) correctly filters slots by `facility.gender_access`:
```tsx
return access === 'unisex' || access === memberGender;
```
This works if: (a) facilities have `gender_access` set, and (b) member profiles have `gender` set.

**Potential issues:**
- If a member's profile has no `gender` set, they see ALL facilities (the filter passes when `memberGender` is undefined and `access !== 'unisex'` would incorrectly hide slots)
- Actually looking at the logic: if `memberGender` is null/undefined and `access = 'male'`, then `access === memberGender` is false and `access === 'unisex'` is false, so the slot is HIDDEN. This means members without gender set see ONLY unisex facilities. This is a bug -- they should see all until gender is set.

**Fix:** If member gender is not set, show all facilities (don't filter). Add a prompt for members to set their gender in profile.

---

## Issue 7: HRM Contracts -- No Document Upload or Indian Law Compliance

**Current State:** `CreateContractDrawer.tsx` creates contracts with type, dates, salary, and text-based terms. No PDF generation, no digital signature, no document upload.

**Fix (scope for this iteration):**
- Add a "Document URL" file upload field to the contract drawer (upload to storage bucket)
- Add a "Download Contract" button that generates a basic contract PDF with Indian labor law essentials (employment terms, notice period, salary breakdown)
- Digital signatures are out of scope but add a placeholder field for "Signed By" and "Signed Date"

---

## Execution Summary

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/pages/Invoices.tsx` | Fix invoice type badge: join `invoice_items`, derive type from `reference_type`/`description` |
| 2 | `src/config/menu.ts` | Remove duplicate "Employees" menu item from admin menu |
| 3 | `src/pages/HRM.tsx` | Merge trainers into the Employees tab (unified staff view) |
| 4 | `src/components/branches/EditBranchDrawer.tsx` | Pre-select current manager in dropdown, add helper text |
| 5 | `src/pages/StaffDashboard.tsx` | Add "Leads to Follow Up" card with lead details and quick actions |
| 6 | `src/pages/MemberClassBooking.tsx` | Fix gender filter: show all facilities when gender not set |
| 7 | `src/pages/Referrals.tsx` | Add "Create Referral" button for manual referral creation |
| 8 | `src/components/hrm/CreateContractDrawer.tsx` | Add document upload field for contract attachments |

