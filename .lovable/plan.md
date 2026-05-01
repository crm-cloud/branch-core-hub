# Feedback + Google Reviews — Honest Workflow Rebuild

## Why

Today the app implies internal feedback can be "synced" to Google Maps. That is not how Google Business Profile works — only the customer can post a review on Google, and the API only allows fetching/replying to reviews that already exist there. The current `syncToGoogleMyBusiness` is a mock that flips `published_to_google_at` without any API call. We are removing that fiction and replacing it with the real, correct flow: request → track → reply.

---

## 1. Database changes (single migration)

**`branches`** — add Google review presence per branch:
- `google_review_link TEXT` — short link members will be sent (e.g. `https://g.page/r/...`).
- `google_place_id TEXT` — used to fetch reviews via API later.
- `google_review_qr_url TEXT` — generated from the link (storage URL or null; can be derived client-side).

**`feedback`** — replace mock publish with real request/tracking model:
- Drop usage of `published_to_google_at` (keep column for backwards compat, mark deprecated in code; never written).
- Add:
  - `google_review_requested_at TIMESTAMPTZ`
  - `google_review_request_channel TEXT` — `whatsapp | sms | email | in_app`
  - `google_review_request_status TEXT` — `not_sent | queued | sent | delivered | failed`
  - `google_review_request_message_id UUID` — FK to `communication_logs.id` for delivery tracking
  - `google_review_link_clicked_at TIMESTAMPTZ`
  - `google_review_id TEXT` — populated only when a real Google review is matched (existing column kept)
  - `google_review_matched_at TIMESTAMPTZ`
  - `google_review_reply_status TEXT` — `none | drafted | replied | failed`
  - `google_review_reply_at TIMESTAMPTZ`
  - `consent_for_testimonial BOOLEAN DEFAULT false`
  - `consent_for_testimonial_at TIMESTAMPTZ`
  - `recovery_task_id UUID` — FK to `tasks.id` for low-rating cases
  - Rename intent: `is_approved_for_google` → keep column, repurpose as "approved as internal testimonial" (UI label updated). No DB rename to avoid breakage.

**`feedback_google_link_clicks`** (new, optional but useful):
- `id`, `feedback_id`, `clicked_at`, `ip_hash`, `user_agent` — populated by a tiny public edge function the short link redirects through.

