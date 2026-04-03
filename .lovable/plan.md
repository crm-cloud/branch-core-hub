

# Marketing CRM Upgrade Plan

## Scope Assessment

This is an extremely large request spanning database schema, edge functions, React pages, services, and seed data. To deliver meaningfully without breaking the existing system, I'll divide into **3 phases**, implementing **Phase 1** now (the foundation) with clear hooks for Phases 2-3.

---

## Phase 1: Schema + Core UI (This Implementation)

### 1A. Database Migration — Extend `leads` Table

Add CRM columns to existing `leads` table (no new table needed):

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  owner_id uuid REFERENCES auth.users(id),          -- staff who owns this lead
  temperature text DEFAULT 'warm',                    -- hot/warm/cold
  score integer DEFAULT 0,                            -- 0-100
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_page text,
  referrer_url text,
  tags text[] DEFAULT '{}',
  preferred_contact_channel text DEFAULT 'phone',
  budget text,
  goals text,
  lost_reason text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  first_response_at timestamptz,
  won_at timestamptz,
  duplicate_of uuid REFERENCES leads(id),
  merged_into uuid REFERENCES leads(id);
```

Create unified `lead_activities` table to replace split follow-up systems:

```sql
CREATE TABLE lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id),
  actor_id uuid REFERENCES auth.users(id),
  activity_type text NOT NULL,  -- call, whatsapp, visit, note, status_change, assignment, conversion
  title text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Add indexes for performance:

```sql
CREATE INDEX idx_leads_branch_status ON leads(branch_id, status);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_next_action ON leads(next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX idx_leads_temperature ON leads(temperature);
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
```

RLS policies for `lead_activities`: staff roles with branch scoping (same pattern as `leads`).

Seed ~15 sample leads with varied statuses, temperatures, sources, UTM data, and activities.

### 1B. Refactor `leadService.ts`

- `fetchLeads(branchId)` → always branch-filter using `effectiveBranchId`
- `getLeadStats(branchId)` → include new statuses (qualified, negotiation) properly
- Add `fetchLeadActivities(leadId)`, `createActivity(...)`, `assignLead(leadId, ownerId)`, `updateLeadScore(...)`
- Fix conversion to NOT require fake placeholder email: if no email, pass `email: null` and let edge function generate a proper one server-side
- Add `detectDuplicates(phone, email)` method

### 1C. Redesign `/leads` Page — Premium CRM UI

Replace the current 510-line page with a component-based architecture:

**New files:**
- `src/pages/Leads.tsx` — Main page shell with dashboard stats, view switcher
- `src/components/leads/LeadDashboard.tsx` — Funnel stats, conversion rates, source breakdown
- `src/components/leads/LeadKanban.tsx` — Drag-friendly kanban with owner avatars, temperature badges
- `src/components/leads/LeadList.tsx` — Dense table with sortable columns, inline status change
- `src/components/leads/LeadProfileDrawer.tsx` — Full lead detail: timeline, activity log, score, quick actions
- `src/components/leads/LeadFilters.tsx` — Smart filters: owner, branch, source, temperature, status, date range, tags
- `src/components/leads/LeadActivityTimeline.tsx` — Unified timeline showing all interactions
- `src/components/leads/AddLeadDrawer.tsx` — Enhanced with UTM fields, branch selector, temperature

**UI upgrades:**
- Temperature badges: 🔥 Hot (red), ☀️ Warm (amber), ❄️ Cold (blue)
- Owner avatar next to each lead card
- "Unassigned" filter and queue
- Lead score progress bar (0-100)
- Source-colored badges with icons (Instagram pink, Facebook blue, Google green, Walk-in gray)
- Next action date with overdue highlighting
- Keyboard shortcuts: `N` new lead, `/` search, `K` kanban, `L` list

### 1D. Update Edge Functions

**`capture-lead`**: Accept `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_page`, `referrer_url`, `branch_id` (optional explicit). If `branch_id` not provided, use branch slug from query param, then fall back to first active branch. Store all UTM data.

**`webhook-lead-capture`**: Same UTM/branch improvements. Add `branch_slug` query param support alongside existing `slug` auth.

**Deploy both** after changes.

### 1E. Fix Existing Bugs

- Deploy `contract-signing` edge function (404 error)
- Fix `manage-whatsapp-templates` 403 by verifying auth header handling
- Fix `fetchLeads()` to always pass `effectiveBranchId`

---

## Phase 2: Intelligence & Analytics (Future)

- Auto lead scoring based on engagement signals
- Duplicate detection with merge UI
- Marketing funnel analytics dashboard
- SLA tracking and overdue queue
- Win probability estimation

## Phase 3: Advanced Workflows (Future)

- Saved views / smart filters
- Drag-and-drop kanban with optimistic updates
- Bulk actions (assign, tag, status change)
- Follow-up calendar view
- AI next-best-action recommendations

---

## Files Modified/Created

| File | Action |
|---|---|
| DB Migration | Add columns to `leads`, create `lead_activities`, indexes, RLS, seed data |
| `src/services/leadService.ts` | Full refactor with new methods |
| `src/pages/Leads.tsx` | Redesign as shell component |
| `src/components/leads/LeadDashboard.tsx` | New — funnel stats |
| `src/components/leads/LeadKanban.tsx` | New — premium kanban |
| `src/components/leads/LeadList.tsx` | New — sortable table |
| `src/components/leads/LeadProfileDrawer.tsx` | New — lead detail + timeline |
| `src/components/leads/LeadFilters.tsx` | New — smart filters |
| `src/components/leads/LeadActivityTimeline.tsx` | New — unified timeline |
| `src/components/leads/AddLeadDrawer.tsx` | Enhanced with UTM/branch/temp |
| `supabase/functions/capture-lead/index.ts` | Add UTM + branch routing |
| `supabase/functions/webhook-lead-capture/index.ts` | Add UTM + branch routing |
| `supabase/functions/contract-signing/index.ts` | Deploy (fix 404) |

## Estimated Scope

~2000 lines of new/refactored code across 12+ files, 1 migration, 2 edge function updates, seed data.

