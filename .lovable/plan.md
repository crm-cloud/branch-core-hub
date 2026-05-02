## Audit findings

- **Campaigns** today only target `members` (filtered by status / goal / attendance). Leads, manual contacts, and AI-imported contacts are invisible. There is no concept of a "list" or "segment".
- **Announcements** are in-app only — they never fan out to WhatsApp / Email / SMS.
- **Group purchase** RPC (`purchase_group_membership`) creates the group + invoices but does not write to `audit_logs`, and only does shallow validation (≥2 members, valid type). It does not check duplicate membership, duplicate group membership, branch mismatch, or member status.
- **Rewards**: today `reward_points` accrue per-invoice through the existing `purchase_member_membership` path (each member already gets their own invoice → already gets their own points). There is **no group bonus** and no shared "group leader" concept. Worth deciding intentionally rather than leaving to chance.

---

## Phase 1 — Contact-aware Marketing & Campaigns

### Schema additions
- New table `contact_segments` (saved targeting rules)
  - fields: `name`, `description`, `filter` (jsonb), `audience_count`, `last_refreshed_at`
- New table `contact_segment_members` (materialised cache for fast send)
  - fields: `segment_id`, `contact_id`
- Extend `campaigns.audience_filter` JSONB to support a richer schema:
  ```json
  {
    "audience_kind": "members" | "leads" | "contacts" | "segment" | "mixed",
    "segment_id": "uuid?",
    "source_types": ["member","lead","manual","ai"],
    "categories": ["prospect","vendor",...],
    "tags": ["winter-promo"],
    "member_status": "active|expired|all",
    "last_attendance_before": "date?",
    "lead_status": ["new","contacted",...],
    "lead_temperature": ["hot","warm"]
  }
  ```
- New RPC `resolve_campaign_audience(p_branch_id, p_filter jsonb)` returns a unified set:
  `{ contact_id, phone, email, full_name, source_type, source_ref_id }`
  → handles members (via profiles), leads, and contacts in one call so the app and `send-broadcast` agree on the recipient list.

### Edge-function changes
- `send-broadcast` updated to accept either legacy `member_ids` or the new resolved-contact list (`recipients: [{ phone, email, full_name, contact_id, source_type }]`).
- All sends route through `dispatch-communication` (already canonical) — adds `audience_source` to dedupe key so the same contact does not get spammed twice from overlapping segments.
- New `campaign_recipients` table to log per-contact delivery status (queued / sent / failed / suppressed) — enables a Live Feed in Campaigns.

### UI changes
- **Marketing → Contact Book** gets a new tab **"Segments"** (saved filters with count and "Use in campaign" button).
- **Marketing → Campaigns** wizard step 2 ("Audience") rebuilt:
  - Audience kind toggle: `Members | Leads | Contacts | Saved segment | Mixed`
  - Filter chips for category/source/tags + member/lead-specific filters
  - Live "Recipients X (Y reachable on this channel)" counter — calls `resolve_campaign_audience`
  - Per-contact channel availability badges (no email → email channel grayed out)
- New "Send broadcast" button on Contact Book selection (multi-select rows → spawn pre-filled campaign)

---

## Phase 2 — Announcements as Multi-channel Promotions

- Add columns to `announcements`:
  - `channels text[]` (any of `inapp,whatsapp,email,sms`) — default `{inapp}`
  - `audience_filter jsonb` (same shape as campaigns)
  - `dispatched_at timestamptz`, `dispatch_summary jsonb`
- New "Promote announcement" action → calls a thin RPC `promote_announcement_to_campaign(p_id)` that creates a hidden campaign per channel using the same audience resolver, so logging / suppression / reporting all flow through the existing pipeline.
- Announcements UI gains a channels multi-select and an "Also send via" panel; in-app announcements remain the default and free.

---

## Phase 3 — Group Purchase Hardening

### Validation (added to `purchase_group_membership`)
- All members must belong to `p_branch_id` (raise `MEMBER_BRANCH_MISMATCH`).
- All members must be `status='active'` (raise `MEMBER_NOT_ACTIVE`).
- No duplicate `member_id` in `p_member_ids` (raise `DUPLICATE_MEMBER_IN_GROUP`).
- No member can already be in another **active** group for the same plan (raise `ALREADY_IN_ACTIVE_GROUP`).
- Couple type strictly = 2 members.
- Discount must be 0–100 % or 0 ≤ ₹ ≤ plan-price × N.
- Plan must be active and belong to the branch.