**Trigger** on `feedback` insert:
- If `rating >= 4`: enqueue Google review request via existing communications dispatcher (preferred channel = member's preferred channel; fallback order WhatsApp → SMS → email). Set `google_review_request_status = 'queued'`.
- If `rating <= 3`: insert a high-priority `tasks` row assigned to branch manager (title: "Recovery: low feedback from {member}"), notify via in-app notification + WhatsApp to manager, write `recovery_task_id` back. Do NOT request a Google review.

---

## 2. Edge functions

- **`request-google-review`** (new): given `feedback_id`, resolves branch `google_review_link`, member contact, chosen channel → calls existing universal communications dispatcher → writes `communication_logs` row → updates `google_review_request_*` fields. Idempotent on `feedback_id`.
- **`google-review-redirect`** (new, public): public route `/r/:token` records click into `feedback_google_link_clicks`, updates `google_review_link_clicked_at`, then 302s to the branch's `google_review_link`. This is what we actually send members.
- **`fetch-google-reviews`** (new, optional, only runs if Google Business integration is configured): polls Google Business Profile API for the branch's location, upserts reviews into a new `google_reviews` table (`id, branch_id, google_review_id, reviewer_name, rating, comment, created_at, reply_text, reply_at`). Best-effort attempt to match a `feedback` row by member name + recent request window → set `google_review_id` + `google_review_matched_at`.
- **`reply-google-review`** (new): posts a reply via Google API; updates `google_review_reply_*`. Strictly server-side.

If integration is not configured, the fetch/reply functions short-circuit with a 412 — the request flow still works without the integration.

---

## 3. UI — Admin Feedback page (`src/pages/Feedback.tsx`)

Remove `syncToGoogleMyBusiness`. Replace the "Google" column with two columns:

1. **Review Request** — badge: `Not sent | Queued | Sent | Delivered | Failed`, with channel icon, plus "Send" / "Resend" button (calls `request-google-review`). Shown only when `rating >= 4`.
2. **Google Review** — if `google_review_id` set, show "Received ★N", linkable; reply button → opens reply Sheet (writes via `reply-google-review`).

Add a **Recovery** column for `rating <= 3` showing the linked task with status badge.

**Filters** (chip row):
- Rating (1–5, multi-select)
- Category (existing)
- Trainer / Staff
- Unresolved low rating (`rating<=3 AND status<>'resolved'`)
- Google request sent / not sent
- Google review received / not received

**Dashboard cards** (replace current 4 stat cards):
- Average rating (last 30d)
- Low-rating open cases
- Review requests sent (last 30d)
- Google reviews received (last 30d)
- Conversion: requests → matched Google reviews (%)

**Testimonial approval**: rename the `Globe` switch to "Use as testimonial". Disable unless `consent_for_testimonial = true`. Add a "Request consent" button that sends a templated WhatsApp/SMS asking the member to opt in via a signed link (separate edge function `request-testimonial-consent`).

---

## 4. UI — Member feedback (`src/pages/MemberFeedback.tsx`)

After submission:
- If rating ≥ 4: show inline card "Loved it? Help others find us — leave a Google review" with a button that opens the branch `google_review_link` in a new tab and records the click. This is the in-app channel.
- If rating ≤ 3: show "Thanks — a manager will reach out shortly" (no Google ask).
- Add an explicit checkbox "I agree my feedback can be used as a public testimonial" → writes `consent_for_testimonial`.

---

## 5. UI — Branch settings

In `EditBranchDrawer` add a "Google Reviews" section:
- Google review link (paste from Google Business "Get more reviews")
- Google Place ID (optional, needed for API matching)
- Auto-generated QR preview (client-side via `qrcode` lib) with download button for printing at the front desk.

---

## 6. Integrations panel

In `IntegrationSettings.tsx` and `providerSchemas.ts`:
- Rename description "Sync reviews to Google Maps" → **"Track Google Reviews & Reply"**.
- Remove `auto_sync_approved` field.
- Update labels to make clear this integration only **fetches and replies** to reviews; sending review requests works without it (uses the branch link).

---

## 7. Templates & triggers

Add three event templates to `src/lib/templates/eventRegistry.ts`:
- `feedback.google_review_requested` (member-facing, with `{{branch.google_review_link}}` short token)
- `feedback.low_rating_alert` (manager-facing)
- `feedback.testimonial_consent_requested` (member-facing)

These plug into the existing canonical `whatsapp-automation-trigger-system` so admins can edit copy without touching code.

---

## 8. Workflows doc

Update `docs/workflows.md` Feedback section:
- `feedback.created` → branches into `feedback.review_requested` (rating≥4) or `feedback.recovery_opened` (rating≤3).
- `feedback.review_link_clicked`, `feedback.google_review_matched`, `feedback.google_review_replied`.
- Note: app **never** writes a customer review to Google; only replies.

---

## Files touched

- New migration: feedback + branches columns, `feedback_google_link_clicks`, `google_reviews`.
- New edge functions: `request-google-review`, `google-review-redirect`, `fetch-google-reviews`, `reply-google-review`, `request-testimonial-consent`.
- Edited: `src/pages/Feedback.tsx`, `src/pages/MemberFeedback.tsx`, `src/components/branches/EditBranchDrawer.tsx`, `src/components/settings/IntegrationSettings.tsx`, `src/config/providerSchemas.ts`, `src/lib/templates/eventRegistry.ts`, `src/components/dashboard/MemberVoiceWidget.tsx`, `docs/workflows.md`.
- New small components: `FeedbackFiltersBar.tsx`, `GoogleReviewReplyDrawer.tsx`, `RequestTestimonialConsentDialog.tsx`, `BranchGoogleReviewSection.tsx`.

---

## Out of scope

- Real Google OAuth flow UI (still uses existing integration credential pattern).
- Importing historical Google reviews older than 30 days (API limitation).

Approve to proceed.
