

# AI Tool Management UI & Observability Dashboard

## Database Migration

Create `ai_tool_logs` table:

```sql
CREATE TABLE public.ai_tool_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT,
  phone_number TEXT,
  branch_id UUID REFERENCES branches(id),
  message_id UUID,
  tool_name TEXT NOT NULL,
  arguments JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_tool_logs_created ON ai_tool_logs(created_at DESC);
CREATE INDEX idx_ai_tool_logs_phone ON ai_tool_logs(phone_number);
CREATE INDEX idx_ai_tool_logs_status ON ai_tool_logs(status);

ALTER TABLE ai_tool_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view AI tool logs" ON ai_tool_logs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));
```

Add `ai_tool_config` JSONB column to `organization_settings` for storing enabled/disabled tool toggles.

```sql
ALTER TABLE organization_settings ADD COLUMN ai_tool_config JSONB DEFAULT '{}';
```

---

## Epic 1: Tool Logging in Edge Function

**File:** `supabase/functions/whatsapp-webhook/index.ts`

In the tool execution loop (~line 1098), after each `executeToolCall`, insert a row into `ai_tool_logs`:

```typescript
const startTime = Date.now();
const result = await executeToolCall(...);
const elapsed = Date.now() - startTime;
const hasError = !!result.error;

await supabase.from("ai_tool_logs").insert({
  phone_number: phoneNumber,
  branch_id: branchId,
  message_id: messageId,
  tool_name: tc.function.name,
  arguments: parsedArgs,
  result,
  status: hasError ? "error" : "success",
  error_message: hasError ? result.error : null,
  execution_time_ms: elapsed,
});
```

Also apply to nested tool calls (~line 1163).

**Tool Toggle:** Before passing tools to Gemini, fetch `ai_tool_config` from `organization_settings` and filter out disabled tools from the `getMemberTools()` array.

---

## Epic 2: AI Agent Control Center (Settings Tab)

**New file:** `src/components/settings/AIAgentControlCenter.tsx`

Three sections in a single settings tab (`/settings?tab=ai-agent`):

### Section A: Live Activity Feed
- Query `ai_tool_logs` ordered by `created_at DESC`, limit 50
- Table columns: Time, Phone, Tool Name, Status (green/red badge), Duration (ms), Actions (expand)
- Expandable row shows full `arguments` and `result` JSON
- Auto-refresh via React Query `refetchInterval: 10000`

### Section B: Tool Toggle Panel
- List all 7 tools from `getMemberTools()` with Switch toggles
- Load/save from `organization_settings.ai_tool_config`
- Each tool shows name + description
- Disabled tools get filtered out in the edge function before calling Gemini

### Section C: Manual Test Lab
- Dropdown to select a tool name
- JSON textarea for arguments input
- "Execute" button calls a new edge function `test-ai-tool` that runs `executeToolCall` directly
- Displays result JSON with success/error styling

**Wire into Settings page:** Add `ai-agent` to `SETTINGS_MENU` with a `Bot` icon and map to the new component.

---

## Epic 3: WhatsApp Chat "AI Thought" Integration

**File:** `src/pages/WhatsAppChat.tsx`

- When rendering messages in the chat view, for each outbound AI message, query `ai_tool_logs` where `phone_number` matches and `created_at` is within ±5 seconds of the message timestamp
- Display a subtle indigo banner below the AI message bubble: "✨ AI used `get_membership_status` — Success (42ms)"
- For errors, show a red-tinted banner with "⚠ AI tool `book_facility_slot` failed — Slot full"

---

## Epic 4: Error Recovery — "Retry as Human"

In the Activity Feed (Epic 2) and the WhatsApp Chat thought banners (Epic 3):
- For rows with `status = 'error'`, show a "Handle Manually" button
- Clicking navigates to `/whatsapp-chat` and sets the contact phone as the active chat
- Pre-fills the message input with a contextual message: "Re: [tool_name] — [error_message]. How can I help?"

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Create `ai_tool_logs` table + add `ai_tool_config` to `organization_settings` |
| `supabase/functions/whatsapp-webhook/index.ts` | Log tool calls, filter disabled tools |
| `src/components/settings/AIAgentControlCenter.tsx` | **NEW** — Activity feed, tool toggles, test lab |
| `src/pages/Settings.tsx` | Add `ai-agent` tab |
| `src/pages/WhatsAppChat.tsx` | Show AI thought banners on messages |
| `supabase/functions/test-ai-tool/index.ts` | **NEW** — Manual tool execution endpoint |

