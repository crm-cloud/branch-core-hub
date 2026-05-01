# Platform Polish & Growth Systems Sprint

This is a large multi-phase sprint. Rather than try to land everything in one pass, I'll execute it in **3 phases**, each shippable on its own. Each phase ends in a working, regression-safe state so you can pause/redirect between phases.

---

## Phase 1 — Accuracy & Self-Service Gaps (foundational)

Goal: stop showing wrong numbers, surface what members already own, and close obvious self-service dead-ends. No new infra.

### 1.1 Member Dashboard accuracy
- **Benefit balances include purchased add-ons**: update `MemberDashboard.tsx` + `useBenefits` to merge plan-granted entitlements with `benefit_usage` purchased credits (single source of truth = `benefit_ledger`). Show "Included / Purchased / Used / Remaining" per benefit.
- **Dues & Pay Now**: promote a single primary CTA card on dashboard when `pending_dues > 0` linking straight to `/member/pay`. Show invoice count + oldest due date.
- **Request/status visibility**: add a compact "My Requests" widget (freeze, transfer, escalations) with state badges using existing `approval_requests`.
- **Add-on CTAs**: surface eligible add-ons (facility passes, PT top-ups) for the member's active plan + branch.

### 1.2 Trainer / Ops Dashboard KPI accuracy
- **Branch filter correctness**: audit `TrainerDashboard.tsx` and `StaffDashboard.tsx` queries — every aggregate must respect `BranchContext` (or "All branches" for owners only).
- **Revenue vs payout terminology**: rename misleading labels — trainers see "My Earnings / Commissions", ops sees "Branch Revenue". Add tooltips clarifying what each number includes.
- **Trainer workflow widgets**: PT clients count, upcoming sessions (next 7d), plans assigned, pending actions (sign-offs, attendance gaps).

### 1.3 Add-on / benefit discoverability
- New `EligibleAddOns` component used in MemberDashboard + MyBenefits showing branch-available add-ons the member doesn't yet own, with "Add to plan" → existing checkout flow.
- MyBenefits page: split into **Included**, **Purchased**, **Available to add**.
- Branch services strip on dashboard: facilities + classes + PT availability scoped to the member's home branch.

### 1.4 Self-service dead-end audit
- Scan member-facing routes (`MemberDashboard`, `MyBenefits`, `MyInvoices`, `MemberStore`, `MemberCheckout`, `MemberRequests`, `MemberReferrals`) for buttons that show info but don't act.
- Convert each to either: complete the action, route to the action, or hide it for the role.
- Concrete fixes: freeze request from membership card, cancel booking from MyBenefits, pay-now from MyInvoices line item, redeem rewards inline on MemberReferrals.

**Files touched (Phase 1, approx.):** `src/pages/MemberDashboard.tsx`, `src/pages/MyBenefits.tsx`, `src/pages/MyInvoices.tsx`, `src/pages/TrainerDashboard.tsx`, `src/pages/StaffDashboard.tsx`, `src/hooks/useBenefits.ts`, `src/hooks/useMemberData.ts`, plus 3–5 new small components. No DB migrations expected.

---

## Phase 2 — Templates, Reminders, Campaigns, AI Brain

Goal: make outbound communication and AI self-service structured, reusable, and auditable.

### 2.1 Templates & reminders consolidation
- Inventory all reminder triggers (lead capture, welcome, payment due, expiry, class/PT/benefit, follow-ups, campaign sends).
- Ensure each has: a row in a templates registry (channel + locale + variables), honest delivery status (`sent / failed / queued / suppressed`), retry on transient failure, and a clear trigger source recorded in audit log.
- Replace any hardcoded message strings with template lookups.
- Add a Settings → Templates manager UI (list, edit, preview with sample variables, toggle active).

### 2.2 Campaign manager improvements
- Reusable campaign templates (clone → edit → schedule).
- Lead-source segmentation filters (UTM source/medium/campaign, branch, lifecycle stage).
- Drip/nurture scheduler (sequence of N steps with delays).
- Sales handoff: when a lead replies or hits a score threshold, auto-assign to the configured owner with SLA timer.
- Conversion reporting: per-campaign sent / delivered / replied / converted / revenue, branch-scoped.

### 2.3 Lead nurture & CRM
- Nurture stages on `leads` (New → Contacted → Qualified → Trial → Won/Lost) with allowed transitions.
- SLA reminders for owners on stale leads (configurable hours per stage).
- UTM/source captured at lead creation, surfaced in lead detail and reports.