### Audit log
- After group + per-member purchases succeed, insert a single `audit_logs` row:
  - `action = 'group_membership_purchased'`
  - `table_name = 'member_groups'`
  - `record_id = v_group_id`
  - `new_data = { group_name, group_type, member_count, plan_id, discount_type, discount_value, discount_total, gross_total, net_total, member_ids }`
  - reuses existing actor-name resolution trigger.
- Also raise `pg_notify('audit_event', …)` so SystemHealth / live feed picks it up.

### UI
- GroupPurchaseDrawer surfaces validation errors inline (per-error toast → translated to friendly text).
- New "Groups" tab on Members page lists active groups with member chips + audit timeline.

---

## Phase 4 — Group Reward Policy

Two intentional choices; we will implement **Option B** as the default (most aligned with current per-invoice points engine):

- **Option A — Pooled reward**: total points credited to a designated "group leader" only. Simpler invoicing but unfair if members split costs.
- **Option B — Per-member with group bonus** *(default)*:
  - Each member still earns points for their own invoice (existing behaviour, no change to `record_payment`).
  - **Plus** a flat group bonus controlled by a new `settings` row `group_reward_bonus_pct` (default 5 %): on group completion, each member gets `bonus_pct × their_invoice_net` extra points credited via `rewards_ledger` with `source='group_bonus'` and `reference_id=group_id`.
  - Couple groups get an additional "couple multiplier" (default 1.5×) — also a setting.
- New RPC `award_group_bonus(p_group_id)` invoked at the end of `purchase_group_membership` (idempotent on `(group_id, member_id, 'group_bonus')`).
- Rewards Wallet UI shows the group-bonus line item with a "Group: <name>" tag.

---

## Technical details

### Files to add / change
- `supabase/migrations/<ts>_marketing_contacts_segments.sql`
  - `contact_segments`, `contact_segment_members`, `campaign_recipients`
  - RPC `resolve_campaign_audience`, RLS policies (owner/admin/manager)
- `supabase/migrations/<ts>_announcement_channels.sql`
  - announcements columns + `promote_announcement_to_campaign` RPC
- `supabase/migrations/<ts>_group_purchase_hardening.sql`
  - replace `purchase_group_membership` with hardened version (audit + validation + bonus award)
  - add `award_group_bonus` RPC
  - seed `settings` row `group_reward_bonus_pct=5`, `couple_multiplier=1.5`
- `supabase/functions/send-broadcast/index.ts` — accept resolved recipients, write `campaign_recipients` rows, call `dispatch-communication`
- New components:
  - `src/components/contacts/SegmentDrawer.tsx`
  - `src/components/contacts/ContactSegmentsTab.tsx`
  - `src/components/campaigns/AudienceBuilderV2.tsx` (replaces current step)
  - `src/components/announcements/AnnouncementChannelsField.tsx`
  - `src/components/members/MemberGroupsTab.tsx`
- Updated:
  - `src/services/campaignService.ts` — new resolver call, mixed audience types
  - `src/services/contactService.ts` — segment CRUD + bulk select
  - `src/components/members/GroupPurchaseDrawer.tsx` — friendly error mapping, validation hints
  - `src/pages/Campaigns.tsx`, `src/pages/Announcements.tsx`, `src/pages/ContactBook.tsx`

### Reward / Audit acceptance criteria
- Creating a group of 3 members on a ₹10 000 plan with 10 % discount produces:
  - 3 invoices of ₹9 000 each
  - 3 `rewards_ledger` rows with normal points + 3 rows with `group_bonus` = 5 % of ₹9 000 = 450 pts
  - 1 `audit_logs` row `group_membership_purchased`
- A 4th attempt to add an already-grouped member fails with `ALREADY_IN_ACTIVE_GROUP` and no partial state.

### Out of scope (proposed for a follow-up turn)
- Drip campaign sequences and A/B testing
- WhatsApp template-variable mapping in the audience builder (currently freeform text)
- Lead → contact → member migration UI for bulk operations