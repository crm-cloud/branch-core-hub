# Howbody 3D Scanner — Audit & Completion Plan

## Audit: What already exists

Most of the "epic sprint" is already built. Here's the honest state:

| Module | Status | Notes |
|---|---|---|
| Epic 1 — QR receiver page | **Already exists** | `src/pages/HowbodyLogin.tsx` mounted at `/scan-login` and `/howbody-login`. Reads `?equipmentNo=` & `?scanId=`, prompts login, supports member auto-bind + staff search-and-bind, realtime "scan complete" navigation. No new page needed. |
| Epic 2 — Bind / handshake edge function | **Already exists** | `supabase/functions/howbody-bind-user/index.ts` does token cache → `setUserInfo` with thirdUid/age/height/sex, enforces scan-quota, persists `howbody_scan_sessions`. |
| Epic 3 — Webhook receivers | **Already exists, split into two** | `howbody-body-webhook` (composition) + `howbody-posture-webhook` (posture, including `murl` .obj + frontImg/leftImg/rightImg/backImg). Both validated via `appkey` header, idempotent on `data_key`, mark session completed, fire `deliver-scan-report`. **No need to merge into one** — split is cleaner and matches Howbody's two distinct push endpoints. |
| Epic 4 — 3D avatar render | **Partially built** | `MemberBodyAvatarCanvas.tsx` currently renders an SVG silhouette. It does NOT yet load `model_url` from `howbody_posture_reports`, and metrics from body+posture are not overlaid. |
| Credentials | **Env-only today** | `HOWBODY_BASE_URL`, `HOWBODY_USERNAME`, `HOWBODY_APPKEY` already set as Lovable Cloud secrets. No UI to edit. User wants this moved to the DB so admins can rotate keys without redeploying. |

Conclusion: this is **not** a build-from-scratch sprint — it's an integration completion + UX upgrade.

## What the user actually needs

1. **Dynamic credentials UI** (store in DB, edge functions read it, fall back to env).
2. **Wire the .obj model + scan metrics into the avatar canvas**.
3. **End-to-end test** the whole flow.
4. Answer: do we need device id / serial number?

## Plan

### 1. Dynamic Howbody credentials (admin UI + DB-backed loader)

**DB migration**

Reuse the existing `integration_settings` table (already used for WhatsApp/SMS/Payments per the universal dispatcher pattern). Add a single global row:

```
integration_type = 'body_scanner'
provider         = 'howbody'
branch_id        = NULL  (global)
config = {
  base_url: "https://prodapi.howbodyfit.com/howbody-admin",
  username: "TechnicalSupport2026430"
}
secrets = { app_key: "key-tFnxrvi9..." }   -- jsonb, never returned to client
is_active = true
```

If `integration_settings` already has a `secrets` jsonb column, use it; otherwise add it. Reads from the client UI return only `config` (never `secrets`); the edge functions read both via service role.

**Shared loader change** — `supabase/functions/_shared/howbody.ts`

Replace `howbodyCreds()` with an async `getHowbodyCreds()` that:
1. Selects the active `body_scanner / howbody` row from `integration_settings`.
2. Falls back to the existing env vars if the row is missing or inactive (zero-downtime migration).
3. Caches per-invocation.

Update `getCachedToken()` and `howbodyAuthedHeaders()` to `await` it. All 5 edge functions (`howbody-bind-user`, `howbody-body-webhook`, `howbody-posture-webhook`, `howbody-test-connection`, `howbody-report-pdf`) inherit the change automatically.

**Webhook auth** — the inbound webhooks currently compare against `Deno.env.get("HOWBODY_APPKEY")`. Change to compare against the DB `secrets.app_key` (with env fallback) so rotating in the UI also rotates the inbound check.

**Admin UI** — extend `src/components/settings/HowbodySettings.tsx`

Add a new card above the "Test connection" card:

- Inputs: **Base URL**, **Username**, **App Key** (masked, show/hide eye, paste support).
- Save button → upserts via a new tiny edge function `howbody-save-credentials` (admin-only, role-checked) that writes `config` + `secrets` into `integration_settings`. We use an edge function so the `app_key` never round-trips through a client-readable query.
- Status badge: "Configured (DB)" / "Using env fallback" / "Not configured".
- "Run test" button continues to call `howbody-test-connection`, which now uses the DB creds.

Role-gated to `owner` / `admin` only.

### 2. 3D avatar — render the Howbody .obj + metrics

**Hook** — new `src/hooks/useLatestHowbodyScan.ts`

Returns the latest body report and latest posture report for `member_id`, joined into a single object: `{ body, posture, model_url, images, capturedAt }`.

**Component** — rewrite `src/components/progress3d/MemberBodyAvatarCanvas.tsx`

- If `model_url` exists → render with `@react-three/fiber` + `@react-three/drei`'s `useLoader(OBJLoader, model_url)` inside a `<Suspense>` with `<OrbitControls>`, `<Environment preset="studio">`, soft lighting.
- Side panel overlay (absolute, right side, glass card per Vuexy aesthetic) showing a curated metric list:
  - Body: Health Score, Weight, BMI, Body Fat %, Skeletal Muscle Mass, BMR, Visceral Fat, Metabolic Age.
  - Posture: Posture Score, Head Forward, Shoulder L/R, Pelvis Forward.
