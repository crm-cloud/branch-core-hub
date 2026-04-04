

# Phase 2 + 3 CRM Upgrade + RoundSMS Full API Integration

## Overview

Three workstreams: (A) AI-powered lead intelligence, (B) advanced CRM workflows, (C) complete RoundSMS API integration. The existing Phase 1 foundation (leads schema with CRM columns, lead_activities, kanban/list/calendar views) is solid — this builds on top.

---

## A. Phase 2: Intelligence & Analytics

### A1. AI Lead Scoring Edge Function

Create `supabase/functions/score-leads/index.ts` that uses Lovable AI (`google/gemini-3-flash-preview`) to analyze each lead's activity history, temperature, source quality, and engagement signals, then returns a 0-100 score with reasoning.

- Input: lead data + activities
- Output: `{ score: number, reasoning: string, next_best_action: string }`
- Called on-demand from profile drawer "Refresh Score" button, or batch via "Score All" in dashboard
- Updates `leads.score` directly

### A2. Duplicate Detection & Merge UI

Add to `LeadProfileDrawer.tsx` a "Duplicates" tab:
- On drawer open, call `leadService.detectDuplicates(phone, email)` (already exists)
- Show matching leads with merge button
- Merge action: pick primary lead, set `merged_into` on duplicate, combine activities, update tags
- Add `leadService.mergeLeads(primaryId, duplicateId)` method

### A3. Funnel Analytics Dashboard

Create `src/components/leads/LeadAnalytics.tsx`:
- Funnel visualization: New → Contacted → Qualified → Negotiation → Converted (with drop-off %)
- Conversion by source (bar chart)
- Time-to-first-response histogram
- Owner performance table (leads assigned, converted, avg response time)
- Lost reason breakdown (pie chart)
- Use recharts (already in project via `chart.tsx`)

Add "Analytics" as a 4th view mode alongside kanban/list/calendar.

### A4. Overdue & SLA Queue

Add `sla_due_at` column to leads table (migration). In LeadDashboard, add "Overdue" stat card. In LeadFilters, add "Overdue only" toggle that filters `next_action_at < now()`.

---

## B. Phase 3: Advanced Workflows

### B1. Drag-and-Drop Kanban

Install `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd). Update `LeadKanban.tsx`:
- Wrap columns in `DragDropContext`, each column in `Droppable`, each card in `Draggable`
- On drag end: optimistically update local state, call `leadService.updateLeadStatus()` in background
- Revert on error with toast

### B2. Bulk Actions

Add to `LeadList.tsx`:
- Checkbox column for multi-select
- Floating action bar when 1+ selected: "Assign to", "Change Status", "Add Tag", "Delete"
- `leadService.bulkUpdateLeads(ids, updates)` method — single Supabase query with `.in('id', ids)`

### B3. Saved Views / Smart Filters

Create `saved_lead_views` table: `id`, `user_id`, `name`, `filters` (jsonb), `is_default`, `created_at`.
- In LeadFilters, add "Save View" button that persists current filter state
- Dropdown to load saved views
- "My Leads" and "Unassigned" as built-in presets

### B4. Follow-Up Calendar View

Enhance the existing calendar view to show leads by `next_action_at` instead of `created_at`, so staff see upcoming follow-ups. Add a toggle between "Created" and "Follow-up Due" calendar modes.

### B5. AI Next-Best-Action

In `LeadProfileDrawer.tsx` Settings tab, add "AI Recommendation" card that calls the `score-leads` edge function and displays the `next_best_action` suggestion (e.g., "Call today — lead visited website 3 times this week").

---

## C. RoundSMS Full API Integration

### C1. Update `send-sms` Edge Function

Add these new action modes to the existing edge function (currently only supports single send):

- **`action: "send"`** (existing) — single/multiple SMS via `sendmsg.php`
- **`action: "schedule"`** — calls `schedulemsg.php` with `time` param (format: `YYYY-MM-DD HH:MM`)
- **`action: "balance"`** — calls `checkbalance.php`, returns balance string
- **`action: "senderids"`** — calls `getsenderids.php`, returns list
- **`action: "add_senderid"`** — calls `addsenderid.php` with `senderid` and `type` (dnd/ndnd)
- **`action: "delivery_report"`** — calls `recdlr.php` with `msgid`, `phone`, `msgtype`

Multiple SMS support: accept `phone` as comma-separated string, pass directly to RoundSMS (already supported by their API).

### C2. SMS Settings UI Enhancements

In `IntegrationSettings.tsx` RoundSMS section, add:
- "Check Balance" button → calls edge function with `action: "balance"`, shows result in toast/badge
- "Sender IDs" section → fetches list, shows in table, "Request New" button
- Delivery report lookup field (enter message ID → get status)

### C3. SMS Scheduling from CRM

In `LeadProfileDrawer.tsx` activity logger, add "Schedule SMS" option:
- Date/time picker for scheduled send
- Calls edge function with `action: "schedule"` and `time` param

---

## Database Migrations

1. Add `sla_due_at` column to `leads`
2. Create `saved_lead_views` table with RLS (user can only see own views)

## Dependencies

- `@hello-pangea/dnd` — for drag-and-drop kanban

## Files Created/Modified

| File | Action |
|---|---|
| Migration | Add `sla_due_at` to leads, create `saved_lead_views` |
| `supabase/functions/score-leads/index.ts` | New — AI scoring edge function |
| `supabase/functions/send-sms/index.ts` | Add schedule, balance, senderids, DLR actions |
| `src/services/leadService.ts` | Add merge, bulk update, saved views methods |
| `src/components/leads/LeadKanban.tsx` | Add drag-and-drop with `@hello-pangea/dnd` |
| `src/components/leads/LeadList.tsx` | Add bulk selection + action bar |
| `src/components/leads/LeadProfileDrawer.tsx` | Add Duplicates tab, AI recommendation, schedule SMS |
| `src/components/leads/LeadAnalytics.tsx` | New — funnel charts + analytics |
| `src/components/leads/LeadFilters.tsx` | Add saved views dropdown, overdue toggle |
| `src/components/leads/LeadDashboard.tsx` | Add overdue stat, SLA indicator |
| `src/pages/Leads.tsx` | Add analytics view mode, saved views |
| `src/components/settings/IntegrationSettings.tsx` | Add balance check, sender IDs, DLR lookup for RoundSMS |

## Implementation Order

1. DB migration (sla_due_at + saved_lead_views)
2. RoundSMS edge function enhancements (schedule, balance, DLR, sender IDs)
3. AI scoring edge function
4. Drag-and-drop kanban
5. Bulk actions in list view
6. Analytics/funnel view
7. Duplicate merge UI
8. Saved views
9. SMS settings UI (balance, sender IDs)
10. AI next-best-action in profile drawer

