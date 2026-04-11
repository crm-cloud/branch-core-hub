

# WhatsApp WABA ID, Lead Data Mapping, Branch Filter Fix & Chat UX

## Summary of Issues Found

1. **WABA ID field exists** as "Business Account ID" in the schema — but the label is unclear. User's value `4028095467334645` is being used but Meta rejects it. Need to rename the label to explicitly say "WABA ID" and add validation hint.

2. **AI lead data gaps**: The AI captured `fitness_goal` and `fitness_experience` correctly, but `budget`, `expected_start_date`, `preferred_time` are null. The AI asked about "Preferred Membership Duration" instead of these fields because the system prompt field IDs don't match well. The field mapping in the prompt uses `start_date` and `budget` but the AI interprets them loosely.

3. **"All Branches" shows wrong count**: `effectiveBranchId` returns `branches[0]?.id` when "All Branches" is selected. The `fetchLeads` call filters by this single branch ID, so it shows 23 (BRANCH 2) instead of all 24. Fix: pass `undefined` when "All Branches" is selected, so no branch filter is applied.

4. **No lead assignment UI**: The Kanban/List views show leads but there's no way to assign an owner from the main list. Need a quick-assign dropdown.

5. **WhatsApp contact list styling**: `text-xs text-muted-foreground truncate mt-0.5` on last message preview is fine functionally, but user wants it improved visually.

6. **Interactive WhatsApp buttons**: Meta Cloud API supports Interactive Messages (buttons with max 3 options, or list messages with up to 10 options). The AI can send these instead of plain text questions.

---

## Epic 1: WABA ID Label Fix + Validation

**File:** `src/config/providerSchemas.ts`

Change line 74 from:
```
{ key: 'business_account_id', label: 'Business Account ID', ...}
```
To:
```
{ key: 'business_account_id', label: 'WhatsApp Business Account ID (WABA ID)', placeholder: 'From Meta Business Suite → Business Settings → WhatsApp Accounts', ...}
```

## Epic 2: Fix "All Branches" Lead Count Bug

**File:** `src/pages/Leads.tsx` (lines 66-75)

The query passes `effectiveBranchId` which resolves to the first branch when "All Branches" is selected. Change to use `branchFilter` (which is `undefined` for "All Branches") instead of `effectiveBranchId`:

```typescript
const { data: leads = [] } = useQuery({
  queryKey: ['leads', branchFilter],
  queryFn: () => leadService.fetchLeads(branchFilter || undefined),
  ...
});
const { data: stats } = useQuery({
  queryKey: ['lead-stats', branchFilter],
  queryFn: () => leadService.getLeadStats(branchFilter || undefined),
  ...
});
```

This ensures "All Branches" shows ALL leads (24), and selecting "INCLINE" shows 1.

## Epic 3: Improve AI Lead Capture Field Mapping

**File:** `supabase/functions/whatsapp-webhook/index.ts` (lines 467-480)

The system prompt field labels don't align with what the AI collects. Fix the field label mapping and the JSON extraction mapping:

- Map `budget` → "Monthly Budget (in ₹)"
- Map `start_date` → "When do you plan to start? (date)"
- Map `preferred_time` → "Preferred workout time slot"
- Map `experience` → "Fitness Experience Level (Beginner/Intermediate/Advanced)"

Also improve the extraction mapping (line 623-628) to catch more variations:
```typescript
budget: parsed.data.budget || parsed.data.monthly_budget || null,
expected_start_date: parsed.data.expected_start_date || parsed.data.start_date || parsed.data.starting_date || null,
preferred_time: parsed.data.preferred_time || parsed.data.time || parsed.data.workout_time || null,
```

## Epic 4: Lead Assignment UI in Kanban/List

**File:** `src/components/leads/LeadKanban.tsx` and `src/components/leads/LeadList.tsx`

Add an "Assign" quick-action button on each lead card/row. On click, show a small dropdown of staff members (from `user_roles` where role in owner/admin/manager/staff joined with profiles). On select, call `leadService.assignLead(leadId, staffId)`.

Also show the assigned owner's avatar/initials on each lead card when `owner_id` is set.

## Epic 5: WhatsApp Contact List Styling

**File:** `src/pages/WhatsAppChat.tsx` (line 687)

Change the last message preview from truncated single-line to a more polished two-line preview:
```
className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5 leading-snug"
```

Also improve contact name styling (line 680) — remove conflicting `truncate break-words` (these conflict), use just `truncate`.

## Epic 6: Interactive WhatsApp Buttons (Scaffold)

Meta Cloud API supports Interactive Messages. When the AI wants to ask multiple-choice questions, instead of sending plain text, send an interactive message with buttons or a list.

**Approach:**
- Update the AI system prompt to output a special JSON format when it wants to present options:
  ```json
  {"type":"interactive","body":"How would you describe your fitness experience?","buttons":["Beginner","Intermediate","Advanced"]}
  ```
- In `whatsapp-webhook/index.ts`, detect this JSON in the AI reply, and send it via Meta's interactive message API instead of plain text
- Meta allows max 3 buttons per interactive message, or a list message with up to 10 items

**File changes:**
- `supabase/functions/whatsapp-webhook/index.ts`: Add interactive message detection and Meta API call with `type: "interactive"` payload
- Update `sendAiReply` to check for interactive JSON and dispatch accordingly

---

## Files Changed

| File | Change |
|---|---|
| `src/config/providerSchemas.ts` | Rename WABA ID label |
| `src/pages/Leads.tsx` | Use `branchFilter` instead of `effectiveBranchId` for queries |
| `supabase/functions/whatsapp-webhook/index.ts` | Fix field labels in prompt, improve extraction mapping, add interactive message support |
| `src/components/leads/LeadKanban.tsx` | Add owner assignment dropdown + avatar display |
| `src/components/leads/LeadList.tsx` | Add owner assignment column |
| `src/pages/WhatsAppChat.tsx` | Improve contact list text styling |

