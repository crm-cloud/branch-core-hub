

# Retention Campaign Manager & Smart Follow-Up Drawer

## Overview

Build a 3-stage automated retention system with admin configuration UI and a staff-facing "Smart Assist" drawer for manual follow-ups with at-risk members.

## 1. Database Migration

**New table: `retention_templates`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `branch_id` | uuid FK→branches | nullable (global default) |
| `stage_level` | integer | 1, 2, 3 |
| `stage_name` | text | e.g. "Value Add", "FOMO", "Incentive" |
| `days_trigger` | integer | Days absent before sending |
| `message_body` | text | Template with `{member_name}` placeholders |
| `is_active` | boolean | default true |
| `created_at` / `updated_at` | timestamptz | |

**New table: `retention_nudge_logs`** (tracks what was sent)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `member_id` | uuid FK→members | |
| `branch_id` | uuid FK→branches | |
| `template_id` | uuid FK→retention_templates | |
| `stage_level` | integer | |
| `sent_at` | timestamptz | |
| `channel` | text | 'whatsapp', 'sms' |
| `status` | text | 'sent', 'failed' |
| `resolved_at` | timestamptz | null until staff resolves |
| `resolution` | text | e.g. "Returning Tomorrow" |

**Seed 3 default templates** (via insert tool after migration):
- Stage 1: Day 5 — "Hi {member_name}, we noticed you haven't visited in a few days..."
- Stage 2: Day 10 — "Hi {member_name}, your gym buddies are crushing it!..."
- Stage 3: Day 15 — "Hi {member_name}, we have a special offer for you..."

**RLS**: Authenticated users with staff/admin/owner roles can read/write.

## 2. Admin UI: Retention Campaign Manager

**New file: `src/components/settings/RetentionCampaignManager.tsx`**

- Displays 3 stage cards in a vertical list
- Each card shows: stage name, days trigger (editable number input), message body (editable textarea with `{member_name}` variable), active toggle
- "Save Changes" button per stage (mutation updates `retention_templates`)
- "Test Send" button — opens WhatsApp with the admin's own phone using the template text
- Add to Settings page as new tab: `{ value: 'retention', label: 'Marketing & Retention', icon: Megaphone }`

## 3. Staff UI: Smart Assist Drawer

**New file: `src/components/retention/SmartAssistDrawer.tsx`**

Right-side Sheet triggered from Staff Dashboard's inactive members list:

- **Context Header**: Member name, avatar (from profiles), fitness goal (from member profile), total days absent
- **Nudge History**: Query `retention_nudge_logs` for this member — show mini timeline (stage badges with dates)
- **Smart Messaging**: 3 radio-button templates:
  1. "Offer a Freeze" — pre-populated freeze offer message
  2. "Free PT Session" — complimentary PT invite
  3. "Personal Check-in" — warm personal message
- **Send WhatsApp**: Primary button calls `communicationService.sendWhatsApp()` with selected template
- **Resolution Dropdown**: Select from ["Left Message", "Frozen Account", "Returning Tomorrow", "Not Interested", "Cancelled"]. On submit, updates `retention_nudge_logs.resolved_at` and `resolution`

## 4. Staff Dashboard Integration

**Edit: `src/pages/StaffDashboard.tsx`**

- Import and wire `SmartAssistDrawer`
- Add state for selected at-risk member
- On clicking an inactive member row, open the drawer instead of just showing call/WhatsApp buttons
- Keep the quick call/WhatsApp buttons but add a "View Details" button that opens the drawer

## 5. Settings Page Wiring

**Edit: `src/pages/Settings.tsx`**

- Add `retention` tab entry with `Megaphone` icon labeled "Marketing & Retention"
- Map to `<RetentionCampaignManager />`

## Files Summary

| File | Action |
|------|--------|
| DB Migration | Create `retention_templates` + `retention_nudge_logs` tables with RLS |
| DB Insert (seed) | Insert 3 default stage templates |
| `src/components/settings/RetentionCampaignManager.tsx` | **New** — Admin settings UI for 3-stage campaign |
| `src/components/retention/SmartAssistDrawer.tsx` | **New** — Staff drawer with context, nudge history, smart messaging, resolution |
| `src/pages/Settings.tsx` | Add retention tab |
| `src/pages/StaffDashboard.tsx` | Wire SmartAssistDrawer to inactive members list |

## Execution Order

1. Database migration (tables + RLS)
2. Seed default templates
3. RetentionCampaignManager settings component
4. SmartAssistDrawer component
5. Wire into Settings and StaffDashboard

