

# Fix Plan: Comp Approvals, Avatar Bug, PDF Templates, Branch Transfer & DB Errors

## Issues Identified

1. **Comp/Gift needs approval workflow** — Currently inserts directly into `member_comps` with no approval gate. The existing `approval_requests` table should be leveraged.
2. **Member avatars not showing** — Root cause: the `member-photos` storage bucket is **private**, but avatar URLs use the public URL pattern (`/object/public/member-photos/...`). Images stored there (Jessica Lekhari, Bhagirath Gurjar, etc.) return 404. Fix: make the bucket public.
3. **No PDF download on saved templates** — The Templates Library tab in `/ai-fitness` has Assign and Delete buttons but no Download PDF button.
4. **No Member Transfer UI** — No way to move a member (and their data) from one branch to another.
5. **No Membership Transfer UI** — No way to transfer a membership from one member to another.
6. **`member_documents` 404 error** — The table exists in DB and types, but code uses `(supabase as any)` cast. This is likely a schema cache delay or the cast itself causing issues. Fix: remove unnecessary `as any` casts since the table is in the types.
7. **"Invalid time value" crash on /members** — The `search_members` RPC doesn't return `created_at`, so `row.created_at` is undefined. `format(new Date(undefined))` throws. Fix: guard the date formatting.

---

## 1. Comp/Gift Approval Workflow

**Current**: `CompGiftDrawer` inserts directly into `member_comps` / calls `addFreeDays`.

**Fix**: Route comp/gift requests through the existing `approval_requests` system:
- When staff grants comp days or sessions, instead of directly applying, insert an `approval_request` with `approval_type = 'comp_gift'`, `reference_type = 'member_comps'`, and store the comp details in `request_data` JSONB.
- Only owners/admins can approve from the Approval Queue page.
- On approval, the system applies the comp (insert into `member_comps` or call `addFreeDays`).
- The membership registration form will show the comp/gift history for audit trail.

**Database migration**: Add `'comp_gift'` to the `approval_type` enum if not already present.

**Files**:
- `src/components/members/CompGiftDrawer.tsx` — Change mutations to create approval requests instead of direct inserts
- `src/pages/ApprovalQueue.tsx` — Handle `comp_gift` approval type, apply comp on approval
- DB migration for enum update

## 2. Avatar Fix — Make `member-photos` Bucket Public

**Root cause**: `member-photos` bucket is private. Some member avatars were uploaded there using the public URL pattern, so images return 404/403.

**Fix**: Use the Supabase storage tool to make the `member-photos` bucket public. This is the simplest fix since avatar photos are not sensitive.

No code changes needed — just a storage bucket configuration update.

## 3. PDF Download for Saved Templates

**Fix in `src/pages/AIFitness.tsx`** (line ~798-805):
- Add a Download PDF button next to the Delete button on each saved template card
- Call `generatePlanPDF({ name: template.name, type: template.type, data: template.content })` on click

## 4. Member Branch Transfer UI

**New component: `src/components/members/TransferBranchDrawer.tsx`**:
- Sheet drawer with branch selector (destination branch)
- Shows current member details, current branch
- Transfer reason field
- On submit: updates `members.branch_id`, updates active `memberships.branch_id`, creates audit log entry
- Accessible from Member Profile Drawer actions menu

**Files**:
- `src/components/members/TransferBranchDrawer.tsx` — New
- `src/components/members/MemberProfileDrawer.tsx` — Add Transfer Branch action button

## 5. Membership Transfer UI

**New component: `src/components/members/TransferMembershipDrawer.tsx`**:
- Sheet drawer to transfer active membership from current member to another member
- Member search for destination member
- Option: free transfer or chargeable (with amount field)
- On submit: update `memberships.member_id` to new member, optionally create invoice for transfer fee
- Creates audit log for compliance

**Files**:
- `src/components/members/TransferMembershipDrawer.tsx` — New
- `src/components/members/MemberProfileDrawer.tsx` — Add Transfer Membership action button

## 6. Fix `member_documents` 404 & Remove `as any` Casts

The table exists in types. Remove `(supabase as any)` casts in:
- `src/components/members/DocumentVaultTab.tsx` (lines 36, 63, 84)
- `src/components/members/MemberRegistrationForm.tsx` (line 158)
- `src/components/members/CompGiftDrawer.tsx` (line 173)

Replace with plain `supabase.from('member_documents')` / `supabase.from('member_comps')`.

## 7. Fix "Invalid time value" Crash on /members

**In `src/pages/Members.tsx`**:
- Line 70: `search_members` RPC doesn't return `created_at`. Fix the RPC mapping: set `joined_at: null` (or don't set it) since the RPC doesn't return this field.
- Line 477: Add safety guard: `member.joined_at && !isNaN(new Date(member.joined_at).getTime()) ? format(...) : '--'`

---

## Files Summary

| File | Action |
|------|--------|
| DB Migration | Add `comp_gift` to `approval_type` enum |
| Storage | Make `member-photos` bucket public |
| `src/components/members/CompGiftDrawer.tsx` | Route through approval workflow; remove `as any` casts |
| `src/pages/ApprovalQueue.tsx` | Handle `comp_gift` approval type |
| `src/pages/AIFitness.tsx` | Add Download PDF button on saved template cards |
| `src/components/members/TransferBranchDrawer.tsx` | **New** — Member branch transfer |
| `src/components/members/TransferMembershipDrawer.tsx` | **New** — Membership transfer between members |
| `src/components/members/MemberProfileDrawer.tsx` | Add Transfer Branch & Transfer Membership actions |
| `src/components/members/DocumentVaultTab.tsx` | Remove `as any` casts |
| `src/components/members/MemberRegistrationForm.tsx` | Remove `as any` casts |
| `src/pages/Members.tsx` | Fix `joined_at` mapping for search results; guard date formatting |

## Execution Order

1. Fix "Invalid time value" crash (Members page unblocking)
2. Fix avatar bucket (make `member-photos` public)
3. Remove `as any` casts for `member_documents` / `member_comps`
4. Add PDF download to AI Fitness templates
5. Comp/Gift approval workflow
6. Branch Transfer UI
7. Membership Transfer UI

