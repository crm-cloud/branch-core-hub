# HOWBODY 580/S580 Scanner Integration

Integrates the HOWBODY body composition + posture scanner into the existing Incline gym CRM. Reuses the project's `integration_settings` dispatcher, `members` table, edge function CORS standards, Vuexy UI, and right-side Sheet form policy. Does **not** create a parallel members/plans schema — bolts onto what already exists.

## Architecture Overview

```text
HOWBODY device  ──QR──▶  /howbody-login (member binds session)
        │                       │
        │                       ▼
        │            edge: howbody-bind-user ──▶ POST /openApi/setUserInfo
        │
        ├──body scan──▶  edge: howbody-body-webhook   ──▶ howbody_body_reports
        └──posture───▶  edge: howbody-posture-webhook ──▶ howbody_posture_reports
                                │
                                ▼
                  notify_member() trigger (existing) → in-app bell
```

## Database Migrations

New tables (all with RLS):

- **`howbody_tokens`** — `id`, `token`, `expires_at`, `created_at`. Service-role only. Holds the cached 24h auth token.
- **`howbody_scan_sessions`** — `id`, `scan_id` (unique), `equipment_no`, `member_id` (fk members), `status` ('pending'|'bound'|'completed'|'expired'), `bound_at`, `completed_at`, `created_at`. RLS: members can read their own; staff/admin read all in branch.
- **`howbody_body_reports`** — `id`, `member_id`, `data_key` (unique), `equipment_no`, `scan_id`, `test_time` (timestamptz), `health_score`, scalar metrics (weight, bmi, pbf, fat, smm, tbw, pr, bmr, whr, vfr, metabolic_age, target_weight, weight_control, muscle_control, fat_control, icf, ecf), `full_payload jsonb`, `created_at`. RLS: member reads own; staff/admin read all.
- **`howbody_posture_reports`** — `id`, `member_id`, `data_key` (unique), `equipment_no`, `scan_id`, `test_time`, `score`, scalar angles (head_forward, head_slant, shoulder_left/right, high_low_shoulder, pelvis_forward, knee_left/right, leg_left/right, body_slope), measurements (bust, waist, hip, left/right_thigh, calf_left/right, shoulder_back, up_arm_left/right), image URLs (front_img, left_img, right_img, back_img, model_url), `full_payload jsonb`, `created_at`.
- **`howbody_public_report_tokens`** — `id`, `data_key`, `report_type` ('body'|'posture'), `token` (unique opaque slug), `expires_at`, `created_at`. Drives shareable links without exposing UUIDs.

Alter `members`: add `howbody_third_uid uuid unique` (default `gen_random_uuid()` via trigger on insert, backfill existing).

Alter `membership_plans`: add `body_scan_allowed boolean default false`, `posture_scan_allowed boolean default false`, `scans_per_month integer default 0` (-1 = unlimited), `public_report_link boolean default false`.

Triggers: reuse existing `notify_member()` to fire in-app notifications on insert into both report tables ("Your body scan report is ready").

Index `(member_id, test_time desc)` on both report tables for trend queries.

## Edge Functions (Deno)

All follow project standards: try/catch wrapper, `corsHeaders`, version comment, no path-style invocation.

1. **`howbody-get-token`** (internal helper, not directly invoked from client)
   - Reads `HOWBODY_BASE_URL`, `HOWBODY_USERNAME`, `HOWBODY_APPKEY` secrets.
   - Selects newest row from `howbody_tokens` where `expires_at > now() + interval '5 minutes'`.
   - If missing/expired → POST `/openApi/getToken` with `{userName, appKey, timeStamp}`, insert new row with `expires_at = now() + 23 hours`.
   - Returns token + appkey + timestamp headers builder.

2. **`howbody-bind-user`** (called by `/howbody-login` page)
   - Auth: requires logged-in member or staff (validates JWT via `getClaims`).
   - Body schema (zod): `equipmentNo`, `scanId`, `memberId`.
   - Loads member → checks active membership + plan.body_scan_allowed/posture_scan_allowed + monthly scan quota (count from reports this month).
   - Calls `/openApi/setUserInfo` with `thirdUid = members.howbody_third_uid`, `nickname`, `tel`, `sex` (1=male/0=female from members.gender), `height`, `age`.
   - Upserts `howbody_scan_sessions` with status `bound`.
   - Returns `{ ok: true }` or HOWBODY error code mapped to user-friendly message ("device offline", "session expired").

