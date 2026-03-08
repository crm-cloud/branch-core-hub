

# Audit: Trainer Salary, Message Templates, Broadcast & Default Templates

## Issue 1: Trainer Base Salary Shows ₹0

**Root cause:** The `trainers` table column is `fixed_salary`, NOT `salary`. In `hrmService.ts` line 310, the code maps `(t as any).salary || 0` — this field doesn't exist on the trainers row, so it always returns 0.

**Fix:** Change line 310 in `fetchAllPayrollStaff()` from `(t as any).salary` to `(t as any).fixed_salary`.

## Issue 2: Message Templates Are Hardcoded Fallbacks

**Root cause:** The Communication Hub's template sheet (Announcements.tsx line 126) uses hardcoded `messageTemplates` from `src/data/messageTemplates.ts` as fallback when no DB templates exist. These hardcoded templates cannot be edited, synced, or managed.

**Fix:**
- Remove the hardcoded fallback logic entirely — only show templates from the `templates` DB table.
- Seed the `templates` table with a comprehensive set of default templates via a migration, covering all channels (SMS, Email, WhatsApp) and all triggers (welcome, renewal, joining, purchase, reminder, class booking, PT session, birthday, referral, follow-up, approval).
- The templates in Settings → Templates then become the single source of truth.

## Issue 3: Broadcast Only Supports Single Channel

**Root cause:** The `BroadcastDrawer` uses a single `Select` for channel. No multi-select or "All Channels" option exists.

**Fix:** Replace the single channel select with a multi-select (checkboxes). Add an "All Channels" option that selects WhatsApp + SMS + Email. On send, loop through selected channels and invoke `send-broadcast` for each. Show per-channel results in the success toast.

## Issue 4: Seed Comprehensive Default Templates

Insert ~30+ templates into the `templates` table covering:

| Trigger | WhatsApp | SMS | Email |
|---------|----------|-----|-------|
| Welcome / Joining | ✓ | ✓ | ✓ (HTML) |
| Membership Renewal | ✓ | ✓ | ✓ (HTML) |
| Payment Received | ✓ | ✓ | ✓ (HTML) |
| Payment Due / Reminder | ✓ | ✓ | ✓ (HTML) |
| Class Booking Reminder | ✓ | ✓ | ✓ |
| PT Session Reminder | ✓ | ✓ | - |
| Membership Expiry (7 days) | ✓ | ✓ | ✓ (HTML) |
| Birthday Wishes | ✓ | ✓ | ✓ (HTML) |
| Referral Invite | ✓ | - | - |
| Lead Follow-up | ✓ | ✓ | - |
| Approval Required | - | ✓ | ✓ |
| Freeze/Unfreeze Confirmation | ✓ | ✓ | - |
| New Class Announcement | ✓ | - | ✓ (HTML) |

Email templates will include professional HTML with inline styles (gym-branded colors, clean layout). SMS templates will be concise (<160 chars where possible). WhatsApp templates will use emoji formatting.

## Files to Change

| File | Change |
|------|--------|
| `src/services/hrmService.ts` | Fix `salary` → `fixed_salary` for trainers (line 310) |
| `src/components/announcements/BroadcastDrawer.tsx` | Replace single channel select with multi-select checkboxes + "All Channels" option; loop send per channel |
| `src/pages/Announcements.tsx` | Remove hardcoded `messageTemplates` fallback; only show DB templates |
| `src/data/messageTemplates.ts` | Can be deleted or kept as reference only (no longer imported) |
| **DB Migration** | Seed `templates` table with ~30+ default templates (SMS, Email with HTML, WhatsApp) with appropriate `type`, `trigger` (stored in `name` convention), `content`, `subject` fields |

