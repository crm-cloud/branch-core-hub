## Audit Findings

**Current state of Meta version pinning:**
- `graph.facebook.com` → `v25.0` (correct, latest stable) — used by WhatsApp, Messenger, FB-login Instagram, webhook, templates.
- `graph.instagram.com` → `v23.0` (in `_shared/meta-config.ts` + hardcoded in `test-integration`).
- Two functions still hardcode `v25.0` instead of importing from shared config: `whatsapp-webhook`, `send-whatsapp`, `notify-lead-created`, `manage-whatsapp-templates`, `test-integration` (5 spots). Drift risk on next bump.

**Important note on v25 + Instagram host:** Meta's `graph.instagram.com` (Instagram Business Login API) historically lags `graph.facebook.com` by 1-2 versions. v25.0 is being accepted on the IG host as of the Q1 2026 rollout, but if Meta returns "Unsupported version" we will auto-fallback to v23.0 for that host only (transparent retry, logged). This is the safest path — you get latest where supported, no breakage where not.

**Dual-token reality:** Today `integration_settings` stores ONE row per `(branch_id, provider)`. If you have both an `EAA…` (Page Access Token, covers WhatsApp + IG-via-FB + Messenger) AND an `IGAA…` (IG Business Login token, IG-only), they currently overwrite each other for the `instagram` provider. We need to allow both to coexist and let the dispatcher pick the right one per channel.

---

## Plan

### Part 1 — Unify everything to v25.0 (with smart IG fallback)

1. Update `supabase/functions/_shared/meta-config.ts`:
   - Bump `IG_GRAPH_VERSION` from `"v23.0"` → `"v25.0"`.
   - Add `IG_FALLBACK_VERSION = "v23.0"` constant.
   - Add helper `metaFetchWithFallback(url, init)` that retries on the IG host with v23.0 if Meta returns `error.code === 2635` ("Unsupported get/post request") or HTTP 400 with "version" in the message.
2. Refactor the 5 hardcoded call-sites to import from shared config:
   - `whatsapp-webhook/index.ts:1590`
   - `send-whatsapp/index.ts:26`
   - `notify-lead-created/index.ts:336,359`
   - `manage-whatsapp-templates/index.ts:11-12` (drop local consts, import shared)
   - `test-integration/index.ts:236,309,360,409,419` (use `META_API_BASE` / `IG_API_BASE`)
3. Update the UI hint text in `IntegrationSettings.tsx` (line ~663) to say "v25.0 on both hosts (auto-fallback to v23.0 if IG host rejects)".
4. Bump version comments at top of each touched edge function (e.g., `// v2.3.0 — Phase G: unified to v25.0 across both Meta hosts`).

### Part 2 — Dual-token support (FB + IG simultaneously)

You can absolutely paste BOTH a Facebook Page Access Token AND an Instagram Business Login token for the same branch. Recommended split:

```text
   Capability matrix
   ┌──────────────────┬──────────────┬──────────────┐
   │ Channel          │ EAA (FB)     │ IGAA (IG)    │
   ├──────────────────┼──────────────┼──────────────┤
   │ WhatsApp         │ ✓ (required) │ ✗            │
   │ Messenger DMs    │ ✓ (required) │ ✗            │
   │ Instagram DMs    │ ✓ via Page   │ ✓ direct     │
   │ IG Comments      │ ✓ via Page   │ ✓ direct     │
   │ Webhook signing  │ ✓ App Secret │ ✓ App Secret │
   └──────────────────┴──────────────┴──────────────┘
```

1. Database (no schema change needed — uses existing `integration_settings` JSONB):
   - Allow TWO rows for the same `(branch_id)` with different `provider` values:
     - `provider = 'instagram'` → stores `EAA…` token (FB-login flow).
     - `provider = 'instagram_login'` → stores `IGAA…` token (IG-Business-Login flow).
   - `INSTAGRAM_PROVIDERS` constant in `IntegrationSettings.tsx` already supports a list — add the second entry.
2. `send-message/index.ts` dispatcher:
   - When channel = `instagram`, prefer `instagram_login` row (direct API, lower latency, no Page hop) and fall back to `instagram` row (FB-login) if not present.
   - Already auto-detects token prefix per the existing `detectMetaHost` — keep that logic.
3. `meta-webhook/index.ts`:
   - On inbound IG event, look up matching integration by `recipient.id` (IG user_id) checking BOTH provider rows. Whichever matches signs the reply.
4. UI in `IntegrationSettings.tsx`:
   - Render two cards under Instagram: "Instagram via Facebook (EAA)" and "Instagram Business Login (IGAA)". Each can be configured independently. Show a green "Both connected — using IG Business Login as primary" status when both are active.
5. Test Connection button: tests whichever provider row was clicked, with clear "primary/fallback" labelling in the result toast.

### Part 3 — Wire the Instagram Business Login Redirect URL

The Meta dialog (image-303) requires a Redirect URL for OAuth completion. We currently expose only the webhook URL, which is wrong for the OAuth callback.