- "View photos" toggle → swaps the 3D canvas for the front/left/right/back images grid.
- Loading + error states; if no `model_url`, falls back to current `MemberBodyAvatarSvg`.
- Versions pinned per project rules: `@react-three/fiber@^8.18`, `@react-three/drei@^9.122.0`, `three@>=0.133`. (Need to verify they're already installed; if not, install.)

**Where it's used** — `MyProgress.tsx` and the existing 3D card on the member profile already render `MemberBodyAvatarCanvas`, so they get the upgrade automatically.

### 3. Device id / serial number — answered

**No separate "device id" field is needed in our schema.** Howbody's `equipmentNo` (sent in the QR query string and echoed in webhook payloads) **is** the device serial. We already:
- Capture it in `howbody_scan_sessions.equipment_no`.
- Persist it in `howbody_body_reports.equipment_no` and `howbody_posture_reports.equipment_no`.
- Pass it back to Howbody in `setUserInfo`.

The only optional add (low priority, not in this plan) would be a `howbody_devices` reference table mapping `equipment_no → branch_id` so multi-branch gyms know which scanner produced a report. We can add that later when a second device is on-site.

### 4. End-to-end testing

After deploy, run this test matrix and record results. The user must perform the physical-scanner steps; Lovable runs the API steps.

| # | Step | Tool / who | Pass criteria |
|---|---|---|---|
| 1 | Save creds via new UI | User in browser | Toast "Saved", status badge flips to "Configured (DB)" |
| 2 | Run "Test connection" | User in browser | Green check, token expiry shown |
| 3 | `curl howbody-test-connection` directly | `supabase--curl_edge_functions` | `{ ok: true }` |
| 4 | Open `/scan-login?equipmentNo=TEST&scanId=FAKE` while logged out | Browser | Sign-in CTA renders, query params preserved |
| 5 | Same URL while logged in as a member | Browser | Auto-binds, friendly error from Howbody (`406 invalid scan parameters` is expected for fake IDs — proves handshake works) |
| 6 | Real scan from the physical S580 | Gym staff | Member sees "You're linked!", scanner accepts the session |
| 7 | Body composition push | Howbody → webhook | Row in `howbody_body_reports`, `howbody_scan_sessions.status='completed'`, `deliver-scan-report` invoked |
| 8 | Posture push | Howbody → webhook | Row in `howbody_posture_reports` with `model_url` populated |
| 9 | Open member's MyProgress | Browser | 3D `.obj` model renders, metrics panel populated |
| 10 | Edge logs sweep | `supabase--edge_function_logs` for each function | No 500s, only the expected 401 if appkey ever drifts |

If any step fails I capture the log, fix, redeploy, and re-run.

## Technical details

**New files**
- `supabase/functions/howbody-save-credentials/index.ts` (admin-only, role-gated, writes config + secrets to `integration_settings`).
- `src/hooks/useLatestHowbodyScan.ts`.

**Modified files**
- `supabase/functions/_shared/howbody.ts` — async `getHowbodyCreds()` with DB→env fallback, used by `getCachedToken()` and `howbodyAuthedHeaders()`.
- `supabase/functions/howbody-body-webhook/index.ts` + `howbody-posture-webhook/index.ts` — appkey check uses DB secret with env fallback.
- `src/components/settings/HowbodySettings.tsx` — adds credentials card (base URL, username, masked app key, save, status badge).
- `src/components/progress3d/MemberBodyAvatarCanvas.tsx` — renders `.obj` via three-fiber + metrics overlay; falls back to SVG if no scan.

**Migration**
- `add_body_scanner_integration_row.sql` — ensures `integration_settings.secrets jsonb` column exists, inserts/updates the singleton `body_scanner / howbody` row using the credentials the user pasted (Base URL, Username, App Key above), default `is_active = true`. Pre-seeds the system so day-one works without the user touching the UI.

**Design notes (Vuexy)**
- Credentials card: rounded-2xl, white, soft shadow, teal icon badge, masked input with eye toggle.
- 3D viewer: dark gradient backdrop for contrast, glass-morphism metric panel `bg-white/70 backdrop-blur rounded-2xl`, lucide icons inside soft colored badges.

**RBAC**
- Credentials UI + save edge function: `owner` / `admin` only.
- Avatar viewer: any authenticated user who can already see the member.

**Risk / rollback**
- Edge loader keeps the env fallback, so if the DB row is deleted or misconfigured the system reverts to today's behavior.
- Webhooks remain backward-compatible with the existing env appkey during cutover.

## Out of scope (deferred, per your "lite & safe" preference)

- Multi-device branch mapping table.
- Per-branch Howbody credentials (we keep one global row; easy to extend later).
- Migrating the existing two split webhooks into one combined endpoint — split matches Howbody's spec and avoids regressions.

Approve and I'll execute in this order: migration → shared loader → save-creds function → webhook appkey switch → settings UI → 3D viewer → end-to-end test sweep.
