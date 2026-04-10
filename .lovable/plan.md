

# WhatsApp AI Brain, Autonomous Lead Capture & Chat UI Fix

## Bug Fix: Chat Window Shifts on New Messages

The messages area uses `<ScrollArea className="h-full">` inside a `flex-1 overflow-hidden` container (line 554-614). The issue is that `ScrollArea` with `h-full` doesn't properly constrain height in a flex column — when new messages arrive, the content pushes the container. Fix: replace the `ScrollArea` wrapper with a plain `div` using `overflow-y-auto` and explicit height constraint, ensuring the outer container has `min-h-0` (critical for flex children to respect overflow).

---

## Epic 1: AI Flow Builder Settings UI

**New component:** `src/components/settings/AIFlowBuilderSettings.tsx`

- Not a new page — add as a sub-section inside the existing WhatsApp tab in Settings (alongside `WhatsAppAISettings`)
- Admin form with:
  - Multi-select tags input for "Target Fields to Collect" (Name, Phone, Fitness Goal, Budget, Expected Start Date, etc.)
  - Textarea for "Handoff Message"
  - Toggle to enable/disable AI lead capture
- Save into `organization_settings.whatsapp_ai_config` JSONB under a `lead_capture` key:
  ```json
  { "lead_capture": { "enabled": true, "target_fields": ["name","goal","start_date"], "handoff_message": "Thanks! Our manager will call you shortly." } }
  ```
- No new DB column needed — reuse existing `whatsapp_ai_config` JSONB

**Modified:** `src/components/settings/IntegrationSettings.tsx` — render `AIFlowBuilderSettings` in WhatsApp tab

---

## Epic 2: Context Hydration in AI Auto-Reply

**Modified:** `supabase/functions/whatsapp-webhook/index.ts` (`triggerAiAutoReply` function)

Before calling the AI gateway, look up the phone number:
1. Query `members` joined with `profiles` (via `user_id`) matching cleaned phone number against `profiles.phone`
2. If found: query `memberships` (active) and `plan_benefits` for that member. Prepend to system prompt: `"Context: Speaking to [Name], Active Member on [Plan]. Benefits: [X] remaining."`
3. If not found: query `leads` table. If lead exists, prepend lead info. If unknown: `"Context: Unregistered contact."`

This context gets injected into the system prompt before the Gemini call.

---

## Epic 3: Structured Lead Extraction & CRM Routing

**Modified:** `supabase/functions/whatsapp-webhook/index.ts` (`triggerAiAutoReply` function)

1. Fetch `lead_capture` config from `organization_settings.whatsapp_ai_config`
2. If enabled and contact is not a member, inject structured extraction instructions into system prompt:
   ```
   You are a lead generation assistant. Naturally collect: [target_fields].
   Once ALL fields are collected, output ONLY this JSON:
   {"status":"lead_captured","data":{"name":"...","goal":"..."}}
   ```
3. After getting AI response, check if it contains `lead_captured` JSON (try `JSON.parse`)
4. If detected:
   - INSERT into `leads` table with extracted data + phone number + `source: 'whatsapp_ai'` + branch_id
   - Send the handoff message via Meta API (reuse existing send logic)
   - Set `bot_active = false` in `whatsapp_chat_settings`
   - Insert a special marker message: `[AI_LEAD_CAPTURED:lead_id]` as content for the UI to detect
5. If not detected: send normal AI reply text

---

## Epic 4: Tool Calling Scaffolding (Future-Proofing)

**Modified:** `supabase/functions/whatsapp-webhook/index.ts`

For member contacts only, add Gemini function declarations to the AI request:
```json
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_schedule",
      "parameters": { "type": "object", "properties": { "date": {"type":"string"}, "type": {"type":"string"} } }
    }
  }, {
    "type": "function",
    "function": {
      "name": "book_session",
      "parameters": { "type": "object", "properties": { "user_id": {"type":"string"}, "type": {"type":"string"}, "datetime": {"type":"string"} } }
    }
  }]
}
```

After AI response, check for `tool_calls` in the response. If found, return mocked success JSON back in a follow-up call to complete the conversation loop. Actual DB wiring deferred.

---

## Epic 5: "Lead Captured" Badge & Chat UI Polish

**Modified:** `src/pages/WhatsAppChat.tsx`

1. In the message rendering loop, detect messages containing `[AI_LEAD_CAPTURED:uuid]` pattern
2. Render a glowing green banner: "AI Successfully Captured Lead" with a "View Lead" button linking to `/leads` (or opening `LeadProfileDrawer`)
3. Pre-fill `AddLeadDrawer` with the selected contact's phone number (already partially done — enhance to pass phone)

---

## Files Changed

| File | Action |
|---|---|
| `src/pages/WhatsAppChat.tsx` | Fix scroll issue (min-h-0 + overflow-y-auto), add lead captured banner |
| `src/components/settings/AIFlowBuilderSettings.tsx` | New — lead capture rule config UI |
| `src/components/settings/IntegrationSettings.tsx` | Add AIFlowBuilderSettings to WhatsApp tab |
| `supabase/functions/whatsapp-webhook/index.ts` | Context hydration, structured extraction, tool calling scaffold |

No database migration needed — all config stored in existing `whatsapp_ai_config` JSONB. Leads inserted into existing `leads` table.