1. Create new edge function `supabase/functions/meta-oauth-callback/index.ts`:
   - Accepts `?code=…&state=…` from Meta's redirect.
   - Exchanges `code` → short-lived token via `https://api.instagram.com/oauth/access_token`.
   - Exchanges short-lived → long-lived (60 days) via `https://graph.instagram.com/access_token?grant_type=ig_exchange_token`.
   - Stores the long-lived token in `integration_settings` for `provider='instagram_login'` on the branch encoded in `state`.
   - Redirects browser back to `/settings?tab=integrations&meta_oauth=success`.
2. Update `IntegrationSettings.tsx`:
   - Show the **Redirect URL** field as: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/meta-oauth-callback` with copy button (this is what gets pasted into the "Set up Instagram business login" dialog).
   - Keep the existing **Webhook URL** field as: `…/functions/v1/meta-webhook` (separate purpose — for inbound events).
   - Add an "Authorize with Instagram" button that opens Meta's OAuth dialog with the right `client_id`, `redirect_uri`, `scope`, and a signed `state` carrying the branch_id. This eliminates manual token pasting entirely.
3. Add 50-day expiry warning: cron job (existing `process-comm-retry-queue` or new lightweight job) that auto-refreshes any IG token within 10 days of expiry by calling `/refresh_access_token`, and posts a notification to admins if refresh fails.

### Part 4 — App Review preparation (so tokens stop expiring as "test mode")

Why tokens "keep expiring": your Meta App is in **Development Mode**. In Dev Mode, IG/FB tokens are short-lived (1 hour user tokens, max 60-day Page tokens) AND only work for users explicitly added as App Testers. Going Live + getting permissions approved removes this restriction.

**Required permissions to submit for review** (based on your image-301):
- `instagram_business_basic`
- `instagram_business_manage_messages`
- `pages_messaging` (for Messenger DM replies via Page)
- `pages_show_list` + `pages_read_engagement` (to enumerate Pages)
- `business_management` (Business Manager API)
- `whatsapp_business_messaging` + `whatsapp_business_management` (for WA broadcasts)

**Deliverables we'll prepare for you (in `/mnt/documents/meta-app-review/`):**
1. **App Verification document (PDF)** describing:
   - App name, purpose ("Incline Gym CRM — multi-branch fitness studio management").
   - Per-permission justification with exact screen + button references in the Incline app.
   - Data handling: where tokens are stored (encrypted in `integration_settings`), retention policy.
2. **Screencast script (timestamped, ~3-4 min total)** covering, for each permission:
   - User logs into Incline → Settings → Integrations → connects Instagram.
   - Member sends a DM to the gym's IG → message appears in Incline Inbox.
   - Staff replies from Incline → message arrives back in IG.
   - Same loop for Messenger and WhatsApp.
   - Bulk campaign send + delivery receipt in Live Feed.
3. **Test-user credentials block** (a dedicated `meta-reviewer@theincline.in` account pre-seeded with one branch, one connected IG, sample members) — we'll script the seed migration.
4. **Privacy Policy + Data Deletion URL** (image-306 fields):
   - Privacy: `https://www.theincline.in/privacy` (already exists at `src/pages/PrivacyPolicy.tsx`).
   - Add new public route `/data-deletion` with a form that triggers `meta-data-deletion` edge function (Meta requires a verified callback URL — we'll wire it).
5. **Business Verification reminder**: only required for some advanced perms (e.g., `pages_manage_metadata`). For the perms above, App Review alone is sufficient if the App is owned by a verified Business in Meta Business Manager. If not verified, we'll add a checklist of documents needed (GST cert, address proof).

You handle the actual screen recording and submission in Meta Dashboard; we provide the script, the seed data, and the in-app screens that match the script beat-for-beat so the reviewer's path is unambiguous.

---

## Files to create / modify

| File | Action |
|---|---|
| `supabase/functions/_shared/meta-config.ts` | Bump IG to v25.0, add fallback helper |
| `supabase/functions/{whatsapp-webhook,send-whatsapp,notify-lead-created,manage-whatsapp-templates,test-integration}/index.ts` | Replace hardcoded v25.0 with shared import |
| `supabase/functions/send-message/index.ts` | Prefer `instagram_login` provider, fallback to `instagram` |
| `supabase/functions/meta-webhook/index.ts` | Look up integration across both provider rows |
| `supabase/functions/meta-oauth-callback/index.ts` | NEW — OAuth code→token exchange + long-lived swap |
| `supabase/functions/meta-data-deletion/index.ts` | NEW — Meta-required deletion callback |
| `src/components/settings/IntegrationSettings.tsx` | Two IG cards, Redirect URL field, "Authorize" button, updated hint copy |
| `src/config/providerSchemas.ts` | Add `instagram_login` provider definition |
| `src/pages/DataDeletion.tsx` + route in `App.tsx` | NEW — public deletion request form |
| `supabase/migrations/<ts>_meta_review_seed.sql` | Seed reviewer test account + sample data |
| `/mnt/documents/meta-app-review/` | Generate verification PDF + screencast script + checklist |

No destructive DB changes. No table schema changes (the `integration_settings` JSONB already accommodates both token rows).

## What I need from you to start

Approve this plan, then on the next turn I'll need:
- **Meta App ID** and **App Secret** (paste in Settings → Integrations → Instagram, no secret tool needed since it's stored per-branch in `integration_settings`).
- Confirmation that `meta-reviewer@theincline.in` (or your preferred test email) can be auto-created.
- Whether you want the screencast script in English only or English + Hindi captions for the reviewer.