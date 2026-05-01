# Phase 3 — Public Site SEO, Performance & Polish

**Guiding rule (locked in):** the public website (`/`, `/privacy-policy`, `/terms`, `/terms-of-service`, `/data-deletion`) makes **zero backend calls**. All marketing content (branches, facilities, classes, add-ons) is hardcoded in a typed config file. Backend-driven views remain only inside the authenticated app.

---

## 3.1 SEO essentials

### Per-route SEO component
- Add `react-helmet-async` and wrap `App` in `HelmetProvider`.
- Create `src/components/seo/SEO.tsx`:
  - Props: `title`, `description`, `path`, `image?`, `type?` (`website` | `article`), `noindex?`, `jsonLd?`.
  - Emits `<title>`, `<meta name="description">`, canonical (`https://www.theincline.in${path}`), full OG + Twitter set, optional `<script type="application/ld+json">`, and `<meta name="robots" content="noindex,nofollow">` when `noindex`.
- Apply on each public route with route-specific copy:
  - `/` — keep current hero copy.
  - `/privacy-policy`, `/terms`, `/terms-of-service`, `/data-deletion` — short tailored title + description, `noindex={false}` but lower priority.
  - `/auth`, `/contract-sign/:token`, `/member/pay`, `/member-dashboard`, `/staff/*`, `/admin/*`, `/pos`, `/setup`, `/unauthorized` — `noindex` via SEO component (defense in depth alongside robots.txt).

### Structured data
- Keep existing `Organization`, `HealthClub`, `WebSite` JSON-LD in `index.html`.
- Add a `BreadcrumbList` JSON-LD via SEO component on legal pages.
- Add an `FAQPage` JSON-LD block on the landing page populated from a small static FAQ section (membership, hours, location, trial).

### robots.txt and sitemap.xml
- `robots.txt` is already comprehensive — only tweak: add `Disallow: /member-dashboard`, `Disallow: /member/`, `Disallow: /contract-sign/`, `Disallow: /pos`, `Disallow: /trainer-dashboard` to the `User-agent: *` block; remove duplicates.
- `sitemap.xml` — drop `/auth` and `/member/pay` (these are app entry points, not marketing). Final list:
  - `/` (priority 1.0, weekly)
  - `/privacy-policy`, `/terms`, `/terms-of-service`, `/data-deletion` (priority 0.5, monthly)
  - Add `<lastmod>` set to today.

---

## 3.2 Performance on the public landing

Public landing only — no DB calls, no auth bootstrapping until the user navigates to `/auth`.

- **3D scene defer:** `Scene3D` is already `React.lazy`. Wrap mount in an `IntersectionObserver` + `requestIdleCallback` gate so it only mounts after the hero is painted and visible. Show the existing static SEO hero as the LCP element.
- **HDR / lighting:** replace `Environment` HDR with cheap `<ambientLight>` + `<directionalLight>` (already noted in earlier reflow analysis). Saves a multi-MB asset on first paint.
- **Image hygiene:**
  - Audit `public/assets/` — ensure hero/logo are WebP, sized to actual render dimensions, and `<img>` tags use `loading="lazy"` + `decoding="async"` on everything below the fold; the LCP hero image gets `fetchpriority="high"` + `loading="eager"`.
  - Add `<link rel="preload" as="image" href="<lcp-hero>" fetchpriority="high">` in `index.html` for the LCP image only.
- **Network hints in `index.html`:**
  - Keep Supabase preconnect (only used after navigating into the app, so consider downgrading to `dns-prefetch` only and dropping preconnect on the public landing — minor TLS savings).
  - Add `<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` if Inter is loaded from Google Fonts; otherwise self-host.
- **Code splitting:** verify Vite chunks isolate `three`, `@react-three/fiber`, `@react-three/drei` into a single async chunk that only loads with `Scene3D`. Add `manualChunks` in `vite.config.ts` if needed.
- **No backend on public route:** confirm `InclineAscent.tsx` and its children make **no** Supabase calls; if any analytics/page-view tracking exists, route it through a tiny fire-and-forget that runs after `requestIdleCallback`.

