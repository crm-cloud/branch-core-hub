

# Security Hard-Lock: Maker-Checker for Transfers & Comps

## Root Cause

1. **RLS Gap**: `memberships` table has policy `Staff manage branch memberships` with `cmd: ALL` for staff — meaning staff can UPDATE `member_id` (transfer) and `end_date` (comp) directly.
2. **UI Gap**: `TransferMembershipDrawer` and `TransferBranchDrawer` perform direct `supabase.from('memberships').update(...)` regardless of the user's role. The MemberProfileDrawer shows "Request Transfer" label for staff but opens the same drawer that does a direct UPDATE.
3. **CompGiftDrawer**: Already correctly routes through `approval_requests`. No fix needed.

## Fix Plan

### 1. Database: Tighten RLS on `memberships`

Replace the single `ALL` policy with split policies:
- **SELECT**: staff + manager + admin + owner (keep existing)
- **INSERT**: staff + manager + admin + owner (new memberships)
- **UPDATE**: **only** owner, admin, manager — staff DENIED
- **DELETE**: only owner, admin

This blocks staff from directly modifying memberships at the database level.

```sql
DROP POLICY "Staff manage branch memberships" ON memberships;

CREATE POLICY "Staff insert memberships" ON memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
    AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
  );

CREATE POLICY "Management update memberships" ON memberships
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
    AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
  );

CREATE POLICY "Admin delete memberships" ON memberships
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));
```

Also add `membership_transfer` and `branch_transfer` to the `approval_type` enum.

### 2. UI: TransferMembershipDrawer — Role-Aware

- Import `useAuth` and check `hasAnyRole(['owner', 'admin', 'manager'])`.
- **If manager+**: Keep existing direct UPDATE logic (they have RLS permission).
- **If staff**: Replace mutation with `supabase.from('approval_requests').insert(...)` containing:
  ```json
  {
    "approval_type": "membership_transfer",
    "reference_id": membershipId,
    "request_data": {
      "from_member_id": memberId,
      "from_member_name": memberName,
      "to_member_id": selectedTarget.id,
      "to_member_name": selectedTarget.full_name,
      "is_chargeable": isChargeable,
      "transfer_fee": transferFee,
      "reason": reason
    }
  }
  ```
- Toast: "Transfer requested. Pending Manager Approval."
- Button text changes to "Submit for Approval" for staff.

### 3. UI: TransferBranchDrawer — Role-Aware

Same pattern:
- **Manager+**: Direct UPDATE (existing behavior).
- **Staff**: Insert `approval_request` with `approval_type: 'branch_transfer'`, payload includes `from_branch`, `to_branch`, `member_id`, `reason`.
- Toast: "Branch transfer requested. Pending Manager Approval."

### 4. ApprovalQueue: Handle New Approval Types

In `src/pages/ApprovalQueue.tsx`:
- Add `membership_transfer` and `branch_transfer` to `APPROVAL_TYPE_CONFIG`.
- In the approval mutation handler, add cases:
  - **`membership_transfer`**: Parse `request_data`, execute `memberships.update({ member_id: to_member_id })`, optionally create fee invoice, insert audit log.
  - **`branch_transfer`**: Parse `request_data`, execute `members.update({ branch_id })` + `memberships.update({ branch_id })`, insert audit log.

### 5. Also tighten `members` table

The `members` table also has an `ALL` policy for staff. Split it so staff cannot update `branch_id` directly:
- Staff: SELECT + INSERT only
- Manager+: full UPDATE

## Files to Modify

| File | Change |
|------|--------|
| DB Migration | Split `memberships` ALL → separate INSERT/UPDATE/DELETE; split `members` ALL; add enum values |
| `src/components/members/TransferMembershipDrawer.tsx` | Add role check, staff → approval insert |
| `src/components/members/TransferBranchDrawer.tsx` | Add role check, staff → approval insert |
| `src/pages/ApprovalQueue.tsx` | Handle `membership_transfer` and `branch_transfer` on approve |

## Execution Order
1. DB migration (RLS + enum)
2. TransferMembershipDrawer refactor
3. TransferBranchDrawer refactor
4. ApprovalQueue handlers

