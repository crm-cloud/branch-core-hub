

# Fix Plan: Registration Redesign, PT Purchase Bug, Comp Drawer, Query Invalidation & DB Errors

## Issues Identified

1. **PT Purchase Bug**: The `purchase_pt_package` DB function casts `_member_package_id::text` into `reference_id` which is `uuid` type. Fix: remove the `::text` cast.
2. **Missing tables**: `member_documents` and `member_comps` tables were never created (migration likely failed). Need to create them.
3. **Stale columns referenced**: `pt_packages.price_per_session` (referenced in `TrainerEarnings.tsx`) and `pt_packages.auto_renew` (referenced in `AddPTPackageDrawer.tsx`) don't exist.
4. **Registration form**: Current version is basic HTML popup. Needs redesign with government ID, fitness goals, digital signature, T&C, and all member fields.
5. **Comp/Gift drawer**: Doesn't show existing member benefits/comps before adding new ones.
6. **Query invalidation**: After membership/PT purchase, profile drawer doesn't refresh — missing invalidation keys.

---

## 1. Database Migration

**Fix `purchase_pt_package` function**: Change `_member_package_id::text` to just `_member_package_id` in the `invoice_items` insert.

**Create missing tables**:
- `member_documents` (id, member_id FK, document_type text, file_url text, file_name text, uploaded_by uuid, created_at) with RLS
- `member_comps` (id, member_id FK, membership_id FK nullable, benefit_type_id FK, comp_sessions int, used_sessions int default 0, reason text, granted_by uuid, created_at) with RLS

**No action needed for `price_per_session`/`auto_renew`** — these are code-side fixes only.

## 2. Fix TrainerEarnings.tsx

Remove `price_per_session` from the PT packages select query. Replace with computed value from `member_pt_packages.price_paid / member_pt_packages.sessions_total`.

## 3. Fix AddPTPackageDrawer.tsx

Remove `auto_renew` from form state, payload, and UI. The column doesn't exist on `pt_packages`.

## 4. Redesign MemberRegistrationForm.tsx

Complete redesign with:
- Gym logo header (uses branch name styled as brand)
- Government ID section (ID type + number fields)
- Fitness goals section
- Emergency contact details (pre-filled)
- Membership details (plan, dates, amount — pre-filled)
- Customizable Terms & Conditions
- **Digital signature**: Canvas-based signature pad (HTML5 Canvas `toDataURL()`) — member signs on screen, signature saved as image to Supabase Storage and linked to `member_documents`
- Option to still print if needed
- New date field: Registration Date (auto-filled)

The form will be a full React component (not a popup window), rendered inside a Sheet/Dialog with both "Save Digital Copy" and "Print" actions.

## 5. Enhance CompGiftDrawer.tsx

Add a section at the top showing:
- Current membership end date
- Existing plan benefits (from `plan_benefits` + `benefit_types`) with usage counts
- Any existing comps (from `member_comps`) with remaining sessions
- This gives staff context before adding new comps

For "Extend Days" tab, show current expiry date and preview new expiry date.

## 6. Fix Query Invalidation in MemberProfileDrawer

After membership purchase, PT purchase, comp grant, and payment recording — ensure all these query keys are invalidated:
- `member-details`, `member-memberships`, `active-membership`, `member-pt-packages`, `member-pending-invoices`, `member-comps`

Audit the `PurchaseMembershipDrawer`, `PurchasePTDrawer`, `CompGiftDrawer`, and `RecordPaymentDrawer` to add missing invalidation calls.

---

## Files Summary

| File | Action |
|------|--------|
| DB Migration | Fix `purchase_pt_package` RPC; create `member_documents` + `member_comps` tables with RLS |
| `src/pages/TrainerEarnings.tsx` | Remove `price_per_session` from query, compute from existing fields |
| `src/components/pt/AddPTPackageDrawer.tsx` | Remove `auto_renew` field and references |
| `src/components/members/MemberRegistrationForm.tsx` | Full redesign with govt ID, goals, digital signature canvas, customizable T&C |
| `src/components/members/CompGiftDrawer.tsx` | Show existing benefits/comps before granting new ones; show current/new expiry |
| `src/components/members/PurchasePTDrawer.tsx` | Add missing query invalidations |
| `src/components/members/MemberProfileDrawer.tsx` | Ensure all child drawers trigger proper cache invalidation |

## Execution Order

1. Database migration (fix RPC + create missing tables)
2. Fix TrainerEarnings + AddPTPackageDrawer stale column refs
3. Fix query invalidation across all purchase/comp drawers
4. Enhance CompGiftDrawer with existing benefits display
5. Redesign MemberRegistrationForm with digital signature