3. **`howbody-body-webhook`** (PUBLIC — `verify_jwt = false` in `supabase/config.toml`)
   - Validates `appkey` header equals `HOWBODY_APPKEY` secret (fail → 401).
   - Looks up member by `thirdUid` (matches `members.howbody_third_uid`).
   - Upserts `howbody_body_reports` on `data_key` with all scalar columns + full payload.
   - Marks corresponding `howbody_scan_sessions` row `completed`.
   - Returns `{ code: 200, message: "Push successful", data: null }` per spec; 500 with same envelope on failure.

4. **`howbody-posture-webhook`** (PUBLIC — `verify_jwt = false`)
   - Same pattern as body webhook; persists to `howbody_posture_reports`.
   - Stores image URLs as-is (HOWBODY-hosted).

5. **`howbody-test-connection`** (admin only) — calls `getToken` and returns success/error for the Settings "Test connection" button.

`supabase/config.toml` adds `[functions.howbody-body-webhook]` and `[functions.howbody-posture-webhook]` blocks with `verify_jwt = false`.

## Frontend Pages & Components

### `/howbody-login` (public — `src/pages/HowbodyLogin.tsx`)
- Reads `equipmentNo` & `scanId` from URL.
- If unauth: shows member login (email/phone) → AuthContext signIn → continue.
- If auth: shows member's profile card + "Bind to scanner" CTA.
- Staff variant: search bar (name/phone/member ID) to bind a walk-in member.
- Calls `howbody-bind-user` edge function.
- Success: full-screen teal-tinted card "✅ Step on the scanner now". Auto-polls `howbody_scan_sessions` via Supabase realtime for `status=completed`, then navigates to the new report.
- Errors mapped to friendly toasts.

### Member profile (`src/pages/MemberProfile.tsx`) — extend existing tabs
Add two tabs (or sub-tabs under a new "Scanner" tab to keep it tidy):
- **Body Composition**: latest report hero card (health score gauge), key metrics grid with min/max range bars (`weight`, `bmi`, `pbf`, `fat`, `smm`, `tbw`, `bmr`, `whr`, `vfr`, `metabolic_age`), segmental muscle/fat radar from `jrjh`/`jdzf` arrays, Recharts trend lines, history table.
- **Posture**: 4-image grid (front/left/right/back) with lightbox; angle metrics color-coded against healthy ranges (green/amber/red); measurement table; trend vs previous scan using `*2` fields.

Reuses existing Vuexy card styling + `BenefitTracking`/`MyProgress` patterns.

### `/reports/body/:token` and `/reports/posture/:token` (public — gated)
- Resolve `token` → `howbody_public_report_tokens` → fetch report.
- Gate: only renders if member's plan has `public_report_link = true` and token not expired.
- Same visual layout as the in-app tab, plus QR code (qrcode.react) pointing to current URL for re-share, and "Powered by The Incline Life by Incline" footer per brand rule.

### Settings → new "Body Scanner" panel (`src/components/settings/HowbodySettings.tsx`)
- Three read-only URL fields with copy buttons:
  - QR Login: `${origin}/howbody-login`
  - Body Webhook: `${SUPABASE_URL}/functions/v1/howbody-body-webhook`
  - Posture Webhook: `${SUPABASE_URL}/functions/v1/howbody-posture-webhook`
- "Test connection" button → invokes `howbody-test-connection`, shows token TTL.
- Last 10 webhook events (from a small `howbody_webhook_log` view).
- Mounted as a tab inside existing `Settings.tsx`.

### Membership plan editor — extend existing plan drawer
Add 4 toggles/inputs: `body_scan_allowed`, `posture_scan_allowed`, `scans_per_month`, `public_report_link`. Per project rule, this stays in the right-side **Sheet**, not a modal.

## Secrets to Add

Will request via `add_secret` after approval (DO NOT proceed before user supplies):
- `HOWBODY_BASE_URL`
- `HOWBODY_USERNAME`
- `HOWBODY_APPKEY`

## Theme

Project standard is the existing Vuexy theme (rounded-2xl cards, soft shadows, indigo/violet accents). The user requested a **teal #00d4b8** accent for HOWBODY surfaces — I'll scope the teal to scanner-specific surfaces (health score gauge, scan success screen, public report hero) so it reads as a sub-brand without breaking the rest of the app.

## Out of Scope (this round)

- Multi-device fleet management UI (only URL/test panel; can extend later via existing `DeviceManagement.tsx` if needed).
- AI insights on the report (can layer in via existing `ai-dashboard-insights` later).
- Bulk historical CSV import from HOWBODY portal.

---

**Approve to proceed.** I'll then request the 3 HOWBODY secrets, run the migrations, build the 5 edge functions + config, and wire the pages.