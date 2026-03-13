

# Multi-Issue Audit: Leads Notes, Biometric Sync, AI Planner, Referrals, AI Insights, Payment Icons, Member Progress

## Issues Found

### 1. Lead Notes Not Visible
**Problem**: The Leads page Kanban cards and Follow-up History drawer don't display the lead's `notes` field (captured at creation time). The `notes` column exists in the `leads` table.

**Fix**: Show lead notes in the Kanban card and in the Follow-up History drawer header area.

| File | Change |
|------|--------|
| `src/pages/Leads.tsx` | Add `lead.notes` display in Kanban card (line ~218) and in History drawer header (line ~431) |

---

### 2. Biometric Sync Queue — Missing UNIQUE Constraint
**Problem**: The `biometric_sync_queue` table has a UNIQUE INDEX (`biometric_sync_queue_member_device_idx`) but NOT a UNIQUE CONSTRAINT. PostgREST's `upsert` with `onConflict` requires a proper unique/exclusion constraint, not just an index. This causes the 400 error.

**Fix**: Add a proper UNIQUE constraint on `(member_id, device_id)` to the table via migration.

| File | Change |
|------|--------|
| DB Migration | `ALTER TABLE biometric_sync_queue ADD CONSTRAINT biometric_sync_queue_member_device_unique UNIQUE (member_id, device_id);` and same for `(staff_id, device_id)` |

---

### 3. AI Planner Not Generating — Edge Function Not Invoked
**Problem**: No logs for `generate-fitness-plan`. The function is called via `supabase.functions.invoke()` which requires a valid JWT (`verify_jwt = true` in config.toml). If the user's session is stale, it silently fails. Also, the UI shows "Generating..." indefinitely because the error is caught but the loading state from `generatePlan.mutateAsync` doesn't provide clear feedback.

**Fix**:
- Add a clear loading indicator with a timeout message (e.g., after 30s show "Still generating...").
- Add better error surfacing — check if the error is auth-related and show a re-login prompt.
- The edge function itself looks correct. The issue is likely the invocation failing silently.

| File | Change |
|------|--------|
| `src/pages/AIFitness.tsx` | Add explicit loading state with progress indicator, timeout message, and better error display in the Generate tab |

---

### 4. Referral Rewards Not Generated — TWO Database Trigger Bugs
**Problem**: The `notify_referral_converted` trigger has two critical bugs:
1. It reads `rs.reward_type` and `rs.reward_value` but the actual columns are `referrer_reward_type` and `referrer_reward_value` → always NULL → reward never created.
2. It tries to insert `status = 'pending'` into `referral_rewards` but that table has NO `status` column → the INSERT fails entirely.

**Fix**: Fix the trigger function to use correct column names and remove the `status` field from the insert.

| File | Change |
|------|--------|
| DB Migration | Replace `notify_referral_converted()` function with corrected column references |

The corrected trigger logic:
```sql
SELECT rs.referrer_reward_type, rs.referrer_reward_value 
INTO v_reward_type, v_reward_value
FROM referral_settings rs WHERE rs.branch_id = NEW.branch_id LIMIT 1;

INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value)
VALUES (NEW.id, NEW.referrer_id, v_reward_type, v_reward_value);
-- Removed: status = 'pending' (column doesn't exist)
```

---

### 5. AI Dashboard Insights Not Working
**Problem**: No logs for `ai-dashboard-insights`. The function has `verify_jwt = false` so auth isn't the issue. The function is invoked via `supabase.functions.invoke()` which adds the auth header automatically. Likely the function is not deployed or the gateway call is timing out.

**Fix**: Redeploy the function and add better error handling/logging on the client side.

| File | Change |
|------|--------|
| `supabase/functions/ai-dashboard-insights/index.ts` | Redeploy (no code changes needed — function looks correct) |
| `src/components/dashboard/AIInsightsWidget.tsx` | Add timeout handling and more specific error messages |

---

### 6. Payment Gateway Icons
**Problem**: Payment providers reference `/razorpay-icon.svg`, `/phonepe-icon.svg`, etc. — these files don't exist in `/public`. They show broken images.

**Fix**: Replace with text-based logos using styled badges/divs with the provider's brand colors, or use placeholder icons from Lucide. No need for actual SVG files.

| File | Change |
|------|--------|
| `src/pages/Integrations.tsx` | Replace `logo` references with inline styled text badges (e.g., "Rp" for Razorpay) |

---

### 7. Member Progress Not Visible
**Problem**: The route `/my-progress` exists and is correctly configured for the `member` role. The menu config also includes it. This page IS accessible to members — if the user is logged in as an admin/staff, they won't see it in the sidebar because it's member-only. The feature works as designed.

**Clarification**: If the user means "progress tracking for admins viewing a member's profile," we should verify the `MemberProfileDrawer` includes a measurements/progress tab.

No code changes needed unless admin-side progress view is missing.

---

### 8. PublicWebsite Duplicate Key (existing bug)
The console still shows duplicate key warnings for "Day Pass" and "Premium Monthly" in `PublicWebsite.tsx`. The previous fix didn't fully resolve this.

| File | Change |
|------|--------|
| `src/pages/PublicWebsite.tsx` | Use `plan.id` or index as key instead of `plan.name` |

---

## Execution Order

1. **Referral trigger fix** (critical — rewards broken at DB level)
2. **Biometric sync constraint** (fixes 400 errors)
3. **Lead notes display** (quick UI fix)
4. **AI Planner UX improvement** (loading/error feedback)
5. **AI Insights redeploy** 
6. **Payment gateway icons** (cosmetic)
7. **PublicWebsite duplicate key** (console warning)

