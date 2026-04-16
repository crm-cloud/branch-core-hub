

# Plan: Razorpay Pipeline Fixes, Query Refresh, Invoice PDF, IG Settings, Member Tasks & Email

## Audit Summary

**Razorpay `create-razorpay-link`**: The edge function is correctly structured — amount conversion to paise (`Math.round(amount * 100)`) is already present, credentials are fetched from `integration_settings`, customer fields are conditionally added. No code-level bugs found. Edge function logs show clean boot/shutdown cycles with no errors.

**`/member/pay` route**: Does NOT exist in `App.tsx` — the `SendPaymentLinkDrawer` references it as a fallback URL, but no route or page handles it. This is a 404.

**React Query invalidation**: Already present in most hooks (`usePlans`, `useWallet`, `usePTPackages`, `AddCategoryDrawer`, etc.). A sweep is needed to verify completeness across all mutations.

**Invoice PDF**: `generateInvoicePDF` exists and is well-built with GST support, HSN columns, and CGST/SGST splits. It uses `window.open` + print dialog. A proper download-as-PDF button is already in `InvoiceViewDrawer`. The PDF is comprehensive — no major gaps.

**Dynamic logo**: Already implemented in both `AppSidebar.tsx` and `AppLayout.tsx` — both fetch `logo_url` from `organization_settings`.

**Diet/Workout requests**: Already route to `/my-requests` (MemberRequests page) which creates tasks. NOT routing to empty pages.

**Custom SMTP for auth emails**: Lovable Cloud manages auth emails. Custom SMTP routing for password resets requires the email domain setup flow — not a simple edge function change.

---

## What Actually Needs Building

### Module 1: MemberCheckout Page + Route (Critical Fix)
**New file: `src/pages/MemberCheckout.tsx`**
- Public page (no auth required) that reads `?invoice=` query param
- Fetches invoice details (number, amount, due, member name) via public-facing edge function or RPC
- Shows a professional payment summary card with Incline branding
- Calls `create-razorpay-link` to get the Razorpay payment link and redirects to it, OR embeds Razorpay checkout inline
- Shows real-time status via Realtime subscription on invoice table

**File: `src/App.tsx`**
- Add public route: `<Route path="/member/pay" element={<MemberCheckout />} />`

### Module 2: Edge Function Hardening — `create-razorpay-link`
- Add fallback for `null` branch: try global (null branch) integration if branch-specific not found
- Sanitize `customer.name` — strip special characters, enforce max 50 chars
- Sanitize `customer.contact` — ensure exactly `+91XXXXXXXXXX` format or omit
- Add explicit `amount` floor check: reject if < 1 (Razorpay minimum is ₹1)
- Return structured error codes instead of generic messages

### Module 3: React Query Mutation Audit
Sweep all `useMutation` across these files for missing `invalidateQueries`:
- `src/pages/POS.tsx` — verify product/inventory invalidation after sale
- `src/components/products/AddProductDrawer.tsx` — verify products list refresh
- `src/components/members/PurchaseMembershipDrawer.tsx` — verify member/invoice/membership refresh
- Any drawer or page using `useMutation` without `queryClient.invalidateQueries` in `onSuccess`

Most are already correct. Will audit and fix any gaps.

### Module 4: Instagram Integration Settings Fix
**File: `src/pages/Integrations.tsx`** (or wherever IG settings tab lives)
- Ensure the Meta/Instagram tab fetches existing `integration_settings` where `provider = 'instagram'` on mount
- Pre-populate form fields with saved values so settings persist across page loads

### Module 5: Member Dashboard — Diet/Workout Task Creation
**Already working** — "Request Diet Plan" and "Request Workout Plan" both link to `/my-requests` (MemberRequests page) which handles task creation. No fix needed.

**Store/Checkout tab**: The member store already exists at `/member-store` (MemberStore.tsx). Will add a direct link/tab in MemberDashboard.

### Module 6: Custom SMTP for Auth Emails
This is **out of scope for a simple edge function change**. Auth emails in Lovable Cloud are managed by the platform's email infrastructure. To customize the sender domain, the user needs to set up email domain via Cloud → Emails. Will check if an email domain is configured and guide accordingly.

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/MemberCheckout.tsx` | **New** — Public payment page with invoice lookup + Razorpay redirect |
| `src/App.tsx` | Add `/member/pay` route |
| `supabase/functions/create-razorpay-link/index.ts` | Sanitize customer fields, amount floor, fallback branch lookup |
| `src/pages/Integrations.tsx` | Fix IG settings tab to load saved config on mount |
| `src/pages/MemberDashboard.tsx` | Add Store/Checkout quick link |
| Various mutation files | Audit + fix any missing `invalidateQueries` calls |

## What I'm NOT Building
- Invoice PDF overhaul (already comprehensive with GST, HSN, CGST/SGST, print dialog)
- Dynamic logo in sidebar/header (already implemented)
- Diet/Workout request flow fix (already works correctly)
- Custom SMTP routing for auth emails (requires Lovable Cloud email domain setup, not an edge function)

