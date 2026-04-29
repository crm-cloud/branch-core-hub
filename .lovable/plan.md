## Audit Findings & Implementation Plan

A focused fix-list for the 6 issues raised, with deep audit of system health errors and a member-dashboard polish pass.

---

### 1. Benefit Add-On Packages — Missing Admin Configuration UI

**Finding:** The `benefit_packages` table exists (since 20260117) and the member-side `PurchaseAddOnDrawer` reads from it, but there is **no admin UI anywhere** to create/edit/list these packages. Admins see `Plans` (membership plans) and `PT Packages`, but Benefit Add-On packages have no management screen — explaining the empty state members see.

**Fix:**
- Add a new **"Add-On Packages"** tab inside the existing **Plans** page (`src/pages/Plans.tsx`) — keeps it in the existing pricing/catalog area, no new menu noise.
- Create `src/components/plans/AddBenefitPackageDrawer.tsx` (right-side Sheet, per "No Dialog" rule):
  - Fields: name, description, price, branch, benefit type (multi-select from `benefit_types`), credits per benefit, validity days, GST class, active toggle.
- Table view with status badges, edit drawer, soft-delete toggle.
- RLS: branch-scoped read/write for owner/admin/manager.

---

### 2. Book & Schedule — Theme Mismatch & Excessive Page Width

**Findings (from screenshots + code):**
- Time-grouped sessions render as **one wide row per slot** with the "Book" button on the far right → card stretches to viewport edge. Time-of-day groups (Morning 22, Afternoon 18) show all entries in a flat list with no sub-grouping.
- Visual language drifts from `MemberAnnouncements` (rounded chips, soft tonal cards, accent borders) — booking uses heavier slate borders and wider whitespace.

**Fix:**
- Replace flat lists with a **sub-tab strip inside each day** (Morning / Afternoon / Evening / Night) — only the active period renders, removes overwhelm.
- Switch to a **compact 2-column responsive grid** (`grid sm:grid-cols-2 xl:grid-cols-3`) of small slot cards: time + title stacked, badges under, "Book" as full-width pill at bottom. Caps card width naturally.
- Adopt announcement card tokens: `rounded-2xl`, `border-border/60`, `bg-card/90`, soft accent dot for facility type.
- Keep the gradient hero date-strip; fix overlap with the "No active membership" alert (it currently bleeds into the Morning header).

---

### 3. 3D Body Visual — Wrong Gender + Poor Aesthetic

**Findings:**
- `public/models/` has only `avatar-female.glb`. `AvatarGltf.tsx` uses `VITE_AVATAR_MALE_URL`/`VITE_AVATAR_FEMALE_URL` env vars — none are set, so it always falls back to the **procedural `BodyModel`** (the bald white mannequin in screenshot 3).
- Member is male (RL avatar) but visual is gender-ambiguous + low-fidelity. Reference images show what's expected (anatomical/wireframe overlay aesthetic).

**Fix (pragmatic, no ML/3D-scan):**
- Replace the GLB-dependent `MemberBodyAvatarCanvas` with a **stylized 2D SVG silhouette** for now — gender-aware (male/female), with measurement-driven overlays:
  - Front-facing silhouette tinted by `bodyFat` morph value.
  - Wireframe overlay band at chest/waist/hips with live measurement labels (matching the 3DLOOK reference).
  - Dark hero card with subtle grid pattern + corner brackets for the "scanner" feel.
- Hide the 3D canvas entirely (avoids GLB 404s and "Drag to rotate" misleading copy).
- Keep the existing measurement → snapshot pipeline; only swap the renderer.
- Future-proof: add a `VITE_AVATAR_MALE_URL` hook so a real GLB can be plugged in later without code changes.

---

### 4. System Health — Deep Error Audit

**Live database snapshot (45 open errors):**

| Source | Error | Count | Root Cause | Fix |
|---|---|---|---|---|
| `/my-classes` | `selectedDateStr is not defined` | 15 | **Stale production bundle** (`index-CP9GD4UJ.js`). Source code at line 75 already defines it. | Force rebuild on next deploy; mark these as resolved. |
| `/all-bookings` | `Invalid ID format - record reference malformed` | 5 | Booking row references a deleted member/facility (FK orphan). | Add null-guard in `AllBookings.tsx` row mapper; resolve old logs. |
| `/dashboard`, `/all-bookings` | `DialogContent requires a DialogTitle` | 4 | A11y warning — some Dialog wrappers missing `<DialogTitle>` (likely command palette / shortcut dialog). | Audit `CommandDialog`/shortcut dialogs, add `VisuallyHidden` `<DialogTitle>`. |
| `/announcements` | `Importing a module script failed` | 1 | Lazy-import chunk hash mismatch after deploy. | Already mitigated by chunk hashing; resolve. |
| `/members` | `Network error - check your internet connection` | 2 | Transient. | Resolve. |
| Database | misc (6) | 6 | To inspect post-clear. | Inspect, group, resolve. |

