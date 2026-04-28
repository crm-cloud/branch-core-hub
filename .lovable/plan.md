# Member Dashboard, Checkout, Plans & WhatsApp CRM Hardening

This sprint tackles four discrete issues raised in the readout: a broken POS checkout entry, a confusing plan-purchase drawer, a WhatsApp lead source that shows the raw token + missed admin notification, and a Convert-to-Lead flow that doesn't pre-fill anything and lacks context.

## 1. POS checkout from Member Store → embedded Razorpay (no front-desk fallback)

**Problem:** Clicking checkout still surfaces "An invoice will be generated. Pay at the front desk." in some flows; the unified `MemberCheckout` page exists but is not always reached, and `create_pos_sale` 400s have appeared.

**Fix:**
- Verify and harden the `MemberStore.checkout` mutation:
  - Remove any remaining "pay at front desk" toast messaging — when `finalAmount > 0` we always navigate to `/member/pay?invoice=<id>`.
  - Guard against the historic `create_pos_sale` 400 by validating `member.user_id` and item shape before the RPC call; surface a clear toast when payload is malformed instead of a raw 400.
- On `MemberCheckout`:
  - When the resolved gateway is Razorpay, **auto-open** the Standard Checkout modal on first render (no manual "Pay" tap) so it feels like an inline iframe. Keep the manual button as a retry path if the modal is dismissed.
  - When no gateway is configured for the branch **or** the configured provider is not Razorpay, redirect to `Settings → Integrations → Payment Gateway` (admin) or show a clear "Online payments not enabled at this branch — please pay at the front desk" card (member) instead of erroring out.
- Razorpay is the only provider with a true in-page modal. PhonePe / CCAvenue / PayU are redirect-only — keep them as a redirect path with an explanatory note (no fake iframe wrapper).

## 2. Plan purchase from Member Dashboard → select → confirm → pay (no drawer asking for plan)

**Problem:** When a member taps "Buy plan" on a *specific* plan card in `/member/plans`, the `PurchaseMembershipDrawer` opens and asks them to choose a plan again.

**Fix:**
- Extend `PurchaseMembershipDrawer` to accept an optional `presetPlanId` prop. When provided, the plan selector is pre-filled and the drawer opens directly on the **Confirm & Pay** step (price summary, GST toggle, optional discount).
- In `MemberPlans.tsx`:
  - Pass `presetPlanId={plan.id}` from each plan card's "Buy plan / Renew with this plan" button.
  - Top-level "Renew / Upgrade" and "Browse plans" buttons keep the existing plan-picker behaviour.
- After successful purchase the drawer routes the member to `/member/pay?invoice=<id>` whenever an online balance is due, mirroring the store flow.
- Add a direct **Pay Now** button on the Member Dashboard's "Outstanding dues" tile that links to the latest pending invoice via `/member/pay?invoice=<id>`.
- Surface purchased benefit add-ons as entitlement chips on the Member Dashboard (read from `member_benefit_credits`) so add-ons are no longer invisible after purchase.

## 3. WhatsApp lead source: icon + label, and missing admin notification

**Problem:**
- Lead list shows raw `whatsapp_api` / `whatsapp_ai`. We want a WhatsApp icon + the word "WhatsApp".
- A WhatsApp-API lead created yesterday did not trigger an admin notification.

**Fix:**
- Update `src/lib/leadSource.ts` `SOURCE_META` and `normalizeSource`:
  - Map `whatsapp_ai`, `whatsapp_api`, `whatsapp_ad`, `whatsapp_business` → label "WhatsApp", icon `MessageCircle` (green) so `LeadSourceBadge` automatically renders correctly across the Leads list, FollowUp Center, and Marketing CRM.
- Notification gap: inspect why `notify-lead-created` did not fire for `lead e5e87a35` (no edge logs found):
  - Add a server-side fallback inside `whatsapp-webhook` so that after the lead insert, we also write the `notifications` rows directly (admin + manager users for the branch) instead of relying on the fire-and-forget HTTP hop succeeding. The `notify-lead-created` function still owns WhatsApp/SMS dispatch; the in-app bell notification is now guaranteed.
  - Add a debug log line + idempotency key on `notify-lead-created` so we can confirm invocations going forward.

## 4. WhatsApp Chat → "Convert to Lead" auto-populates + premium context panel

**Problem:** Convert-to-Lead opens an empty drawer; the chat layout doesn't show contact context (avatar, phone, email, past chats) on the right.

**Fix:**
- `AddLeadDrawer` props: accept optional `prefill` (`full_name`, `phone`, `source`, `notes`). When called from `WhatsAppChat`, pass:
  - `full_name`: `selectedContact.contact_name`
  - `phone`: normalized (+91 prefix enforced)
  - `source`: `whatsapp_api`
  - `notes`: last 3 inbound messages stitched together for quick context
- Add a **right-side Context Panel** (240–280 px) inside `WhatsAppChat`, visible when a contact is selected on desktop (≥1024 px). Hidden behind a "Details" toggle on smaller screens. Contents (Vuexy-styled `rounded-2xl` cards with soft shadows):
  - **Profile card** — avatar (initial fallback), contact name, phone with copy-to-clipboard, email if known, member badge / lead status pill.
  - **Quick actions** — Convert to Lead, View Lead, View Member Profile, Assign Staff.
  - **Past interactions** — counts of total messages, unread, last seen, last message preview.
  - **Recent chats with this contact** — collapsible scroll of prior 20 messages with date headers.
- Use the UI/UX skill rules already in project memory (Vuexy theme, `bg-indigo-50`/`text-indigo-600` icon badges, `rounded-2xl` cards, soft shadows).

## Out of scope this turn
- Trainer Dashboard revenue KPI relabel/branch fix (logged for follow-up).
- Building a dedicated Trainer operational cockpit page.

## Files touched (technical)

- **Member checkout / plans / dashboard**
  - `src/pages/MemberStore.tsx` — toast cleanup, payload validation.
  - `src/pages/MemberCheckout.tsx` — auto-open Razorpay modal; clearer fallback when gateway not configured.
  - `src/pages/MemberPlans.tsx` — pass `presetPlanId` to drawer.
  - `src/pages/MemberDashboard.tsx` — Pay Now CTA on dues tile, add-on entitlement chips.
  - `src/components/members/PurchaseMembershipDrawer.tsx` — `presetPlanId` prop, jump straight to Confirm step, navigate to `/member/pay` on success.

- **Lead source label + WhatsApp notifications**
  - `src/lib/leadSource.ts` — add `whatsapp_api`, `whatsapp_ad`, `whatsapp_business` aliases.
  - `supabase/functions/whatsapp-webhook/index.ts` — guaranteed in-app notifications write after AI lead capture.
  - `supabase/functions/notify-lead-created/index.ts` — extra logging + idempotency.

- **WhatsApp Chat → Lead UX**
  - `src/components/leads/AddLeadDrawer.tsx` — accept `prefill` prop.
  - `src/pages/WhatsAppChat.tsx` — pass prefill, add right-side Context Panel.

No DB migrations required. No new edge functions. No new secrets.

Approve to proceed.