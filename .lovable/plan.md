# WhatsApp Integration Cleanup, Chat UI Fixes & Template Debugging

## Key Findings

### 1. Template Creation Error — Root Cause

The `manage-whatsapp-templates` function is **NOT** broken due to auth headers. The logs show the real error:

```
Meta create template error: Object with ID '4028095467334645' does not exist,
cannot be loaded due to missing permissions
```

This means the **WhatsApp Business Account ID (WABA ID)** stored in your integration settings is incorrect or the access token lacks permissions for that WABA ID. The "Missing Authorization header" error only appears when hitting the URL directly in a browser — the UI calls it correctly with auth. **Fix: validate the WABA ID in the configure drawer and add a "Test Connection" button.**

### 2. Emoji & Attachment Buttons — Currently Disabled

Both buttons have `disabled` prop set (lines 657, 666 in WhatsAppChat.tsx). They literally say "coming soon" in the title. **Fix: implement emoji picker and file attachment.**

---

## Implementation Plan

### Epic 1: Clean Up Integration Providers

**File:** `src/components/settings/IntegrationSettings.tsx`

**WhatsApp tab** — keep only Meta Cloud API,Wati,Aisensy

```typescript
const WHATSAPP_PROVIDERS = [
  { id: 'meta_cloud', name: 'Meta Cloud API', description: 'Direct WhatsApp Cloud API' },
];
```

Remove: Interakt, Gupshup, Custom API.

**SMS tab** — keep only MSG91, RoundSMS, Twilio:

```typescript
const SMS_PROVIDERS = [
  { id: 'msg91', name: 'MSG91', description: 'Indian SMS with DLT support' },
  { id: 'roundsms', name: 'RoundSMS', description: 'Indian SMS with HTTP API' },
  { id: 'twilio', name: 'Twilio', description: 'Global SMS provider' },
];
```

Remove: Gupshup, TextLocal, Fast2SMS, Custom API.

### Epic 2: Move AI Lead Capture Rules to Lead Capture Tab

Move `<AIFlowBuilderSettings />` from the WhatsApp tab (line 407) into the Lead Capture tab content (`LeadCaptureTab` component, line 634).

### Epic 3: Collapsible Setup Guides

Wrap both setup guides (WhatsApp and Google) in Shadcn `<Collapsible>` components, defaulting to **collapsed**. Use a clean trigger with a chevron icon.

### Epic 4: WhatsApp Template "Test Connection" Button

Add a "Test Connection" button in the Meta Templates panel that calls `manage-whatsapp-templates` with `action: 'list'` and shows success/error feedback. This helps users verify their WABA ID and access token are correct before trying to create templates.

### Epic 5: Chat UI Fixes

**File:** `src/pages/WhatsAppChat.tsx`

1. **Emoji Picker**: Add `@emoji-mart/react` package. Remove `disabled` from emoji button. On click, show a popover with the picker. On emoji select, insert into message input.
2. **Attachment Button**: Remove `disabled`. On click, open a file picker. Upload file to Supabase Storage, then send as an image/document message via `send-whatsapp` with `message_type: 'image'`.
3. **Username wrapping**: Add `break-all` or `break-words` to the contact name in the chat header (line 496) and contact list items.
4. **Typing indicator**: Not feasible with Meta Cloud API — Meta does not expose typing events from users. We can show a local "sending..." indicator when the bot is composing a reply.
5. **3-dot menu**: Add a dropdown with options: "View Profile", "Clear Chat", "Block Contact".

### Epic 6: Chat Transfer to Staff (Plan)

This requires a new `assigned_to` column on `whatsapp_chat_settings`. The 3-dot menu gets a "Transfer to Staff" option that opens a drawer listing staff members. Selecting one updates `assigned_to` and sends a notification. The chat list can then be filtered by assignment. **This will be scaffolded in the 3-dot menu but full implementation deferred to next sprint.**

---

## Files Changed


| File                                              | Change                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/components/settings/IntegrationSettings.tsx` | Remove extra providers, move AI Flow Builder to leads tab, collapsible guides |
| `src/pages/WhatsAppChat.tsx`                      | Emoji picker, attachment upload, username wrapping, 3-dot menu actions        |
| `package.json`                                    | Add `@emoji-mart/react` and `@emoji-mart/data`                                |


No database migrations needed. No edge function changes needed — the template error is a Meta configuration issue (wrong WABA ID or missing permissions).