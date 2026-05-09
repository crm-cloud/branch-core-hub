## Audit Findings

### A. Cron Health (2:00 AM and others)
Queried `automation_rules` and `cron.job` — all jobs healthy, no errors.

| Time | Job | Last Run | Status |
|---|---|---|---|
| 02:00 daily | Generate Renewal Invoices (`generate_renewal_invoices`) | 2026-05-09 02:00:09 | success |
| 01:00 daily | Auto-Expire Memberships | 2026-05-09 01:00:09 | success |
| 09:00 daily | Smart Retention Nudges (`run-retention-nudges`) | 2026-05-09 09:00:09 | success (1 stage-1 sent) |
| every 5 min | automation-brain master tick | live | running |
| every 5 min | comm + WhatsApp retry queues | live | success |
| 21:00 daily | DR replicate | live | success |

No `last_error` rows. The 2 AM job the user asked about (Generate Renewal Invoices) processed successfully.

### B. Retention Campaign — Frozen Membership Bug
Current `get_inactive_members` RPC filters `ms.status = 'active'`, but:
- A member with BOTH an active and a frozen membership still qualifies.
- A member whose membership is frozen mid-stretch (status flipped to `frozen`) is correctly skipped today, BUT dispatcher has no second guard — if status race-conditions or future workers query differently, nudges will fire.
- User's explicit rule: "if member has freeze membership… do not trigger until unfreeze".

### Plan

**1. Tighten `get_inactive_members` RPC** (new migration)
Exclude any member who has ANY current membership row with `status = 'frozen'` (regardless of other active memberships). Add `LEFT JOIN` + `NOT EXISTS` guard:
```sql
AND NOT EXISTS (
  SELECT 1 FROM memberships f
  WHERE f.member_id = m.id AND f.status = 'frozen'
)
```

**2. Belt-and-braces check in `run-retention-nudges/index.ts`**
Before dispatching for each member, query memberships and skip if any `status='frozen'` exists. Increment new `results.skipped_frozen` counter. Logged so admins see why a member was skipped.

**3. Apply same guard to other member-targeted automations** (audit only, no code change in this plan unless user asks):
- `send-reminders` (booking T-2h) — uses bookings, not member status; fine.
- `birthday_wish` — should also skip frozen members. Add follow-up.
- `lead-nurture-followup` — leads not members; N/A.

**4. UI confirmation in `RetentionCampaignManager.tsx`**
Add a small info banner: "Frozen memberships are automatically excluded from all retention nudges until unfrozen."

### Files Touched
- `supabase/migrations/<new>.sql` — replace `get_inactive_members` with frozen-exclusion logic.
- `supabase/functions/run-retention-nudges/index.ts` — add per-member frozen check + `skipped_frozen` counter (v2.1.0).
- `src/components/settings/RetentionCampaignManager.tsx` — info banner.

### Verification
- Re-deploy edge fn, manually invoke `run-retention-nudges`, confirm a frozen test member is in `skipped_frozen` not `stage_1`.
- Run `SELECT * FROM get_inactive_members('<branch>',5,200)` and confirm frozen members absent.
- Cron audit already complete — no action needed.

No schema/data migration risk; RPC replace is idempotent.