# Audit & Fix Plan — 6 Issues

## 1. Integrations page — "Webhooks" tab vs page

**Finding (verified):** There is **only one** integrations page (`src/pages/Integrations.tsx`). Webhooks is currently a *tab* alongside Payment / SMS / Email / WhatsApp / Instagram / Messenger / Google. The "double" feeling comes from the fact that the **stat cards at the top** (Payment / SMS / Email / WhatsApp / Google count tiles) **always render above the tab bar**, regardless of which tab is active — so when you click "Webhooks" you still see those provider tiles, making it look like two layers of integration UI.

**Fix:**
- Promote **Webhook Activity** to a dedicated route `/integrations/webhooks` (still reachable via the `Activity` button on the Payments page).
- Remove the `webhooks` tab from `Integrations.tsx`. Replace the tab trigger with a small "View Webhook Activity →" link/button in the header of the Integrations page.
- Update the deep link in `src/pages/Payments.tsx:253` (`/integrations?tab=webhooks` → `/integrations/webhooks`).
- Result: no overlap, one focused page per concern.

## 2. RYAN LEKHARI / MAIN-00001 / ₹4,000 dues — no webhook, no payment log

**Finding (DB‑verified):** Member `5cfda8f1…` has 6 invoices. Pending one (`INV-MAIN-2604-0005`, ₹4,000, due 29-Apr) was created **manually** on 22 Apr at 14:33 UTC. Four siblings (`-0001..-0004`) are `cancelled`. There is **one** `payment_transactions` row tied to it: `gateway=razorpay, status=created`, **no signature, no http_status, no captured event** — meaning a Razorpay payment link was generated but nothing was ever paid against it. There are **zero** rows in `payments` for this invoice. So the dues card is correct; what's missing is **observability** of why the link never converted.

