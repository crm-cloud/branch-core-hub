

# P2/P3 Implementation + Biometric Sync Audit

## Summary

This plan covers: AI Dashboard Insights widget, Social Media Lead Capture configuration, and a full biometric sync pipeline audit with fixes.

---

## 1. Biometric Sync Pipeline Audit

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | **`device-access-event` missing from config.toml** — function exists but has no `[functions.device-access-event]` entry. May cause deployment issues. | High |
| 2 | **`webhook-lead-capture` missing from config.toml** — same problem. | High |
| 3 | **Trainers have no biometric fields** — `trainers` table lacks `biometric_photo_url` and `biometric_enrolled`. The `device-access-event` function only checks `members` and `employees`, never trainers. Trainers are a separate role from employees. | High |
| 4 | **`biometricService.ts` uses `device_type = 'face_terminal'`** but the DB likely stores `face terminal` (with space). If mismatch, no devices are found and sync silently fails. | Medium |
| 5 | **No trainer lookup in device-access-event** — trainers entering via face recognition get "Not Registered" denial because the function only checks `members` then `employees` tables. | High |
| 6 | **No sync completion callback endpoint** — devices can fetch pending syncs but there's no endpoint to report back "sync item X completed/failed". The `markSyncComplete` function exists client-side but devices need an API. | Medium |

### Fixes

**Config.toml**: Add missing function entries:
```toml
[functions.device-access-event]
verify_jwt = false

[functions.webhook-lead-capture]
verify_jwt = false
```

**DB Migration**: Add biometric fields to `trainers` table:
```sql
ALTER TABLE public.trainers
ADD COLUMN IF NOT EXISTS biometric_photo_url text,
ADD COLUMN IF NOT EXISTS biometric_enrolled boolean DEFAULT false;
```

**device-access-event**: After the employee lookup fails, add a trainer lookup:
- Query `trainers` table by `id = person_uuid`
- If found and active + correct branch, log `staff_attendance` and return OPEN
- This mirrors the existing employee logic

**biometricService.ts**: Fix `device_type` filter — query without the filter (fetch all devices) or use the actual stored value. Also add `queueTrainerSync` function for trainers.

**New edge function `device-sync-callback`**: Simple endpoint for devices to report sync completion status. Calls the same logic as `markSyncComplete`.

---

## 2. AI Dashboard Insights Widget (P2)

### Approach
- Create an edge function `ai-dashboard-insights` that:
  - Fetches key metrics (member count, revenue, attendance trends, expiring memberships)
  - Sends structured data to Lovable AI Gateway (google/gemini-3-flash-preview)
  - Returns 3-5 actionable insights
- Add an "AI Insights" card to Dashboard.tsx with:
  - A "Generate Insights" button
  - Streaming display of AI-generated insights
  - Cached results (stored in localStorage, refresh daily)

### Files
| File | Change |
|------|--------|
| `supabase/functions/ai-dashboard-insights/index.ts` | New edge function |
| `supabase/config.toml` | Add function entry |
| `src/components/dashboard/AIInsightsWidget.tsx` | New widget component |
| `src/pages/Dashboard.tsx` | Add widget to layout |

---

## 3. Social Media Lead Capture (P2)

### Approach
The `webhook-lead-capture` edge function already handles external leads. What's missing:
- A settings UI showing the webhook URL and how to connect it
- Support for Instagram/Facebook source tracking (already works via `source` field)
- Documentation in the Integration Settings page

### Implementation
- Add a "Lead Capture" tab to Integration Settings with:
  - Display the webhook endpoint URL
  - Copy-to-clipboard button
  - Instructions for connecting Zapier/Make with Meta Lead Ads
  - Source filter display (instagram, facebook, website, api)
  - Webhook secret configuration (uses existing `WEBHOOK_LEAD_SECRET`)
- Add `instagram` and `facebook` as recognized source values in the Leads page source badges

### Files
| File | Change |
|------|--------|
| `src/components/settings/IntegrationSettings.tsx` | Add "Lead Capture" tab with webhook URL display |
| `src/pages/Leads.tsx` | Add instagram/facebook source badges |

---

## 4. AI WhatsApp Auto-Reply (P3 — Foundation Only)

This requires a WhatsApp Business API provider. We'll build the AI reply logic foundation:
- Create `ai-auto-reply` edge function that accepts a message + lead context, calls Lovable AI, returns a suggested reply
- Wire it into WhatsAppChat.tsx as a "Suggest Reply" button (AI generates a draft, staff approves before sending)
- This avoids needing full automation while providing immediate value

### Files
| File | Change |
|------|--------|
| `supabase/functions/ai-auto-reply/index.ts` | New edge function |
| `supabase/config.toml` | Add function entry |
| `src/pages/WhatsAppChat.tsx` | Add "AI Suggest Reply" button |

---

## Execution Order

1. DB migration (add biometric fields to trainers)
2. Fix config.toml (add all missing function entries)
3. Fix biometric sync service (device_type filter, add trainer sync)
4. Update device-access-event (add trainer lookup)
5. Create device-sync-callback edge function
6. Create AI Dashboard Insights widget
7. Add Lead Capture settings UI
8. Add AI Auto-Reply foundation

