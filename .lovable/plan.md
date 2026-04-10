

# WhatsApp CRM: Notifications Reorganization, Chat Fixes & Meta v25.0 Upgrade

## Summary

Move Lead Notification Rules to the Notifications tab, fix chat deletion (missing RLS DELETE policy), upgrade Meta API to v25.0, and improve chat bubble wrapping.

---

## Epic 1: Move Lead Notification Rules to Notifications Tab

**Problem:** `LeadNotificationSettings` is inside the Lead Capture tab in IntegrationSettings — it belongs with other notification settings.

**Changes:**
- **`src/components/settings/NotificationSettings.tsx`**: Import and render `<LeadNotificationSettings />` at the bottom of the page.
- **`src/components/settings/IntegrationSettings.tsx`**: Remove `<LeadNotificationSettings />` from `LeadCaptureTab` (line 1186). Keep `AIFlowBuilderSettings` and webhook config in the Lead Capture tab — those are capture-related, not notification-related.

## Epic 2: Move Lead Notification Message Templates to Templates Tab

**Problem:** The message templates (Lead Welcome WhatsApp, Team Alert WhatsApp) shown in the uploaded screenshots are inside Lead Notification Settings. These should be in the Templates tab.

**Action:** The `LeadNotificationSettings` component already has the template textareas baked in. We'll keep the templates inline with the notification rules for now (they're tightly coupled — the templates are only used by the notification rules), but move the entire component to the Notifications tab. This achieves the cleaner categorization the user wants.

## Epic 3: Fix Chat Delete — Add RLS DELETE Policy

**Root Cause:** The `whatsapp_messages` table has RLS policies for SELECT, INSERT, and UPDATE but **no DELETE policy**. The `supabase.from('whatsapp_messages').delete()` call silently returns no error but deletes zero rows because RLS blocks it.

**Migration:**
```sql
CREATE POLICY "Staff can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin', 'manager', 'staff')
  )
);
```

## Epic 4: Chat Bubble Word-Wrap Fix

**File:** `src/pages/WhatsAppChat.tsx`

Update the `<p>` tag (line 843) to:
```
className="text-sm leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere] w-full"
```

The parent bubble div (line 830) already has `max-w-[85%] break-words overflow-hidden` — this is correct.

## Epic 5: Meta Graph API v25.0 Upgrade

Update all Meta API URLs from `v18.0` to `v25.0` in:
- `supabase/functions/manage-whatsapp-templates/index.ts` (line 11)
- `supabase/functions/send-whatsapp/index.ts` (line 26)
- `supabase/functions/whatsapp-webhook/index.ts` (line 719)
- `supabase/functions/notify-lead-created/index.ts` (lines 320, 343)

## Epic 6: Clearer Meta API Error Toasts

**File:** `src/components/settings/IntegrationSettings.tsx`

In the Test Connection error handler and template sync error handler, intercept errors containing "does not exist" and show:
> "Meta Error: WABA ID not found. Please verify your WhatsApp Business Account ID in Integration Settings."

## Epic 7: Template Status Webhook Handler

**File:** `supabase/functions/whatsapp-webhook/index.ts`

The function already has `processTemplateStatusUpdate` (noted in the summary). Verify it handles `message_template_status_update` field and updates `whatsapp_templates` table. If not, add the handler block that checks `changes?.field === 'message_template_status_update'` and updates the `whatsapp_templates` table status/rejection_reason.

## Epic 8: Assign to Staff (Scaffold)

**File:** `src/pages/WhatsAppChat.tsx`

Add a "Transfer to Staff" option in the 3-dot dropdown menu. On click, open a dialog that fetches staff from `profiles` joined with `user_roles` (owner/admin/manager/staff). On select, upsert `whatsapp_chat_settings` with `assigned_to` = selected user ID. Show assigned staff avatar/name in chat header.

**Migration:** Add `assigned_to uuid references auth.users(id)` column to `whatsapp_chat_settings` if not present.

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Add DELETE RLS policy on `whatsapp_messages`; add `assigned_to` column to `whatsapp_chat_settings` |
| `src/components/settings/NotificationSettings.tsx` | Add `<LeadNotificationSettings />` |
| `src/components/settings/IntegrationSettings.tsx` | Remove `<LeadNotificationSettings />` from Lead Capture tab; improve error toasts |
| `src/pages/WhatsAppChat.tsx` | Bubble CSS fix, staff assignment UI |
| `supabase/functions/manage-whatsapp-templates/index.ts` | v18.0 → v25.0 |
| `supabase/functions/send-whatsapp/index.ts` | v18.0 → v25.0 |
| `supabase/functions/whatsapp-webhook/index.ts` | v18.0 → v25.0, verify template status handler |
| `supabase/functions/notify-lead-created/index.ts` | v18.0 → v25.0 |

