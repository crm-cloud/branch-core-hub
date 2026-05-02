# Invoice WhatsApp + Live Feed + Contact Book — Plan

## Diagnosis

When you shared the invoice PDF, it went out via `sendWhatsAppDocument` which writes **directly** to `whatsapp_messages` and calls `send-whatsapp`. It **bypasses** `dispatch-communication`, so:

1. **No `communication_logs` row** → no entry in Live Feed, no funnel count in System Health.
2. **PDF appears as plain text bubble** in WhatsApp Chat, because the chat renderer only special-cases `image` / `template`; for `document` it just shows the caption with a tiny `[document]` chip — no PDF preview, no download link.
3. **"+919928910901"** shows because the WhatsApp Chat thread list (and contact card) only resolves names from `members` matched on `phone_number`. If the member's stored phone differs (e.g. no `+91`, or a different format), or they exist only as a lead, the lookup fails and the raw number is shown.
4. The "Member" badge in your screenshot proves the row is linked to a member — but the **profile name** isn't being read from the joined `profiles.full_name`.

This violates our Core memory rule: *"All NEW outbound Email/SMS/WhatsApp/in-app code MUST call `dispatchCommunication()`."* Invoice share was written before that rule and was never migrated.

---

## Plan

### 1. Route invoice WhatsApp through `dispatch-communication`

- Extend `dispatch-communication` to accept an optional `attachment` field:
  `{ url: string, filename: string, content_type: 'application/pdf' | ... }`.
- When present and channel is `whatsapp`, forward `message_type='document'`, `media_url`, `filename`, `caption=body` to `send-whatsapp` (it already supports this).
- Persist `attachment` into a new `communication_logs.metadata.attachment` jsonb field so Live Feed can render a paperclip + filename + open-link.
- Refactor `sendWhatsAppDocument` to upload the PDF to storage, then call `dispatchCommunication({ channel:'whatsapp', category:'payment_receipt', attachment:{url,filename}, dedupe_key:`invoice-${invoice.id}-wa` })`. Drop the direct `whatsapp_messages` insert — `send-whatsapp` already creates that row.
- Same migration for `sendPlanToMember` and any other caller of `sendWhatsAppDocument`.

Result: invoice PDF send appears in **Live Feed** with status progressing `sent → delivered → read`, counted in **System Health → Communication Funnel**, and dedupe protects against double-clicks.

### 2. Render PDFs properly in WhatsApp Chat bubble

In `WhatsAppChat.tsx` message renderer:
- For `message_type === 'document'`: show a card with PDF icon, filename (parsed from `media_url` or stored separately), file-size if available, and an "Open" button that links to `media_url` in a new tab (or downloads).
- For `image`: render the actual `<img>` thumbnail (today it just shows a `Photo` chip).
- Keep caption text below the attachment card.

### 3. Fix member name resolution in chat

- In the thread list and chat header, fall back through:
  1. `messages.member_id → members → profiles.full_name`
  2. Match `phone_number` against `members.profiles.phone` **after normalizing both** to `+91XXXXXXXXXX` (strip spaces, leading `0`, ensure `+91` prefix).
  3. Match against `leads.phone` (same normalization) → show `Lead: <name>`.
  4. Otherwise show `Unknown · <phone>`.
- Apply same resolver to the right-hand contact card so it stops showing "Unknown contact" when the row already has `member_id` set.

### 4. Polish unknown-contact UI

- Replace the green `+` avatar with member initials (or a generic user icon for true unknowns).
- Show name as the primary line, phone as secondary muted line.
- Add a small "Save as Contact" button on the contact card for unknown numbers (ties into Contact Book — see §5).

### 5. Contact Book — recommendation

**Yes, add a lightweight Contact Book.** Use case:

- Vendors, prospects, ex-members, walk-ins, partners, suppliers — people you message but who aren't members or active leads.
- Today every unknown number shows as `+91xxxxxxxxxx` forever; staff can't tag them with a name or note.
- Lets staff **start a chat from a name**, not just reply to inbound numbers.

**Scope (minimal):**
- New table `contacts` (`id, branch_id, name, phone, email, tags text[], notes, created_by, created_at`).
- New page **Marketing → Contact Book**: searchable list, "Add Contact" sheet (right drawer), bulk import via CSV, "Start WhatsApp" / "Start SMS" actions.
- Chat name resolver (§3) gets a 4th fallback to `contacts` before "Unknown".
- "Save as Contact" button on unknown chats one-click pre-fills the sheet.
- RLS: branch-scoped; staff can read/write within their branch.

This is non-trivial; ship §1–§4 first, then §5 in a follow-up so you can validate the dispatcher flow before adding the Contact Book UI.

---

## Files to change

- `supabase/functions/dispatch-communication/index.ts` — add `attachment` passthrough, store in `metadata`.
- `src/utils/whatsappDocumentSender.ts` — re-route through dispatcher.
- `src/utils/sendPlanToMember.ts` — same refactor.
- `src/pages/WhatsAppChat.tsx` — document/image bubble renderer + name resolver.
- `src/components/communications/LiveFeed.tsx` — render attachment chip when `metadata.attachment` present.
- *(Phase 2)* migration `contacts` table + RLS, `src/pages/ContactBook.tsx`, menu entry under Marketing.

## Out of scope

- Changing WhatsApp delivery webhook plumbing (already works for documents once routed via dispatcher).
- Migrating other historical direct-write callers found by the CI guard — only invoice + plan sender for this round.
