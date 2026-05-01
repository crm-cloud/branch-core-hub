
## Overview

Five workstreams: swap the homepage to InclineAscent, retire PublicWebsiteV1, purge stale error_logs, enhance the unified AI brain, and audit automations.

---

## Epic 1: Route Swap — InclineAscent as `/`

- Change `src/App.tsx`:
  - Set `/` to render `<InclineAscent />` (wrapped in Suspense since it's lazy-loaded)
  - Remove the `/ascent` route (no longer needed)
  - Remove `/website-v1` route
  - Remove the `PublicWebsiteV1` import entirely
- The privacy/terms/data-deletion footer links already exist in `ScrollOverlay.tsx` (lines 198-204) — no changes needed there.
- Update `public/sitemap.xml` to remove `/website-v1` and `/ascent` entries if present.

## Epic 2: Delete PublicWebsiteV1

- Delete `src/pages/PublicWebsiteV1.tsx` (1127 lines) and `src/components/public/ScannerHero3D.tsx` (no longer referenced).
- Remove any remaining imports or references across the codebase.

## Epic 3: Clean Up error_logs

- Run a database migration (or direct cleanup) to mark all 13 open error_logs as `resolved` since they are stale errors from the previous crash and old config issues:
  - 4x "column facilities.status does not exist" (known schema mismatch — needs separate fix)
  - 1x "basename is null" crash (already fixed)
  - 1x 404 for `/publicwwesitev1` (typo, irrelevant)
  - Remaining: transient network/API errors
- Also fix the `facilities.status` column issue — check if the Settings page queries a non-existent column, and either add the column or fix the query.

## Epic 4: Enhance AI Brain

- **Improve context hydration**: Add facility list, class schedule, and pricing data to the system prompt so the AI can answer common questions (timings, prices, amenities) without tool calls.
- **Self-booking service**: The AI already has `book_facility_slot` tool access for members. Enhance the prompt to guide members through slot selection conversationally (ask date, time, facility) before calling the tool.
- **Instagram lead capture parity**: Verify the meta-webhook is correctly calling `runUnifiedAgent` so Instagram/Messenger leads get the same capture flow as WhatsApp.
- **Story reply refinement**: Currently skips text-less story replies. Add a friendly one-liner auto-reply for story mentions that have media but no text (e.g., "Thanks for sharing!") instead of complete silence.

## Epic 5: Audit Automations

- **Lead Nurture Follow-up** (`lead-nurture-followup`): Verify it correctly routes messages via `send-message` for all platforms (already updated in prior edit). Check for stuck follow-ups in the database.
- **Retention Nudges** (`run-retention-nudges`): Confirm pg_cron job is active and nudge logs are being written.
- **Scheduled Campaigns** (`process-scheduled-campaigns`): Confirm it's running (logs show recent boot/shutdown cycles — healthy).
- **Comm Retry Queue** (`process-comm-retry-queue`): Confirm it's cycling correctly.

---

## Technical Details

### Files Modified
- `src/App.tsx` — route changes, remove PublicWebsiteV1 import
- `public/sitemap.xml` — remove stale URLs
- `supabase/functions/_shared/ai-agent-brain.ts` — enrich system prompt with gym data, improve booking flow instructions
- `supabase/functions/meta-webhook/index.ts` — story mention friendly reply

### Files Deleted
- `src/pages/PublicWebsiteV1.tsx`
- `src/components/public/ScannerHero3D.tsx`

### Database
- Migration to resolve all open error_logs
- Check/fix `facilities.status` column reference (add column or fix query)
- Query automation tables (retention_nudge_logs, communication_logs) to verify health
