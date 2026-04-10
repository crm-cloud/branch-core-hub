

# WhatsApp CRM: Priority Inbox, Chat UI Fixes & Database Deletion

## Summary

Fix chat bubble overflow, implement true database chat deletion with confirmation, add Priority Inbox triage tabs with unread tracking, and add a global unread badge on the sidebar WhatsApp link.

---

## Database Migration

Add `is_unread` column to `whatsapp_chat_settings` and enable realtime:

```sql
ALTER TABLE whatsapp_chat_settings ADD COLUMN IF NOT EXISTS is_unread boolean DEFAULT true;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chat_settings;
```

The webhook already upserts into `whatsapp_chat_settings` — update the webhook to also set `is_unread = true` when an inbound message arrives (minor change to the upsert in `whatsapp-webhook/index.ts`).

---

## Epic 1: Template Auth Fix

**Finding:** The "Test Connection" button already uses `supabase.functions.invoke()` correctly (line 1007 of IntegrationSettings.tsx). The "Missing Authorization header" only appears when hitting the URL directly in a browser — this is expected behavior and NOT a bug.

**Action:** No code change needed for invocation. The real error is `Object with ID does not exist` — a wrong WABA ID. Add a clearer error message hint in the Test Connection failure toast.

## Epic 2: Chat Bubble Overflow Fix

**File:** `src/pages/WhatsAppChat.tsx` (line 719-724)

Change message bubble classes from:
```
max-w-[65%] rounded-2xl px-4 py-2.5
```
To:
```
max-w-[85%] rounded-2xl px-4 py-2.5 break-words overflow-hidden
```

Also update the `<p>` tag (line 733) from:
```
className="text-sm leading-relaxed whitespace-pre-wrap"
```
To:
```
className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
```

This ensures long phone numbers, URLs, and continuous text wrap properly inside bubbles.

## Epic 3: True Database Deletion for Clear Chat

**File:** `src/pages/WhatsAppChat.tsx`

1. Add a `clearChatConfirmOpen` state + `clearChatTarget` state
2. Replace the inline `onClick` on "Clear Chat" menu item (line 626-638) to set confirmation state instead of deleting immediately
3. Add a confirmation `Dialog` ("Are you sure you want to permanently delete this chat history?") with Cancel/Delete buttons
4. On confirm: execute `supabase.from('whatsapp_messages').delete().eq(...)`, then invalidate queries, clear selection, show toast

## Epic 4: Global Sidebar Unread Badge

**File:** `src/components/layout/AppSidebar.tsx`

1. Add a `useQuery` that counts unread chats: `SELECT count(*) FROM whatsapp_chat_settings WHERE is_unread = true`
2. Add a Supabase realtime subscription on `whatsapp_chat_settings` to auto-refetch
3. In the menu item rendering, when `item.href === '/whatsapp-chat'` and unread count > 0, render a red badge (`bg-red-500 text-white rounded-full text-[10px] min-w-[18px] h-[18px]`) next to the label

## Epic 5: Priority Inbox Triage Tabs

**File:** `src/pages/WhatsAppChat.tsx`

1. Augment the contacts query to also fetch `whatsapp_chat_settings` (bot_active, is_unread) per phone number using a second query or join
2. Add `chatFilter` state: `'all' | 'unread' | 'needs_human'`
3. Replace the contact list header area with 3 compact filter buttons/tabs: "All", "Unread", "Needs Human"
4. Filter `filteredContacts` based on `chatFilter`:
   - `unread`: only contacts where `is_unread === true`
   - `needs_human`: only contacts where `bot_active === false`
5. Add visual indicators on contact cards:
   - Blue dot (`w-2.5 h-2.5 rounded-full bg-blue-500`) for unread
   - Amber icon for needs-human

## Epic 6: Auto-Read State Mutation

**File:** `src/pages/WhatsAppChat.tsx`

1. In the `setSelectedContact` click handler (line 520), add an async call:
   ```typescript
   await supabase.from('whatsapp_chat_settings')
     .update({ is_unread: false })
     .eq('phone_number', contact.phone_number)
     .eq('branch_id', selectedBranch);
   ```
2. Invalidate the chat settings query so the blue dot disappears and the sidebar badge decrements

## Edge Function Change

**File:** `supabase/functions/whatsapp-webhook/index.ts`

In the inbound message handler, when upserting `whatsapp_chat_settings`, add `is_unread: true` to the upsert payload so new incoming messages mark the chat as unread.

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Add `is_unread` column to `whatsapp_chat_settings`, enable realtime |
| `src/pages/WhatsAppChat.tsx` | Bubble overflow fix, delete confirmation dialog, triage tabs, auto-read |
| `src/components/layout/AppSidebar.tsx` | Global unread badge with realtime subscription |
| `supabase/functions/whatsapp-webhook/index.ts` | Set `is_unread: true` on inbound message upsert |

