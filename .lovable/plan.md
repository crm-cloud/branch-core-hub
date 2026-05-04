## Goal

Fix the Campaign Wizard so the Audience step is explicit, supports the full contact universe (members, leads, staff/trainers/managers, contacts), and stops mixing in retention-only fields. Make Email a first-class channel everywhere (it already is in the message step but the audience UI implies WhatsApp-only).

## Problems being addressed

1. Audience step shows only `Membership status` (active / expired / all) — there is no way to target leads, staff, trainers, managers, or contacts even though the backend resolver already supports `members | leads | contacts | mixed | segment`.
2. `Last visit before` / `Last visit after` are retention-engine concerns; we already have the **Smart Retention Nudge Engine** for that. Keeping them here confuses users.
3. UX copy implies the wizard fires WhatsApp only, but the message step does support Email and SMS — the audience step needs to make that obvious and not gate behavior on channel.
4. Backend `resolve_campaign_audience` does not yet know about `staff` (employees + trainers + managers), so we extend it.

## Plan

### 1. Database — extend audience resolver

Migration adds a `staff` audience kind to `resolve_campaign_audience(p_branch_id, p_filter)`:

- New kind value: `'staff'` (and include in `'mixed'`).
- Optional sub-filter `p_filter->'staff_roles' text[]` — any of `owner | admin | manager | staff | trainer`. Empty = all non-member roles.
- Source: `profiles p` joined to `user_roles ur` on `ur.user_id = p.id`, scoped to branch where applicable (employees table for non-trainer staff, trainers table for trainers; profile fallback for owner/admin without branch).

No table schema changes — only the SQL function body.

### 2. `AudienceBuilder.tsx` — full rewrite of the picker

Replace the current single `Membership status` dropdown with a structured audience builder:

- **Audience kind** segmented control (cards, lucide icons):
  - Members
  - Leads
  - Staff & Trainers
  - Contacts (CRM)
  - Mixed (any combination)
  - Saved Segment
- Conditional sub-filters:
  - Members → `Membership status` (All / Active / Expired) + `Goal contains`
  - Leads → multi-select `Lead status` + `Lead temperature`
  - Staff → multi-select `Roles` (Owner, Admin, Manager, Staff, Trainer)
  - Contacts → multi-select `Categories`, `Source types`, `Tags`
  - Mixed → checkboxes for which sources to include + their sub-filters collapsed
  - Segment → segment dropdown (existing behavior)
- **Remove** `Last visit before` / `Last visit after`. Add a small inline note linking to the Retention page: *"Looking to win back inactive members? Use the Retention Nudge Engine instead."*
- Live audience size card stays; it already calls the same resolver.

### 3. `campaignService.ts` typing

- Extend `AudienceKind` union to include `'staff'`.
- Add `staff_roles?: Array<'owner'|'admin'|'manager'|'staff'|'trainer'>` to `AudienceFilter`.
- `resolveAudienceMemberIds` is members-only and is what feeds `member_ids` into `send-broadcast`. When the audience kind is anything other than `members`, the wizard already takes the `recipients` path via `resolveCampaignAudience`. Keep that branch and make the wizard always use the resolver path when `audience_kind !== 'members'` (it already does). For `members` keep the fast path.

### 4. `CampaignWizard.tsx`

- Audience step heading: "Who should receive this?" — remove the active/expired implication.
- Pass channel down to the AudienceBuilder only for a subtle hint ("Recipients without an email/phone for the chosen channel will be skipped automatically").
- No change to the channel step — Email is already there; just make sure the empty-channel warning text matches.
- Recipient counter on Message step already shows `resolvedMemberIds.length`; rename label to `recipients` (already correct in some places) for non-member kinds.

### 5. Docs / memory

Update `mem://features/marketing-segments-and-broadcast` to record:
- New `staff` audience kind in resolver.
- Retention-window fields removed from CampaignWizard; retention lives in the Nudge Engine.

## Out of scope

- Channel-aware contact filtering (e.g. "only contacts with verified email") — backend already skips when phone/email is missing; we don't add a hard pre-filter now.
- New segment-builder UI on the segments page — only the wizard's inline picker changes.
- AI template generation + Meta approval loop and recurring-rule trigger (still pending from earlier turns; not in this slice).

## Files touched

- New migration: extend `resolve_campaign_audience` SQL function.
- `src/components/campaigns/AudienceBuilder.tsx` — rewrite.
- `src/components/campaigns/CampaignWizard.tsx` — minor copy + ensure resolver path used for non-member kinds.
- `src/services/campaignService.ts` — type updates.
- `mem://features/marketing-segments-and-broadcast` — update notes.
