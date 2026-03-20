

# Deep Audit & Fix: Comp/Gift Role Logic, Rewards Wallet, WA Templates, Profile UX

## Issues Found

### 1. CompGiftDrawer Always Routes Through Approval (BUG)
**Root cause**: `CompGiftDrawer` has no role awareness. Both admin/manager AND staff see "Submit for Approval" and insert into `approval_requests`. The `MemberProfileDrawer` correctly shows different button labels ("Comp/Gift" vs "Request Comp") but both open the same drawer that always creates an approval request.

**Fix**: Add role detection to `CompGiftDrawer`. If `isManagerOrAbove`, execute the comp/extension directly (update `end_date` on membership, or insert `member_comps`). If staff, keep the approval flow.

### 2. Rewards & Wallet End-to-End Audit
**Current state**: 
- `referralService.claimReward()` credits the wallet via `creditWallet()` — this works.
- `RecordPaymentDrawer` has a "Wallet" payment method option but it just records `payment_method: 'wallet'` — it does NOT actually debit the wallet balance.
- `payWithWallet()` in `walletService.ts` exists but is never called from the payment drawer.

**Fix**: When `payment_method === 'wallet'` is selected in `RecordPaymentDrawer`, validate wallet balance and call `payWithWallet()` instead of the manual insert. Show wallet balance in the drawer when wallet is selected.

### 3. WhatsApp Template API Audit
**Bug found**: `WhatsAppTemplateDrawer` calls `supabase.functions.invoke('send-whatsapp', { body: { phone_number, content, branch_id } })` but the edge function requires `message_id` as a mandatory field (line 18: `if (!message_id || !phone_number || !content || !branch_id)`). The template drawer never sends `message_id`, so every call returns 400.

**Fix**: Update the template drawer to first insert a record into `whatsapp_messages` table, then pass the resulting `id` as `message_id` to the edge function.

### 4. Member Profile Drawer — Overview Tab Visibility
**Issue**: The Overview tab trigger on line 935-937 has `<span className="hidden sm:inline text-xs">Overview</span>` — the label is hidden on mobile, and since it's the first tab, the `view` text appears as just an icon with no visual indication it's selected vs other icon-only tabs.

**Fix**: Always show "Overview" label (remove `hidden sm:inline`), or add `text-xs` inline label for the first tab. Also rename the tab text from the internal comment "view" to display "Overview" consistently.

### 5. Access Tab — Face Upload Redundancy
**Issue**: The `HardwareBiometricsTab` still has a manual photo upload feature for face enrollment. Per the user's architecture, face capture is now handled by the device itself. The "Upload Photo" section causes confusion between avatar and face ID.

**Fix**: Simplify the Access tab. Remove the manual photo upload section. Keep: Wiegand Code, Welcome Message, Access Toggle, and Device Sync Status. Rename the tab label from "Access" to something clearer. Add a note explaining face enrollment is handled at the terminal.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/members/CompGiftDrawer.tsx` | Add role-aware logic: managers execute directly, staff submit for approval |
| `src/components/invoices/RecordPaymentDrawer.tsx` | Integrate `payWithWallet()` when wallet payment selected |
| `src/components/communication/WhatsAppTemplateDrawer.tsx` | Insert `whatsapp_messages` record before invoking edge function |
| `src/components/members/MemberProfileDrawer.tsx` | Fix Overview tab label visibility |
| `src/components/members/HardwareBiometricsTab.tsx` | Remove manual photo upload, add device-handled note |

## Execution Order
1. CompGiftDrawer role-aware fix (critical — admin workflow broken)
2. Overview tab label visibility fix
3. HardwareBiometricsTab simplification
4. WhatsApp template drawer fix (message_id bug)
5. RecordPaymentDrawer wallet integration

