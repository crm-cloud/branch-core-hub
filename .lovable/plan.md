

# Fix: Member Profile UX, Trainer Assignment, Record Payment Scroll, and Rewards Audit

## Issues Found

### 1. Record Payment — Scroll Issue
`RecordPaymentDrawer.tsx` line 131: `SheetContent` is missing `overflow-y-auto`. Content overflows without scrolling on smaller screens.

### 2. Assign Trainer — Two Bugs
**Bug A**: `MemberProfileDrawer.tsx` line 1318-1324 does NOT pass `currentTrainerId` prop to `AssignTrainerDrawer`. This means:
- The drawer never shows which trainer is "Current"
- The `useEffect` reset always sets `selectedTrainerId` to `''`

**Bug B**: `AssignTrainerDrawer.tsx` line 91: When user selects "No Trainer Assigned" (value `'none'`), the mutation sends `assigned_trainer_id: 'none'` (a truthy string, not null). This tries to write an invalid UUID to the database. Fix: explicitly check for `'none'` or empty.

### 3. Icon-Only Quick Action Buttons — No Labels
Lines 788-851 of `MemberProfileDrawer.tsx` render icon-only buttons (Snowflake, UserCog, Ruler, XCircle, UserMinus). Users cannot understand what they do without hovering for tooltips. Replace with labeled buttons matching 2026 UX standards.

### 4. Assigned Trainer Not Shown in Profile
The member profile drawer never displays the assigned trainer name. Need to:
- Fetch assigned trainer profile name
- Display it in the Overview tab
- Change the "Assign Trainer" button to "Change Trainer" when one is already assigned

### 5. Rewards Program Audit
Current state:
- Rewards are generated when a referral converts (in `PurchaseMembershipDrawer`)
- Claiming credits the member's wallet via `walletService.creditWallet`
- BUT: wallet balance is NOT usable in POS or renewals — POS uses only cash/card/UPI/bank_transfer, no "wallet" payment flow
- The `MemberStore.tsx` has a separate reward claim that doesn't use `walletService`

Fixes needed:
- POS: Add wallet payment option that checks/deducts wallet balance
- Renewals (PurchaseMembershipDrawer): Add wallet payment option
- MemberStore: Use `walletService.debitWallet` instead of just marking claimed
- Show wallet balance in member profile

---

## Implementation Plan

### Files to Change

| File | Changes |
|------|---------|
| `src/components/invoices/RecordPaymentDrawer.tsx` | Add `overflow-y-auto` to SheetContent |
| `src/components/members/MemberProfileDrawer.tsx` | Pass `currentTrainerId` to AssignTrainerDrawer; replace icon-only buttons with labeled buttons; add assigned trainer display card in Overview; show wallet balance |
| `src/components/members/AssignTrainerDrawer.tsx` | Fix `'none'` value handling in mutation to send `null` |
| `src/pages/POS.tsx` | Add "Wallet" payment method with balance check + debit flow |
| `src/components/members/PurchaseMembershipDrawer.tsx` | Add wallet payment option for renewals |
| `src/pages/MemberStore.tsx` | Use `walletService` for proper wallet debit on reward redemption |

### Key Details

**Trainer display in profile** — Add a query for trainer profile name using `member.assigned_trainer_id` → `trainers.user_id` → `profiles.full_name`. Show as a card in Overview tab with "Change Trainer" action.

**Quick action buttons** — Replace grid of icon-only buttons with a 2-column grid of compact labeled buttons:
```
[Freeze Membership]  [Assign Trainer]
[Record Body]        [Cancel Plan]
[Deactivate]
```

**POS wallet integration** — When payment method is "wallet", fetch member's wallet balance, validate sufficient funds, call `debitWallet()` on checkout, and create the POS sale with `payment_method: 'wallet'`.

**AssignTrainer fix**:
```typescript
// Line 91 fix
const trainerId = selectedTrainerId === 'none' || !selectedTrainerId ? null : selectedTrainerId;
const { error } = await supabase.from('members').update({ assigned_trainer_id: trainerId }).eq('id', memberId);
```

