

# Epic Sprint: Transactional WhatsApp AI Agent & Member Self-Service

## Current State

The `whatsapp-webhook` already has:
- Context hydration (member name, plan, days remaining)
- Two **mocked** tools (`get_schedule`, `book_session`) that return "not yet wired up"
- Lead capture with interactive buttons
- `sendAiReply` with interactive message support

The `ai-auto-reply` edge function is a **separate** staff-facing suggestion tool (called from the CRM chat UI). The member-facing bot lives in `whatsapp-webhook`.

## Implementation Plan

### Epic 1: Enhanced Context Hydration

**File:** `supabase/functions/whatsapp-webhook/index.ts` — `hydrateContactContext()`

Expand the existing function to also fetch:
- **PT sessions balance** from `member_pt_packages` (active, sessions_remaining)
- **Benefit credits** from `benefit_usage` + `plan_benefits` (sauna, ice bath balances)
- **Pending invoices** from `invoices` (status = pending/partial)
- **Member ID and membership ID** (return them for tool execution later)

Return shape changes to include `memberId`, `membershipId`, `branchId` so tools can use them.

### Epic 2: Full Tool Declarations

Replace the current 2 mocked tools with 7 production tools:

| Tool | Description | Arguments |
|---|---|---|
| `get_membership_status` | Returns plan, expiry, days left, dues | none |
| `get_benefit_balance` | Returns sauna/ice bath/class credits remaining | `benefit_type` (optional) |
| `get_available_slots` | Lists open facility slots for a date | `facility_type` (sauna/ice_bath), `date` |
| `book_facility_slot` | Books a specific slot | `slot_id` |
| `cancel_facility_booking` | Cancels a booking | `booking_id` |
| `get_pt_balance` | Returns PT sessions remaining | none |
| `transfer_to_human` | Handoff escape hatch | `reason` (optional) |

### Epic 3: Tool Execution Router

Replace the mocked `toolMessages` block (lines 565-606) with a real `executeToolCall(name, args, memberContext)` function that runs actual Supabase queries:

```text
switch (toolCall.function.name) {
  case "get_membership_status":
    → SELECT from memberships + membership_plans
    → Return { plan, status, end_date, days_left, pending_dues }

  case "get_benefit_balance":
    → Call existing benefit balance logic (plan_benefits - benefit_usage)
    → Return { sauna: X, ice_bath: Y, group_classes: Z }

  case "get_available_slots":
    → SELECT from benefit_slots WHERE facility type + date + available
    → Return array of { slot_id, start_time, end_time, spots_left }

  case "book_facility_slot":
    → Validate slot capacity, insert benefit_bookings, record benefit_usage
    → Return { success, confirmation }

  case "cancel_facility_booking":
    → Call existing cancel_facility_slot RPC
    → Return { success }

  case "get_pt_balance":
    → SELECT from member_pt_packages WHERE active
    → Return { package_name, sessions_remaining, expiry }

  case "transfer_to_human":
    → UPDATE whatsapp_chat_settings SET bot_active=false
    → Insert notification for staff
    → Return { transferred: true }
}
```

The result is sent back to Gemini as a tool response, and Gemini generates the natural language confirmation.

### Epic 4: Human Handoff (Escape Hatch)

Add to system prompt: "If the user asks for a manager, complains repeatedly, or if you encounter errors, invoke `transfer_to_human`."

The `transfer_to_human` tool execution:
1. Updates `whatsapp_chat_settings` → `bot_active = false`
2. Inserts a notification for staff (owner/admin/manager roles)
3. Sends a final message: "I'm connecting you with our front desk team. Someone will assist you shortly. 🙏"

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Enhanced context hydration, 7 real tool declarations, tool execution router, human handoff logic |

No migration needed — all tables and RPCs already exist (`benefit_slots`, `benefit_bookings`, `cancel_facility_slot`, `member_pt_packages`, `invoices`, `whatsapp_chat_settings`).

### Safety Constraints

- Tools are only offered to **identified members** (existing `contactContext.isMember` check)
- Booking tools validate slot capacity before inserting
- `transfer_to_human` is always available as an escape hatch
- Tool execution errors are caught and returned gracefully to the AI for natural error messaging
- All mutations use the service role client (already in use)