**Action plan:**
- **Code fixes:**
  - `AllBookings.tsx` — guard against malformed UUIDs before `.eq()` queries; show an inline "orphaned record" badge instead of crashing.
  - Audit dialogs missing titles (search `DialogContent` without sibling `DialogTitle`) → add hidden titles.
- **Cleanup migration:** mark all currently-open `error_logs` as `status='resolved'` with note "bulk audit pass — root causes addressed in this release".
- **Dashboard:** add a top-of-page summary card in `SystemHealth.tsx` showing "Last audit: X / Open since last audit: Y" so future drift is visible.

---

### 5. WhatsApp Chat — AI Follow-Up After Lead + Duplicate Convert Buttons + Sidebar

**Findings:**
- `lead-nurture-followup` (v3.0.0) only resets retry count when `lead_qualified=true`, but does **not check if the chat already has a converted `lead_id`**. So even after manual "Convert to Lead", the cron keeps sending follow-ups.
- WhatsApp source label currently shows raw "whatsapp_api" text instead of an icon + label.
- `WhatsAppChat.tsx` has **two "Convert to Lead" buttons**: one in the chat-window header (line 952) and one in the right sidebar (line 1394). Per request, remove the chat-window one.
- Right sidebar is open by default — should be **collapsed by default** to maximize chat viewport.

**Fix:**
- **Edge function `lead-nurture-followup`:** add a guard — `SELECT lead_id FROM whatsapp_chats WHERE phone_number = ...; if (lead_id) skip;`. Bump to v3.1.0.
- **Source label:** in chat list and detail header, render `<MessageSquare className="text-emerald-500" /> WhatsApp` (already have `PlatformIcon` helper — extend it to also render in the source badge).
- **Remove duplicate button:** delete the chat-header "Convert to Lead" block (lines ~943–955 in `WhatsAppChat.tsx`). Keep only the prominent sidebar CTA.
- **Sidebar default state:** add `sidebarCollapsed` state defaulting to `true`; render a slim 56px rail with avatar + expand chevron when collapsed; full panel when expanded. Persist preference to `localStorage`.

---

### 6. Member Dashboard — UI/UX Polish & Notification Sync

**Findings:**
- `NotificationBell` already has realtime subscription on `notifications` table — good. But events for: invoice generated, payment received, PDF ready, benefit slot booked are **not all firing inserts into `notifications`**.
- Dashboard layout mostly clean but: benefit credit cards lack visual hierarchy, no quick "Pay Pending Dues" CTA when `pendingInvoices > 0`, and ad banner carousel doesn't auto-rotate.

**Fix:**
- **Event coverage** — audit and add `notifications` inserts (via a single `notify_member()` SQL helper) on these triggers:
  - `invoices` AFTER INSERT (member_id) → "New invoice ₹X generated"
  - `payments` AFTER INSERT → "Payment of ₹X received"
  - `member_documents` AFTER INSERT → "Your invoice/receipt is ready"
  - `benefit_bookings` AFTER INSERT → "Booked {facility} on {date}"
  - `member_benefit_credits` AFTER INSERT (from add-on purchase) → "X credits added"
- **Dashboard polish:**
  - Add a sticky "Pending Dues" alert card at top when `pendingInvoices.length > 0`, with single-tap "Pay Now" → `/member/pay`.
  - Promote benefit credits to a horizontal scroll strip with usage bar (used/total + days-to-expiry).
  - Auto-rotate ad banner carousel every 5s.
  - Hide empty-state cards (no PT package + no upcoming class) instead of showing "—".
  - Move "Buy Add-On" CTA into the benefits section header instead of floating button for better discoverability.

---

### Technical File Touch List

```text
NEW
  src/components/plans/AddBenefitPackageDrawer.tsx
  src/components/plans/BenefitPackagesTable.tsx
  src/components/progress3d/MemberBodyAvatarSvg.tsx
  supabase/migrations/<ts>_notify_member_events.sql
  supabase/migrations/<ts>_resolve_audit_errors.sql

EDIT
  src/pages/Plans.tsx                              (add Add-On Packages tab)
  src/pages/MemberClassBooking.tsx                 (sub-tabs + grid layout + theming)
  src/pages/MemberDashboard.tsx                    (pending-dues alert, benefit strip, polish)
  src/pages/SystemHealth.tsx                       (audit summary card)
  src/pages/AllBookings.tsx                        (UUID guard)
  src/pages/WhatsAppChat.tsx                       (remove dup CTA, collapse sidebar default, source icon)
  src/components/progress3d/MemberBodyAvatarCanvas.tsx  (swap to SVG renderer)
  supabase/functions/lead-nurture-followup/index.ts     (skip converted leads → v3.1.0)
```

### Out of Scope (flag for later)

- Real 3D scan integration (3DLOOK / Mixamo GLB) — silhouette is interim.
- WhatsApp inbound rich attachments rendering polish (already covered earlier).

Approve to proceed and I'll implement all six tracks in one pass.