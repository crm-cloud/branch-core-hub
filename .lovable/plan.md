

Plan covers all 7 tasks. Audit findings:

- **Task 1**: `test-integration` is fine for Instagram. The real failure shown in screenshots ("Meta API: Invalid appsecret_proof", "Unsupported type: messenger") = the `test-integration` switch has no `messenger` case + Instagram credentials need correct page+token pairing. Inbound webhook (`meta-webhook`) is separate. Need a true "round-trip" test that actually sends a DM via Graph API.
- **Task 2**: Need to dump current schema (134 migrations, 119 tables) into one consolidated SQL file.
- **Task 3**: Auth emails are platform defaults (plain). Transactional sends go via `send-email` edge function — need branded HTML wrapper templates.
- **Task 4**: `AddProductDrawer` initializes `useState` from `product` prop ONCE — never re-syncs when reopened with a different product. Needs `useEffect` reset + Image URL fetch field.
- **Task 5**: `trainers` table has NO `trainer_code` column. Two refs in `GlobalSearch.tsx` + `hrmService.ts`. Add the column via migration with auto-gen trigger.
- **Task 6**: POS payment flow needs card method + transaction_id + slip upload. `payments` table already has `transaction_id`; need `slip_url` column.
- **Task 7**: SEO/AEO/AI indexing audit on public landing.

# Plan: 7-Task Audit & Fix Sprint

## Task 1 — Instagram/Messenger Integration Test (Round-Trip)
- Add `messenger` case to `test-integration` switch (currently missing → "Unsupported type: messenger" toast).
- Replace the read-only `GET /me` Instagram test with a true round-trip: verify token + page link + (optional) send a test DM to a configured admin IG-scoped user ID.
- Improve `appsecret_proof` error path: detect when access_token belongs to a DIFFERENT app than the app_secret and surface that specifically.
- Audit `meta-webhook` GET (challenge), POST (signature verification, message parsing) — confirm working; add structured `console.error` for every Graph API failure with full Meta error payload.
- `send-message` outbound: confirm `appsecret_proof` is appended to BOTH `/me/messages` (Messenger) AND `/{ig-user-id}/messages` (Instagram) endpoints.

## Task 2 — Standalone Supabase Schema Dump
- Generate a single consolidated SQL file at `/mnt/documents/incline_full_schema.sql` containing:
  - All 119 public tables with PKs, FKs, indexes, defaults, check constraints
  - All enums (`app_role`, `benefit_type`, etc.)
  - All ~80+ functions + triggers
  - All RLS policies
  - Storage bucket definitions (`product-images`, `biometric-photos`, etc.) + storage RLS
  - Realtime publication memberships
- Provide a separate `MIGRATION_GUIDE.md` with step-by-step apply instructions (psql command, env var swap, edge function redeploy, secrets re-add).
- **Lovable Cloud is left untouched** — no client/env changes in this round. Files are deliverables only.

## Task 3 — Branded HTML Email Templates
- Create `supabase/functions/_shared/emailTemplates.ts` with a master responsive HTML wrapper (logo, brand color, CTA button, footer, unsubscribe placeholder) + 5 templates: Welcome, Password Reset, Booking Confirmation, Payment Receipt, Membership Expiring.
- Wire `send-email` edge function to detect `templateName` in payload and render the matching HTML; fall back to existing plain text behavior if no template specified.
- Update existing call sites (booking confirmations, payment receipts, lead notifications) to pass `templateName`.
- Note: Supabase Auth emails (signup, password reset) come from the platform — to brand those requires the email-domain setup flow, which is a separate path (will note in plan but not auto-trigger).

## Task 4 — POS Edit Product: Pre-fill + Image URL Fetch
- Refactor `AddProductDrawer` to use `useEffect([product, open])` that resets `formData` when the drawer opens with a (different) product.
- Add an "Image URL" input below the file upload box. On blur/click "Fetch", call a new edge function `fetch-image-url` that downloads the URL server-side (avoids CORS), validates content-type, uploads to `product-images` bucket, returns the storage URL.
- Show inline preview, error toasts for invalid URL / fetch failure / unsupported format (only image/jpeg, image/png, image/webp).

## Task 5 — Fix `trainers.trainer_code` 400 Error
- Migration: add `trainer_code TEXT UNIQUE` to `trainers` + auto-generation trigger (`TR-<branch_code>-<seq>` pattern, matching member_code style).
- Backfill existing rows.
- Add btree index on `trainer_code`.
- Verify `GlobalSearch.tsx` query returns; no other refs exist.

## Task 6 — POS Card Payment Capture
- Migration: add `slip_url TEXT NULL` to `payments` table. (`transaction_id` already exists.)
- Update POS payment dialog: payment method selector (Cash / Credit Card / Debit Card / UPI / Other). When Card or UPI selected, show Transaction ID input + slip upload (uses `payment-slips` storage bucket, created via migration with member-readable RLS).
- Order/receipt detail view: render transaction ID + slip thumbnail (click to lightbox).
- Cash flow remains unchanged.

## Task 7 — SEO / AEO / AI Indexing Audit
- Update `index.html`: title, meta description, canonical, OG tags, Twitter cards, theme-color, JSON-LD `Organization` + `LocalBusiness` (NAP, openingHours for both branches, geo, telephone) + `WebSite` SearchAction.
- Add `public/robots.txt` (allow all, point to sitemap), `public/sitemap.xml` (landing + key public routes), `public/llms.txt` (for AI crawlers — short summary + key URLs).
- Add FAQ JSON-LD on landing if FAQ section exists.
- Ensure single semantic `<h1>` on landing, descriptive alt text on hero images.
- Deliver a short audit report markdown summarizing findings + Lighthouse-style recommendations.

## Files Changed / Created
| File | Change |
|---|---|
| `supabase/functions/test-integration/index.ts` | Add `messenger` case, real IG round-trip test, better error parsing |
| `supabase/functions/send-message/index.ts` | Audit + harden Graph API error logging |
| `supabase/functions/_shared/emailTemplates.ts` | **New** — Master HTML email wrapper + 5 templates |
| `supabase/functions/send-email/index.ts` | Render branded HTML when `templateName` provided |
| `supabase/functions/fetch-image-url/index.ts` | **New** — Server-side image download → storage upload |
| `src/components/products/AddProductDrawer.tsx` | useEffect reset on product change + Image URL fetch UI |
| `src/components/search/GlobalSearch.tsx` | Verify after migration |
| `src/pages/POS.tsx` (+ payment dialog) | Card method + transaction ID + slip upload |
| `src/components/billing/InvoiceViewDrawer.tsx` (or receipt view) | Display transaction ID + slip thumbnail |
| `index.html` | Full SEO meta + JSON-LD |
| `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt` | **New** |
| Migration | `trainer_code` column + trigger + backfill; `slip_url` on payments; `payment-slips` storage bucket + RLS |
| `/mnt/documents/incline_full_schema.sql` | **New** — Consolidated standalone dump |
| `/mnt/documents/MIGRATION_GUIDE.md` | **New** — Apply instructions |
| `/mnt/documents/SEO_AUDIT_REPORT.md` | **New** — Audit findings |

## What I'm NOT Building
- Switching the live Lovable client to an external Supabase project (you confirmed dump-only).
- Custom Supabase Auth email branding (requires email-domain DNS setup — separate flow; will mention in chat).
- Marketing/promo email templates (only transactional templates).
- Auto-trigger for SEO ranking improvements (organic process; only on-page fixes).

