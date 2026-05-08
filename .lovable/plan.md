
# Google Reviews — Single Edge Function + Inbound Tab (final plan)

## Audit of existing Google Business integration

**Status: UI ready, edge function missing.**

| Layer | Where | Status |
|---|---|---|
| Provider listed in Integrations grid | `src/pages/Integrations.tsx` (id: `google_business`) | ✅ |
| Branch-scoped config (only branch-specific provider) | `IntegrationSettings.tsx` line 1106 | ✅ |
| Field schema | `providerSchemas.ts` → `google_business_google_business` | ✅ — captures `account_id`, `location_id`, `auto_fetch_reviews`, OAuth `client_id`, `client_secret`, `api_key` |
| Per-branch storage | `integration_settings(provider='google_business', branch_id=…)` | ✅ |
| Test connection + fetch + reply edge fn | — | ❌ **Does not exist yet** |
| Branch's Google Maps short link | `branches.google_review_link` | ✅ schema present, ❌ NULL today |

So the credentials plumbing is fully built — we just need to consume it. **No new secrets or new integration UI needed.** Owner only has to fill in OAuth fields per branch + paste the "Get more reviews" short link in Edit Branch.

## Build plan (one edge function, no public publishing)

### 1 · Single edge function: `google-reviews-brain`
All five jobs live in one function, dispatched by an `action` field in the body. Same auth, same CORS, same try/catch wrapper, same version comment.

| `action` | Purpose |
|---|---|
| `test_connection` | Settings → "Test" button. Loads creds from `integration_settings`, hits Google Business Profile API `accounts.locations.get`, returns OK / scope-missing / token-expired. |
| `fetch_reviews` | Cron-triggered. For every branch where `is_active=true` and `auto_fetch_reviews='true'`, calls `accounts/{account_id}/locations/{location_id}/reviews`, upserts into `google_reviews_inbound` keyed on `google_review_id`. New rows trigger the classify step inline. |
| `classify` | For one or more inbound rows: fuzzy-matches author name against `members` + `leads` for that branch (pg_trgm > 0.6), pulls evidence (last attendance, plan history, lead source), then calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with tool-calling to get `{classification, reasoning, draft_reply}`. Writes back to the row. Auto-creates a recovery `tasks` row when classification is `unhappy_member`. |
| `reply` | Posts `ai_draft_reply` (or staff-edited reply) via Google API `reviews.updateReply`. Stamps `replied_at`, `reply_status='sent'`. Falls back to "copy + open Maps" if API call fails. |
| `request_member_review` | Replaces the old `request-google-review` function — same dispatch-communication funnel, kept here so all Google logic is in one file. The old function becomes a thin shim that forwards to this one (so we don't break anything currently calling it). |

Why one function: shared auth resolver, shared OAuth token refresh, shared error reporting via `log_error_event`, lower cold-start surface, easier version pinning. Routing is a single `switch (action)`.

### 2 · DB schema (one migration)
- New table `google_reviews_inbound` — columns: `google_review_id` (text, unique), `branch_id`, `author_name`, `author_photo_url`, `rating`, `text`, `posted_at`, `match_type` (`member|lead|none`), `matched_member_id`, `matched_lead_id`, `match_confidence`, `match_evidence` (jsonb), `ai_classification` (`genuine|unhappy_member|suspected_fake|spam`), `ai_reasoning`, `ai_draft_reply`, `reply_status` (`draft|approved|sent|reported|dismissed`), `replied_at`, `reported_to_google_at`. RLS: branch-scoped staff/owner only via existing `has_capability()`.
- Indexes on `(branch_id, posted_at desc)`, `(reply_status)`, `(ai_classification)`, plus `pg_trgm` GIN index on `members.full_name` and `leads.full_name` (idempotent — only if missing) to make name matching fast.
- One pg_cron job, every 4 hours, calling `google-reviews-brain` with `action='fetch_reviews'`. Runs through the existing cron pattern (service-role bearer).

### 3 · UI: new tab inside `/feedback`
The existing `Feedback.tsx` becomes a tabbed page with two tabs:
- **Member Feedback** (current page, unchanged).
- **External Reviews** (new) — pulls from `google_reviews_inbound` for the active branch.

Layout of the new tab:
- KPI strip: Inbound this week · Avg incoming rating · Suspected fakes · Replies pending.
- Filters: rating, classification, reply status.
- Card list (one per review): rating + author + date · review text · **Match & Evidence** chips ("Active member · 18 visits last 30 days", "Lead from Meta Ads · never converted", "No record found"), · **AI Verdict** badge + reasoning · editable **Draft reply** textarea · action row: **Send reply**, **Mark as fake → Report**, **Dismiss**, optional "Did you know this reviewer?" member-picker that overrides the auto-match.

Refreshes via realtime on `google_reviews_inbound` so new fetched reviews appear without reload.

### 4 · No public website surface
Confirmed — we will **not** read approved testimonials anywhere on the marketing site. The `consent_for_testimonial` and `is_approved_for_google` columns stay in the DB so we can switch publishing on after you exit pre-opening, but no public component reads them in this build.

### 5 · Settings polish (small)
- Add **Test connection** button next to the Google Business config form (calls `google-reviews-brain` with `action='test_connection'`). Clear OK/error toast.
- Add inline warning in `Feedback.tsx` and `MemberFeedback.tsx` when active branch has no `google_review_link` configured: "Configure your Google Review link in Settings → Branches" — kills today's silent 412.
- Update `mem://features/feedback-google-reviews-boundary` to reflect the unified function and the External Reviews tab.

## Non-goals (explicit)
- No auto-replying. Every reply is staff-approved one-click.
- No public testimonial publishing — kept dormant.
- No competitor name detection / accusations — AI surfaces evidence, staff decides.
- Old `request-google-review` function stays alive as a thin shim → zero migration risk for existing callers.

## Tech notes
- Lovable AI Gateway via `LOVABLE_API_KEY` (no new secret), tool-calling for structured `{classification, reasoning, draft_reply}` per the AI Gateway pattern.
- All Google API calls go via OAuth token from `integration_settings` config; refresh token logic lives inside `google-reviews-brain`.
- All staff alerts route through `dispatch-communication` (CI guard prevents direct `communication_logs` inserts).
- Errors funnel through `log_error_event` RPC with fingerprint dedup.

After approval I'll: (1) add the migration + cron, (2) build `google-reviews-brain`, (3) add the External Reviews tab + Test button + branch-link warning, (4) shim the old function, (5) update memory + doc.