### 2.4 AI brain expansion (WhatsApp transactional agent)
Extend the existing AI tool registry (per `mem://integrations/whatsapp-ai-tool-registry`) with:
- `book_class`, `cancel_class_booking`
- `initiate_membership_renewal` (creates invoice + payment link, never charges directly)
- `purchase_addon_intent` (returns checkout link)
- `list_branch_services` (branch-aware)
- `escalate_request` / `get_request_status`

Context improvements per turn:
- Active branch, member lifecycle stage, active membership + days remaining
- Outstanding dues + last payment
- Recent reminders sent (last 7d) to avoid duplicate nags
- Eligible add-ons

All write actions stay routed through existing authoritative RPCs (e.g. `record_payment`, `book_facility_slot`) — agent never mutates tables directly.

**Files touched (Phase 2, approx.):** `supabase/functions/whatsapp-ai-agent/*` (or current name), template registry tables/UI, `src/pages/Announcements.tsx` (campaigns tab), `src/components/campaigns/*`, `src/pages/Leads.tsx`, plus 1–2 small migrations for nurture stage + SLA + template registry if not already present.

---

## Phase 3 — Public Website SEO/Performance + Polish

Goal: make `incline.lovable.app` / `theincline.in` crawlable, fast, and discoverable; finish broader UX/branch-services polish.

### 3.1 SEO essentials on `InclineAscent` + public routes
- `<title>` and `<meta name="description">` per route via a small `SEO` component (react-helmet-async or direct DOM head injection — already partially in `index.html`).
- Canonical tags pointing to `https://www.theincline.in/<path>`.
- Open Graph + Twitter card metadata (title, description, image — reuse existing logo/hero asset).
- JSON-LD structured data: `Organization`, `LocalBusiness` (per branch if available), `WebSite` with SearchAction.
- Verify `public/robots.txt` allows crawling of public routes and disallows `/member/*`, `/auth`, `/staff/*`, etc.
- Update `public/sitemap.xml` to actual public routes only (drop `/auth`, `/member/pay` — those should be `noindex`). Add per-branch landing pages if/when they exist.

### 3.2 Performance on public landing
- Continue the LCP/FID work already in flight: keep static SEO hero (already added), defer 3D scene mount, lazy-load `Environment` HDR or replace with cheap lighting (per the prior reflow analysis).
- Image optimization: ensure hero/logo assets are appropriately sized, use `loading="lazy"` and `decoding="async"` on below-the-fold images, prefer modern formats.
- Reduce JS payload: code-split heavy 3D chunk behind interaction or `requestIdleCallback`.
- Add `<link rel="preconnect">` for Supabase + fonts, `<link rel="preload">` for the LCP image only.

### 3.3 Branch services clarity
- Public site: a "Branches" section listing each branch with its actual facilities, classes, PT availability, premium add-ons (driven by DB, not hardcoded).
- Member experience: branch-aware service cards mirroring the same data so what a member sees matches what marketing promises.

### 3.4 Workflow / trigger consistency pass
- Audit triggers across leads, payments, invoices, reminders, approvals, benefits, bookings, campaigns.
- Document the canonical event for each domain (one source of truth).
- Remove any client-side "fake success" toasts that fire before the backend confirms — replace with optimistic UI + rollback on failure.
- Ensure every side-effect writes to `audit_log` via the existing trigger engine.

### 3.5 UX polish (practical only)
- Empty states with a helpful action on every list page that can be empty.
- Primary action prominence on every page (one obvious CTA).
- Status badges everywhere status exists (no plain-text status).

**Files touched (Phase 3, approx.):** `index.html`, `src/pages/InclineAscent.tsx`, new `src/components/seo/SEO.tsx`, `public/robots.txt`, `public/sitemap.xml`, `src/components/3d/Scene3D.tsx`, plus targeted polish in member/staff pages.

---

## Constraints respected throughout
- No regressions to the recent backend hardening (atomic `record_payment`, RLS, audit log, MIPS, Cloud edge architecture).
- Backend authority preserved: AI/self-service flows call existing RPCs/edge functions, never bypass them.
- Branch scoping enforced on every new query and component.
- SEO/performance changes don't alter routes or the dark/orange theme.

---

## Recommended next step
Approve this plan and I'll start with **Phase 1** (member dashboard accuracy → trainer KPIs → add-on discoverability → self-service dead-ends). It's the highest-trust, lowest-risk slice and unblocks everything else.

If you'd rather I start with a different phase first (e.g. SEO is more urgent given the recent Lighthouse issues), say the word and I'll reorder.