

# Multi-Issue Fix: Stale Data, WhatsApp Setup, HRM Audit, Cmd+K Position, Plan Benefits Alignment

## Issues Found

### 1. Pages Require Refresh to See Changes
**Root cause**: `refetchOnWindowFocus: false` in `App.tsx` line 106, combined with `staleTime: 5 minutes`. After mutations, `queryClient.invalidateQueries` works — but if a user switches tabs and comes back, data stays stale for 5 minutes.

**Fix**: Change `refetchOnWindowFocus: false` → `refetchOnWindowFocus: true` in the global QueryClient config. This is safe — React Query deduplicates refetches and only refetches if data is stale. Combined with the 5-min staleTime, it won't cause excessive requests.

### 2. WhatsApp Business API Setup Guide
**Fix**: Add a setup guide section inside `IntegrationSettings.tsx` under the WhatsApp tab. This will include step-by-step instructions for:
- Creating a Meta Business Account
- Setting up WhatsApp Business API via Meta Developer Portal
- Generating a permanent access token
- Configuring the webhook URL (pointing to our edge function)
- Testing with a test message

This is a UI-only addition — a collapsible guide panel with clear steps and links.

### 3. HRM/Payroll Audit
**Analysis**: The payroll calculation logic in `hrmService.ts` is correct:
- Pro-rated salary = (baseSalary / workingDays) × daysPresent
- PT commissions fetched from `trainer_commissions` by `release_date` range
- PF deduction = 12% of pro-rated pay

**Potential issue**: `processPayroll` mutation (line 180-186) only shows a toast — it doesn't actually persist anything to the database. There's no `payroll_records` table. This means payroll is display-only with no audit trail.

**Fix**: The payroll calculation is functionally correct. The "broken" perception is likely because staff attendance records are missing (no check-ins recorded = 0 days present = ₹0 payroll). No code change needed for the calculation logic itself; the attendance recording pipeline is the real dependency.

### 4 & 5. WhatsApp Business API — Chat Flow & Message Sending
**Problem**: The WhatsApp chat page (`WhatsAppChat.tsx`) only inserts messages into `whatsapp_messages` table with `status: 'pending'` — there's no edge function that picks up pending messages and sends them via WhatsApp Business API. Messages are recorded but never actually sent.

**Fix**: Create a `send-whatsapp` edge function that:
1. Reads the WhatsApp Business API credentials from `integration_settings`
2. Sends the message via the Meta Cloud API (`graph.facebook.com/v18.0/{phone_number_id}/messages`)
3. Updates the message status to `sent`/`delivered`/`failed`
4. Update `WhatsAppChat.tsx` sendMessage mutation to invoke this edge function after inserting the record

### 6. Live Access Feed — Real-time Attendance Table
**Current state**: `LiveAccessLog` already subscribes to realtime on `access_device_events` table. The component works correctly.

**Issue**: The Live Access Feed should also show member attendance check-ins (not just device events). Need to integrate with `member_attendance` table and add realtime subscription for it.

**Fix**: Add a realtime subscription for `member_attendance` table alongside the existing `access_device_events` subscription. Also ensure the `member_attendance` table is added to the `supabase_realtime` publication via migration.

### 7. Cmd+K Popup Position Wrong
**Problem**: From the screenshot, the `CommandDialog` appears shifted/misaligned. The `DialogContent` in `command.tsx` line 29 uses default dialog positioning which should center it — but looking at the screenshot it appears to be positioned behind other elements or offset.

**Fix**: Add explicit positioning classes to the `CommandDialog`'s `DialogContent`: ensure `top-[20%]` centering and `z-[100]` to stay above other overlays.

### 8. Edit Plan Benefits Not Aligned with Add Plan Benefits
**Problem**: `AddPlanDrawer` uses a clean "select from dropdown → add to list → configure" pattern with removable benefit cards. `EditPlanDrawer` uses a different checkbox-based pattern with radio buttons for unlimited/limited. These should be consistent.

**Fix**: Refactor `EditPlanDrawer` benefits section to match `AddPlanDrawer`'s UI pattern:
- Replace checkbox list with the same dropdown-to-add + card-with-remove pattern
- Use the same Select for unlimited/limited toggle
- Keep the "Add Custom" button but move it to Settings link like AddPlan does (or keep both)

---

## Files to Change

| File | Change |
|------|--------|
| `src/App.tsx` | Set `refetchOnWindowFocus: true` |
| `src/components/ui/command.tsx` | Fix DialogContent positioning with explicit z-index and top alignment |
| `src/components/settings/IntegrationSettings.tsx` | Add WhatsApp setup guide collapsible section |
| `src/components/plans/EditPlanDrawer.tsx` | Refactor benefits UI to match AddPlanDrawer pattern |
| `src/pages/WhatsAppChat.tsx` | Update sendMessage to invoke send-whatsapp edge function |
| `supabase/functions/send-whatsapp/index.ts` | New — edge function to send WhatsApp messages via Business API |
| DB Migration | Add `member_attendance` to `supabase_realtime` publication |
| `src/components/devices/LiveAccessLog.tsx` | Add member_attendance realtime subscription |

## Execution Order

1. `refetchOnWindowFocus: true` (instant fix for stale data)
2. Cmd+K positioning fix
3. Edit Plan benefits alignment
4. WhatsApp setup guide
5. WhatsApp send edge function + chat integration
6. Live Access realtime for member_attendance