**Fix:**
- In `WebhookActivityPanel`, surface "Created but never captured" rows (currently they're filtered into the no-data state because they have no `signature_verified`/`http_status`). Add a state filter chip "Pending capture" so staff can see open `created` rows.
- In `InvoiceViewDrawer`, add a **Payment Link Activity** sub-panel: fetch all `payment_transactions` for the invoice and show created/captured/failed timeline (gateway + reference id + last update). This explains "I sent a link, did the customer pay?" at a glance.
- Backfill display: when an invoice has at least one `payment_transactions.status='created'` row but no captured, show a small badge "Link sent" on the dues row in `Payments.tsx`.
- No data correction needed for Ryan — the invoice is genuinely unpaid; the Razorpay link just hasn't been actioned.

## 3. Member code format — fitness-center-friendly

**Current (DB-verified):** `generate_member_code()` produces `<branch.code>-<padded count>` → `MAIN-00001`. Counter is `COUNT(*)+1` per branch (race-prone, also non-resettable on deletes).

**Fix:**
- Switch format to `<branch.code>-<YY>-<seq>` e.g. **`INC-26-0100`** (year embedded → resets each Jan 1, much friendlier and still unique).
- Replace `COUNT(*)+1` with a per-branch **Postgres sequence** (`member_code_seq_<branch_id>`) or an atomic `INSERT … RETURNING` pattern using `member_code_counters(branch_id, year, last_seq)` with row lock — eliminates the race condition.
- Migrate via SQL migration: rewrite `generate_member_code()`, create the counter table, seed from existing max per branch.
- Existing member codes stay unchanged (no rewrite of historical records — codes are referenced in printed receipts/QR/biometric).

> Will ask you to confirm the exact format you want before writing the migration (see Open Questions).

## 4. Default branch code on creation

**Current:** `AddBranchDialog.tsx` requires the user to type a `code` manually (placeholder `e.g., DT01`). That's why the seed branch is `MAIN`.

**Fix:**
- Auto-suggest a code as the user types the branch name: take first 3 alpha characters uppercased (e.g., "Incline Bandra" → `INC`). Append `-02`, `-03` if `INC` is taken.
- Field stays editable (admin can override) but no longer empty by default.
- Validate uniqueness on submit with a clear error.
- **Note:** changing the existing branch code from `MAIN` to e.g. `INC` will break all current `MAIN-…` member codes and invoice numbers (`INV-MAIN-…`). Options:
  - (a) Leave existing branch code = `MAIN` (only new branches get smart codes), or
  - (b) One-time rename `MAIN → INC` and rewrite member_codes/invoice_numbers via migration.

> Need your call on this — see Open Questions.

## 5. Chat sound only plays on opening a chat (not on new inbound)

**Bug found:**
- `useChatSound(inboundCount)` in `WhatsAppChat.tsx:317` fires whenever `inboundCount` increases — including the **first time you open a contact** because `messages` query returns `[]` then jumps to N inbound messages, so the ref sees `N > 0` and pings. That's the false ping you hear on open.
- Meanwhile `useGlobalChatSound` in `AppHeader.tsx:41` does subscribe to realtime INSERT on `whatsapp_messages` (table is in the realtime publication, verified). But it filters on `direction=eq.inbound` only — and **the actual ping fires before checking** that the new message belongs to a branch the user can see, so RLS may suppress the event entirely for non-owner users → no ping at all.

**Fix:**
1. In `useChatSound`, treat the **first render's value as the baseline** — change from `useRef(trigger)` (which captures initial value but the effect runs after that and also on dep change) to a flag `hasMounted` so the very first effect run never plays sound. Also reset baseline when `selectedContact` changes (pass a `key` or add a reset hook).
2. In `useGlobalChatSound`, attach the realtime subscription **without** the `branch_id` filter (RLS will scope it server-side) and play the ping only when the inserted row's `branch_id` is in the user's accessible branches OR the user is owner/admin. This guarantees the ping reaches eligible staff.
3. Add a quick "Test sound" button in the chat header so staff can verify their device permissions (browsers throttle WebAudio until first interaction; if the very first sound attempt is blocked, show a one-time toast "Click anywhere once to enable sound notifications").

## 6. Attachment audit — invoice / receipt / POS / diet / workout via Email & WhatsApp

**Audit summary:**

| Flow | Current behaviour | Gap |
|---|---|---|
| **Invoice share (`InvoiceShareDrawer`)** | WhatsApp & SMS open prefilled text via `wa.me` / `sms:`. Email goes through `send-email` provider with HTML body. **No PDF attachment** in any channel. | Needs PDF generation + attachment. |
| **POS receipt (`pages/POS.tsx`)** | Only `printInvoice()` — opens browser print dialog. **No share-to-WhatsApp / email path at all.** | Needs share drawer + PDF/image attachment. |
| **Payment receipt** | No dedicated "send receipt" UI. Members get an invoice link only. | Add receipt PDF + share drawer post-payment. |
| **Diet / Workout plan (`MemberPlans.tsx` + `WhatsAppShareDialog`)** | Sends a **text-only** WhatsApp message via `send-whatsapp` edge function. No PDF of the plan attached. | Needs PDF export of plan + attachment via WhatsApp media + email. |
| **Add-on / package invoices** | Same as invoice flow → text only. | Same fix as #1. |

**Fix plan:**
- **PDF generation utility** (`src/utils/pdfGenerator.ts`): one helper per artifact type — `generateInvoicePDF`, `generateReceiptPDF`, `generateDietPlanPDF`, `generateWorkoutPlanPDF`. Use `jspdf` + `jspdf-autotable` (already viable in browser, no extra build).
- **Storage upload step**: upload generated PDFs to `documents` bucket under `attachments/<branch_id>/<invoice_id>.pdf`, return signed URL (1-day expiry).
- **WhatsApp**: extend `send-whatsapp` edge function call payload to support `media_url` + `caption` (Meta Cloud API supports document attachments — we already use this for chat attachments per memory `whatsapp-crm-system-v25-0`). Update `InvoiceShareDrawer`, `WhatsAppShareDialog`, and a new `POSReceiptShareDrawer` to upload PDF → call `send-whatsapp` with `media_url`.
- **Email**: extend `send-email` to accept an `attachments: [{ filename, url }]` array, fetch+base64 server-side, pass to provider (Resend/SES support both inline base64 and remote URLs).
- **POS post-checkout**: after `create_pos_sale` succeeds, show success drawer with [Print] [Share via WhatsApp] [Email] using the new attachment-capable share drawer, defaulting to the customer's saved phone/email.
- **Plan share**: in `MemberPlans` and trainer-side `AssignPlanDrawer`, generate plan PDF and attach. Keep the text caption (current message).

---

## Open Questions

I'd like your call on these before I start coding: