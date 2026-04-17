

Massive multi-domain sprint. I'll group into focused work packages and lean on existing RPCs/services rather than introducing parallel paths.

# Plan: POS, Payments, Leads, Member Lifecycle, Meta, Storage — Audit & Fix Sprint

## Package 1 — POS Branch + Order Model Normalization (P1)
**Files:** `src/pages/POS.tsx`, `src/services/storeService.ts`, `src/pages/Store.tsx`, `src/pages/Invoices.tsx`, `src/pages/MemberStore.tsx`

- **POS.tsx (line 123):** Replace `supabase.from('branches').select().limit(1)` with `effectiveBranchId` from `useBranch()` (already wired in `BranchContext`). Block checkout with toast when no branch is selected.
- **Order model:** Stop using `notes ILIKE 'Store purchase…'`. Add a typed marker on invoice creation:
  - POS sales already set `pos_sale_id` → use that (Invoices.tsx already does).
  - Member self-service store: add a migration column `invoices.source TEXT` (`'pos' | 'member_store' | 'ecommerce' | 'membership' | 'manual'`, default `'manual'`) backfilled from existing patterns (`pos_sale_id NOT NULL` → `pos`, `notes LIKE 'Store purchase by member'` → `member_store`).
  - Update `Store.tsx` filter to `source IN ('pos','member_store','ecommerce')` instead of notes parsing.
  - Update `MemberStore.tsx` and `storeService.ts` to set `source` explicitly.
- **Deprecate** unused `createEcommerceOrder()` path OR wire it as the single member-store entry point — pick the simpler: keep current MemberStore direct invoice path but stamp `source='member_store'`.

## Package 2 — Send Payment Link End-to-End (P1)
**Files:** `src/components/invoices/SendPaymentLinkDrawer.tsx`, `src/services/paymentService.ts`, `supabase/functions/create-payment-order/index.ts`, `supabase/functions/create-razorpay-link/index.ts`

- Remove `/member/pay?invoice=…` URL building. Replace with: drawer calls `create-razorpay-link` (already deployed v1.1.0) → receives short link → uses **that** URL in WhatsApp/email body.
- **Naming alignment:** `create-payment-order` checks `integration_type = 'payment'` while frontend writes `'payment_gateway'`. Fix the edge function to read `'payment_gateway'` (matches `IntegrationSettings.tsx` + `paymentService.ts`).
- WhatsApp delivery: route through `send-message` edge function (real Graph API) when WhatsApp is configured; fall back to `wa.me` only when not configured. Email delivery: route through `send-email` (transactional) instead of `mailto:`. Both receive the real Razorpay short link.
- Public `/member/pay` route already exists (MemberCheckout.tsx) — keep it as a fallback landing for invoice lookup, but the **primary** delivered URL is the Razorpay short link.

## Package 3 — Lead Capture Normalization (P1)
**Files:** `supabase/functions/webhook-lead-capture/index.ts`, `supabase/functions/capture-lead/index.ts`, `src/components/leads/AddLeadDrawer.tsx`, embedded form, chatbot capture

- Migration: add `leads.raw_payload JSONB`, `leads.utm_source/medium/campaign/term/content TEXT`, `leads.referrer TEXT`, `leads.landing_url TEXT` (most likely already partially exist — audit first; only add missing).
- Edge functions: write **structured** fields to columns, store the **full** inbound JSON in `raw_payload`, keep `notes` strictly as the free-text user message. No more "kitchen sink in notes".
- Frontend `AddLeadDrawer`: surface UTM fields as optional advanced section.
- Backward compat: existing leads keep their current `notes` content; new fields default-null.

## Package 4 — Member Self-Service Lifecycle (P1/P2)
**Files:** `supabase/functions/send-reminders/index.ts`, `src/services/communicationService.ts`, `src/utils/pdfGenerator.ts`, `supabase/functions/create-member-user/index.ts`, `src/components/members/AddMemberDrawer.tsx`, `src/components/benefits/BookBenefitSlot.tsx`

