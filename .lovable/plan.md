## Goal

Make Privacy/Terms easily crawlable by Meta/Google for app review, add a 3D body-scanner showcase as a USP on the public site, ensure all AI/social crawlers are explicitly allowed in `robots.txt`, and run a live end-to-end Instagram DM test now that the app is in Live Mode.

---

## Current state (already in place)

- Routes `/privacy-policy`, `/terms`, `/data-deletion` already exist publicly in `src/App.tsx` (lines 168-170) and are in `PUBLIC_PATHS`.
- `src/pages/Auth.tsx` footer already links to all three.
- `src/pages/PublicWebsite.tsx` footer already links to Privacy + Terms.
- Home `/` renders `InclineAscent` → `Scene3D` (3D dumbbell with ScrollControls).
- `index.html` has rich JSON-LD (Organization, HealthClub, WebSite) and OG tags.
- `public/robots.txt` already lists GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Applebot, facebookexternalhit.

What is missing or weak:

1. The home `/` 3D landing page (`ScrollOverlay`) does **not** link to Privacy/Terms — Meta crawler landing on `/` finds no anchor to legal pages.
2. `robots.txt` is missing several relevant crawlers (Twitterbot, LinkedInBot, Meta-ExternalAgent, Meta-ExternalFetcher, Bytespider, Amazonbot, CCBot, cohere-ai, Diffbot) and has a stray "allowlist facebookexternalhit" comment line that should be cleaned.
3. No public showcase for the **3D Body Scanner / HOWBODY** USP — only the dumbbell hero exists.
4. Instagram DM live test has not been executed against the production webhook now that the app is Live.

---

## Changes

### 1. Add Privacy/Terms links to the home 3D landing footer

**File:** `src/components/ui/ScrollOverlay.tsx` (footer block, lines 188-199)

Add a row of small text links above the copyright line: `Privacy Policy · Terms of Service · Data Deletion`. Use `react-router-dom` `Link` so SPA navigation works and Meta's crawler sees real anchors.

### 2. Expand `robots.txt` for AI + social crawlers

**File:** `public/robots.txt`

- Remove the stray "allowlist facebookexternalhit" comment line.
- Add explicit `Allow: /` blocks for: `Twitterbot`, `LinkedInBot`, `Slackbot`, `WhatsApp`, `TelegramBot`, `Discordbot`, `Meta-ExternalAgent`, `Meta-ExternalFetcher`, `meta-externalagent`, `Bytespider`, `Amazonbot`, `CCBot`, `cohere-ai`, `Diffbot`, `YouBot`, `anthropic-ai`, `Omgilibot`.
- Keep existing `Disallow` rules for private app routes intact.
- Keep sitemap + host directives.

### 3. Add a 3D Body Scanner USP section to the public website

**File:** `src/pages/PublicWebsite.tsx` 

Add a new section "3D Body Intelligence" that showcases the HOWBODY scanner USP. Reuse the existing `AvatarGltf`/procedural body component (already loads `public/models/avatar-female.glb`) inside a `Canvas` from `@react-three/fiber` with `OrbitControls` so visitors can rotate the model. Copy: "Step on. Stand still. Get scanned. Posture, body composition, and progress tracked in real 3D — only at Incline."

Also surface a smaller teaser card on the home `ScrollOverlay` (one new scroll page) that pulses the same model and CTA "See your body in 3D" linking to `/website-v1#scanner`.

No new dependencies — `@react-three/fiber@^8.18` and `@react-three/drei@^9.122` are already installed.

### 4. Live Instagram DM end-to-end test

Once the above is deployed, run a live audit against the production webhook:

1. Call `meta-diagnose` edge function via `supabase--curl_edge_functions` to capture: token validity, subscribed fields, last payload shape, last processing result.
2. Query `webhook_ingress_log` and `webhook_processing_log` (last 30 min) via `supabase--read_query` to confirm signature verification + per-event status (`stored` / `placeholder_stored` / `resolve_failed`).
3. Tail `meta-webhook` edge function logs via `supabase--edge_function_logs` filtered by the test sender's IG ID.
4. Ask user to send a fresh DM from a tester account, wait 30 s, then re-query the logs and the CRM `whatsapp_conversations` / `instagram_conversations` table to confirm the message landed.
5. If a `placeholder_stored` row appears (Meta sent stripped `message_edit`), report the exact Graph API error code/subcode from `webhook_processing_log.reason` so we know whether it's a token scope issue, a "Connected Tools → Allow access to messages" issue, or a Meta-side delivery bug.

No code changes are made in this step unless the audit reveals a regression — it is purely diagnostic since v4.4.0 of `meta-webhook` already implements multi-stage resolution + placeholder fallback.

---

## Files touched

- `src/components/ui/ScrollOverlay.tsx` — add legal-links row in footer + (optional) scanner teaser scroll page.
- `public/robots.txt` — expanded crawler allowlist, cleanup.
- `src/pages/PublicWebsite.tsx` — new "3D Body Intelligence" section with interactive model.
- No edge function or DB changes. Instagram test is read-only diagnostics.

## Out of scope

- Rewriting Privacy/Terms copy (already updated in prior turn for Meta review).
- Changes to the 3D dumbbell hero animation.
- Any modification to MIPS / HOWBODY device integration.