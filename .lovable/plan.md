

# Plan: PT Analytics Enhancement, Template Sync, Communication Logs Audit

## Issue 1: PT Sessions — Better KPI Widgets + Top Performer

**Current state:** Two charts exist — "Session Status Distribution" (pie) and "Sessions by Trainer" (bar). Both only use `sessions` from the first trainer and `activePackages`. No monthly package revenue, no top performer highlight.

**Fix — Replace the 2-chart row with a 3-widget layout:**

| Widget | Data Source | Visual |
|--------|-----------|--------|
| **Top Performer** | `activePackages` grouped by `trainer_id` → count clients + total revenue. Rank by revenue. | Hero card with trainer name, avatar, client count, revenue, gold crown icon |
| **Package Type Split** | `activePackages` grouped by `sessions_total > 0` (session-based) vs `sessions_total === 0` (duration/monthly) | Donut chart with 2 segments + center total |
| **Revenue by Trainer** | `activePackages` grouped by `trainer_id` → sum `price_paid` | Horizontal bar chart (replaces current "Sessions by Trainer") |

Keep the existing "Session Status Distribution" pie chart but move it into a combined row.

**File:** `src/pages/PTSessions.tsx` — replace lines 194-224 with new widget grid.

## Issue 2: Two Template Systems Not Synced

**Audit findings:**
- **Hardcoded templates** (`src/data/messageTemplates.ts`): 20+ static templates used by the Announcements page "Templates" sheet. Read-only, no DB persistence.
- **DB templates** (`TemplateManager` in Settings → Templates tab): Full CRUD against `templates` table in database. These are the "real" templates.
- **The Announcements page ignores DB templates entirely** — it imports from `messageTemplates.ts` and never queries the `templates` table.

**Fix — Unify both systems:**
- Update the Announcements page "Templates" sheet to fetch from the `templates` DB table (same source as Settings TemplateManager)
- Keep the hardcoded templates as **seed/fallback** — show them in a separate "Default Templates" section only if no DB templates exist
- When user clicks a DB template, populate the broadcast drawer with its content (same as current behavior)

**Files:** `src/pages/Announcements.tsx` — replace the template sheet content (lines 110-144) with a DB query + fallback to hardcoded templates.

## Issue 3: Communication Logs Always Empty

**Audit findings:**
- The realtime subscription and polling query are correctly wired
- The `communicationService.fetchCommunicationLogs()` query works fine
- **Root cause:** No actual communication logs are being written. The `sendEmail` method just does `console.log`, `sendWhatsApp` and `sendSMS` open browser URLs but never call `logCommunication`. The only path that writes logs is the `send-broadcast` edge function — which requires Resend API key to actually send emails.
- So the table is genuinely empty — the system never logs WhatsApp/SMS opens.

**Fix:**
- Update `communicationService.sendWhatsApp()` and `sendSMS()` to also call `logCommunication` so every outbound message attempt gets recorded
- These methods need to become `async` and accept `branchId` + optional `memberId` params
- Update all callers (member profile, broadcast drawer, invoice share) to pass branch context

**Files:**
- `src/services/communicationService.ts` — make `sendWhatsApp` and `sendSMS` async, add `logCommunication` calls
- Callers that use these methods will need minor updates to pass `branchId`

## Execution Order
1. PT Sessions KPI widgets + top performer card
2. Template sync — Announcements page reads from DB templates
3. Communication log writing for WhatsApp/SMS opens

## Files to Change

| File | Change |
|------|--------|
| `src/pages/PTSessions.tsx` | Replace chart row with top performer card + package type donut + revenue-by-trainer bar |
| `src/pages/Announcements.tsx` | Template sheet fetches from DB `templates` table with hardcoded fallback |
| `src/services/communicationService.ts` | Make `sendWhatsApp`/`sendSMS` async, log to `communication_logs` |