- **send-reminders:** Replace `/member/...` paths with actual app routes (`/my-invoices`, `/my-classes`, `/my-benefits`). Replace log-only sends with real `send-message` (WhatsApp) + `send-email` invocations, gated by `reminder_configurations`.
- **communicationService:** WhatsApp uses `send-whatsapp` edge function (Graph API), not `wa.me`. Email uses `send-email`. Keep `wa.me` only as explicit "open WhatsApp app" UX action, not as the send mechanism.
- **PDFs:** Persist generated invoice PDFs to a new `invoice-pdfs` storage bucket (private, member+staff RLS). Return signed URL for email/WhatsApp attachment. Keep existing print-window as a UX option.
- **create-member-user:** Read & persist `avatarUrl`, `governmentIdType`, `governmentIdNumber`. Default new members to `status='inactive'` (or `pending`); flip to `active` only when first paid membership invoice fully paid (already handled in `record_payment` RPC — extend it to also activate the member row).
- **BookBenefitSlot:** Stop direct insert into `benefit_bookings`. Call `book_facility_slot` RPC instead — it enforces capacity, duplicates, frequency limits.

## Package 5 — Meta Messenger: Decide & Implement OR Hide (P2)
**Files:** `src/pages/Integrations.tsx` / `IntegrationSettings.tsx`, `src/utils/communication.ts`, `supabase/functions/test-integration/index.ts`, `supabase/functions/send-message/index.ts`, `supabase/functions/meta-webhook/index.ts`

- Audit: `IntegrationSettings.tsx` only lists `payment_gateway|sms|email|whatsapp|google_business` — Messenger is NOT a UI option. The "Unsupported type: messenger" toast must be coming from somewhere else (likely the test-integration switch). 
- **Decision:** since `meta-webhook` and `send-message` already handle Messenger inbound + outbound (page_id, appsecret_proof), **complete the path** rather than hide:
  - Add `'messenger'` to `IntegrationSettings.tsx` provider list with credential fields (page_id, page_access_token, app_secret).
  - Add `messenger` case in `test-integration` (Graph `/me?fields=id,name`).
  - Extend `communication.ts` channel union to include `messenger` (mirror whatsapp routing).
- If user prefers to hide instead, we'll just remove the trigger sites — confirm during build if needed.

## Package 6 — Product Image Upload Diagnostics (P3)
**Files:** `src/components/products/AddProductDrawer.tsx`, `src/services/productService.ts`, migration audit for `products` storage bucket policies

- Verify `products` bucket exists, `public=true`, RLS allows `authenticated` insert. Run linter on storage policies.
- Improve `uploadProductImage` error reporting: surface `error.statusCode`, `error.message`, and bucket name in the toast (currently swallowed). Add `console.error` with full Supabase error object.
- Add a pre-upload size + MIME validation (≤5MB, jpeg/png/webp/gif) with explicit toast.
- The new `fetch-image-url` edge function already provides the URL-based path as a CORS-safe alternative — confirm it's wired in `AddProductDrawer`.

## Package 7 — AI Fitness Plan Builder (Epics 1-4)
**Files:** `src/pages/AIFitness.tsx`, new `src/components/fitness/AIGeneratorModal.tsx`, new `src/components/fitness/ManualPlanBuilder.tsx`, `src/components/fitness/AssignPlanDrawer.tsx`