---

## 3.3 Branch & services clarity (static config, no DB)

- Create `src/config/publicSite.ts` with a typed schema:
  ```ts
  type Branch = {
    slug: string; name: string; city: string; address: string;
    facilities: string[]; classes: string[]; pt: boolean; addOns: string[];
    hours: string; mapUrl?: string;
  };
  ```
- Author one entry for the active Udaipur branch; the array allows adding more without code changes.
- Add a "Branches & Services" section to `InclineAscent.tsx` that renders cards from this config (facilities, classes, PT, premium add-ons).
- Generate a `LocalBusiness` JSON-LD per branch from the same config inside the SEO component (looped).

---

## 3.4 Workflow & trigger consistency pass (in-app, not public)

This is documentation + small in-app cleanups; no public-site impact.

- Produce `docs/workflows.md` listing canonical events per domain:
  - Leads → `lead.created`, `lead.status_changed`, `lead.contacted`
  - Payments → `payment.recorded` (via `record_payment` RPC — already canonical per memory)
  - Invoices → `invoice.created`, `invoice.paid`, `invoice.void`
  - Reminders → `reminder.scheduled`, `reminder.sent`
  - Approvals → `approval.requested`, `approval.decided`
  - Benefits → `benefit.granted`, `benefit.consumed`
  - Bookings → `booking.created`, `booking.cancelled`, `booking.attended`
  - Campaigns → `campaign.sent`, `campaign.delivery_updated`, `campaign.converted`
- Sweep client code for "fake success" toasts that fire before the mutation resolves; convert to TanStack Query `onSuccess` toasts with `onError` rollback (optimistic where safe).
- Confirm every server-side mutation path writes to `audit_log` via the existing trigger engine (per memory `audit-log-engine`); list any gaps for a follow-up.

---

## 3.5 UX polish (in-app)

- Empty states with an actionable CTA on every list page (Members, Leads, Invoices, Bookings, Campaigns, Templates, Approvals).
- One unmistakable primary CTA per page (top-right action button or hero card action).
- Replace any plain-text status with the standard colored badge palette from project knowledge.

---

## Files touched

- `index.html` — preload LCP image, prune unused preconnect, sitemap/robots tweaks remain in `public/`.
- `public/robots.txt` — add private app paths to `User-agent: *` Disallow list.
- `public/sitemap.xml` — drop `/auth` and `/member/pay`, add `<lastmod>`.
- `src/components/seo/SEO.tsx` (new), `src/main.tsx` (wrap with `HelmetProvider`).
- `src/pages/InclineAscent.tsx` — mount SEO, add static Branches & FAQ sections, gate Scene3D behind viewport + idle.
- `src/pages/PrivacyPolicy.tsx`, `src/pages/Terms.tsx`, `src/pages/TermsOfService.tsx`, `src/pages/DataDeletion.tsx` — SEO tags.
- `src/pages/Auth.tsx`, contract-sign, member/staff/admin shells — SEO with `noindex`.
- `src/components/3d/Scene3D.tsx` — swap `Environment` HDR for ambient + directional lights; export remains lazy-friendly.
- `src/config/publicSite.ts` (new) — branches/services source of truth for the public site.
- `vite.config.ts` — `manualChunks` for `three`/`drei` if not already isolated.
- `docs/workflows.md` (new) — canonical events.
- Targeted polish in member/staff list pages (empty states, CTAs, status badges).

## Out of scope (per your call)

- Per-branch landing routes (`/branches/:slug`) — deferred until a second branch exists.
- Any backend reads from the public site — explicitly excluded.
- Aggressive image regeneration pipeline — only the existing assets are tuned.

Approve to switch to build mode and execute 3.1 → 3.5 in that order.
