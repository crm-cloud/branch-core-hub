## Context — what the vendor doc actually allows

After re-reading the HOWBODY API doc v2.4 against our current implementation, two hard vendor constraints reshape the design:

| Vendor flow | Doc § | URL behavior |
|---|---|---|
| **Pre-scan QR (login)** | 3.1 | Device **injects** `?equipmentNo=…&scanId=…` into our URL. Our `/scan-login` already handles this correctly. |
| **Post-scan QR ("Send to Phone")** | 3.2 | URL is **fully static**. Device appends NOTHING. "Applicable only to logged-in users; guests are not permitted." |
| **Body / Posture push** | 3.3, 3.4 | Already wired — webhooks save report + auto-fire `deliver-scan-report` (WhatsApp + Email + in-app). |

Implication: the device's "Send to Phone" button cannot pass a scan token. We can only land the user on a generic page that resolves **their own latest report** from their authenticated session.

Also: our existing `deliver-scan-report` already pushes WhatsApp + Email the instant a report arrives, so the device's "Send to Phone" QR is essentially a **fallback / re-view entry**, not the primary delivery channel. We should make this explicit in the UI.

---

## Plan

### 1. New static landing page — `/my-scan-report`

Single static URL we hand to HOWBODY for the Section 3.2 redirect QR. No params, no tokens.

- Behavior:
  - If not logged in → redirect to `/auth?redirect=/my-scan-report`
  - If logged in as a member → fetch the **latest** body + posture reports for `member_id = current user`, show summary cards + buttons "View Body Report" / "View Posture Report" linking into existing `MyProgress` / public report routes.
  - If logged in as staff → show a small member-search to pick whose latest report to view (covers shared device kiosks).
  - Shows a banner: *"We've already sent your report to your WhatsApp and email — this page is for re-viewing."*

### 2. Communication policy alignment (audit + harden)

Audit `deliver-scan-report` to confirm it follows project comms standards:
- Uses universal dispatcher pattern (no hard-coded WhatsApp/SMS creds).
- WhatsApp template falls back to deep link if Meta API unavailable.
- Email uses transactional engine.
- In-app realtime notification fires for the member.
- Idempotent on `report_id` (no double-sends if webhook retries).
- Logs delivery attempts to `howbody_webhook_logs` or a dedicated comm log.

Add what's missing — most likely: idempotency guard + branded WhatsApp template variables matching the comms engine (`HOWBODY Triggers` memory).

### 3. Settings UI — refactor into 3 tabs

Convert `src/components/settings/HowbodySettings.tsx` from a vertical stack of 4 cards into a single Vuexy-styled `Tabs` component:

```text
┌─ Body Scanner ──────────────────────────────┐
│  [Credentials]  [Webhooks]  [Devices]       │
├─────────────────────────────────────────────┤
│  (active tab content)                        │
└─────────────────────────────────────────────┘
```

- **Tab a — HOWBODY Credentials**: existing creds card (Base URL, Username, App Key, Active toggle, Save) + Test Connection button moved here (logical grouping).
- **Tab b — Body Scanner Webhooks**: the three URLs (Pre-scan QR Login, Body Webhook, Posture Webhook) **plus** the new static "Send-to-Phone Redirect URL" (`{origin}/my-scan-report`). Each URL gets a clear "what to paste into the device" hint + copy button. Add a callout explaining vendor's static-URL rule.
- **Tab c — Body Scanner Devices**: existing `HowbodyDevicesCard` (admin/owner only — manager/staff get read-only as already implemented).

Tabs use Vuexy aesthetic: rounded-2xl, soft indigo/teal shadows, icon badges in tab labels.

### 4. Update vendor handoff doc (v3)

Regenerate `incline_bodyscan_handoff_v3.pdf` with corrected URL semantics:
- ✅ Pre-scan login URL (with param injection) → `/scan-login`
- ✅ Post-scan static redirect URL (no params) → `/my-scan-report`
- ❌ Remove the proposed `/howbody-send-to-phone` callback (vendor confirmed they cannot call custom callbacks; delivery is already automated server-side via webhooks).
- Document that WhatsApp + Email auto-fire from the body/posture push — vendor doesn't need to do anything extra.

### 5. Test with curl (using deployed edge functions)

After implementation, run smoke tests through `curl_edge_functions`:
1. `POST /howbody-bind-user` with sample `equipmentNo=HD0202501821 + scanId=test-123` → expect 200.
2. `POST /howbody-body-webhook` with sample payload from doc §4.2 + valid `appkey` header → expect `code: 200`, row in `howbody_body_reports`, delivery fired.
3. `POST /howbody-posture-webhook` with §4.4 sample → same checks.
4. Confirm `/my-scan-report` resolves the just-written report for the test member.

---

## Files touched

| File | Change |
|---|---|
| `src/pages/MyScanReport.tsx` | **new** — static landing for §3.2 redirect |
| `src/App.tsx` | add `/my-scan-report` route (lazy) |
| `src/components/settings/HowbodySettings.tsx` | refactor to 3-tab layout |
| `supabase/functions/deliver-scan-report/index.ts` | audit + add idempotency / template alignment if needed |
| `/mnt/documents/incline_bodyscan_handoff_v3.pdf` | regenerate vendor doc |

No DB migrations required — schema already supports the flow. No new edge functions (the static-URL constraint removes the need for `/howbody-send-to-phone`).

---

## Out of scope / non-goals

- We will **not** build a `/howbody-send-to-phone` endpoint — vendor cannot call it (confirmed by their message).
- We will **not** change the pre-scan QR flow — it works as designed.
- No new tables or RLS changes.