- **AIFitness page redesign:** Tabs `Global Templates | Member Plans`. Top-right "Create New Plan" dropdown → Generate with AI (Sparkle) | Build Manually (Wrench).
- **AIGeneratorModal:** Multi-step Sheet (Goal → Experience → Days/week → Diet → optional Member link via member autocomplete). On submit, call new `generate-fitness-plan` edge function (Lovable AI Gateway, `google/gemini-2.5-flash`) with streaming. Render skeleton then editable Markdown editor; "Save as Template" or "Assign to Member".
- **ManualPlanBuilder:** Day accordion for workouts (Add Exercise: name/sets/reps/rest), meal sections for diet (Breakfast/Lunch/Dinner/Snacks with macros + calories). Save target picker (Template vs Member).
- **Floating action bar on saved plan:** Download PDF (jsPDF, branded with org logo + member name + structured tables), Send WhatsApp (uses real `send-whatsapp` with PDF link from new `fitness-plans` storage bucket), Send Email (uses `send-email` with branded HTML template).
- Schema: `fitness_plans (id, branch_id, type='workout'|'diet'|'combined', scope='template'|'member', member_id NULL, trainer_id, title, content JSONB, pdf_url, created_at)` + RLS.

## Files Summary
| File | Change |
|---|---|
| `src/pages/POS.tsx` | Use `effectiveBranchId`; block on no branch |
| `src/services/storeService.ts` | Set `source` on invoices; remove notes-based marking |
| `src/pages/Store.tsx` | Filter by `invoices.source` not notes |
| `src/pages/MemberStore.tsx` | Stamp `source='member_store'` |
| Migration | `invoices.source` column + backfill; `leads.raw_payload`+UTM cols (only missing); `fitness_plans` table; `invoice-pdfs` + `fitness-plans` storage buckets |
| `src/components/invoices/SendPaymentLinkDrawer.tsx` | Call `create-razorpay-link`; route via send-message/send-email |
| `supabase/functions/create-payment-order/index.ts` | Read `integration_type='payment_gateway'` |
| `supabase/functions/webhook-lead-capture/index.ts` + `capture-lead/index.ts` | Map structured fields; `raw_payload` JSONB; clean `notes` |
| `src/components/leads/AddLeadDrawer.tsx` | Optional UTM fields |
| `supabase/functions/send-reminders/index.ts` | Real send-message/send-email; correct routes |
| `src/services/communicationService.ts` | Real edge function sends, not wa.me/mailto |
| `src/utils/pdfGenerator.ts` | Persist to `invoice-pdfs` bucket; return signed URL |
| `supabase/functions/create-member-user/index.ts` | Read all profile fields; default `inactive` |
| `supabase/functions/record_payment` (migration) | Activate member on first paid membership |
| `src/components/benefits/BookBenefitSlot.tsx` | Use `book_facility_slot` RPC |
| `src/pages/Integrations.tsx`/`IntegrationSettings.tsx` | Add Messenger provider |
| `src/utils/communication.ts` | Add `messenger` channel |
| `supabase/functions/test-integration/index.ts` | Add `messenger` case |
| `src/services/productService.ts` + `AddProductDrawer.tsx` | Verbose error reporting; size/MIME validation |
| `src/pages/AIFitness.tsx` (+new modal/builder/edge fn) | Full Epic 1-4 build |
| `supabase/functions/generate-fitness-plan/index.ts` | **New** — Gemini streaming via Lovable AI |

## Regression Checklist (delivered after build)
1. POS: select branch → ring up sale → invoice appears in Invoices (filter by branch) AND in Store POS Sales view.
2. Member self-service store purchase → invoice appears in Store with `source='member_store'`.
3. Send Payment Link → real Razorpay short link delivered via WhatsApp + email; clicking pays; webhook updates invoice to `paid`.
4. Webhook lead capture → structured fields populated; `raw_payload` has full body; `notes` clean.
5. Member registration → all fields persist; member starts `inactive` until first paid membership invoice.
6. Benefit booking → enforced by RPC (capacity/duplicate/limit toasts work).
7. Messenger integration tab visible; test button passes.
8. Product image upload — clear error message on failure; URL fetch works.
9. AI Fitness: generate → edit → save as template OR assign to member → download PDF → WhatsApp/email delivery.

## What I'm NOT Building
- Switching member status engine to a separate state machine (extending existing `record_payment` RPC instead).
- Replacing `pdfGenerator` print-window entirely (keeping as UX option, adding persisted PDFs).
- Custom Supabase Auth email branding (separate email-domain DNS flow).

