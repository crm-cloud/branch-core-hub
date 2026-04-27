## Plan: Member checkout and portal workflow hardening

### Problems to fix
- Member Store currently creates a pending POS invoice and tells members to pay at the front desk when an online gateway should be used.
- `create_pos_sale` is failing because the member-store cart payload omits fields the backend RPC totals from (`name` and `total`).
- `/my-plans` is currently a fitness workout/diet page, duplicating `/my-workout` and `/my-diet`, instead of showing membership cycle and plan purchase/renewal.
- `My Progress` duplicates workout/diet tabs even though dedicated workout and diet pages already exist.
- Member portal purchase flows need clearer separation between membership plans, add-ons, product store, invoices, and requests.

### Phase 1: Fix Store checkout and payment gateway routing
1. Patch `src/pages/MemberStore.tsx` checkout payload:
   - Include `name` and `total` per cart item so `create_pos_sale` can calculate subtotal correctly.
   - Continue using stable idempotency keys.
2. Change member-store payment UX:
   - If wallet fully covers the order, call `create_pos_sale` as a paid wallet order.
   - If amount remains due, create the POS invoice as awaiting online payment, then immediately call the existing payment-link function.
   - Redirect the member to the generated payment URL, or show a clear payment button/link if popup/redirect is blocked.
   - Replace “Pay at the front desk” copy with online payment copy.
3. Add gateway fallback messaging:
   - If no active gateway is configured, show a clear “online payments are not configured for this branch” message and route the member to invoices/support instead of silently falling back to front-desk payment.

### Phase 2: Harden gateway backend behavior
1. Update `create-payment-order` and `create-razorpay-link` consistency:
   - Support branch-specific gateway settings with global fallback consistently.
   - Return structured error codes (`NO_GATEWAY`, `MISSING_CREDENTIALS`, `GATEWAY_ERROR`) so the UI can show useful messages.
2. Review invoice payment flow in `MyInvoices.tsx`:
   - Use active gateway discovery instead of hardcoding Razorpay where possible.
   - Keep the existing Razorpay checkout if configured, but fail gracefully with setup guidance when not configured.
3. If needed, add/adjust a small migration to make `create_pos_sale` more defensive:
   - Calculate item totals from `quantity * unit_price` when `total` is missing.
   - Return `success: true`, `invoice_number`, and payment metadata consistently.
   - Preserve all existing backend authority, wallet, coupon, invoice, and inventory logic.

### Phase 3: Rebuild `/my-plans` as membership lifecycle and plan purchase
1. Replace the current workout/diet content in `src/pages/MemberPlans.tsx` with a member membership hub:
   - Current membership card: plan name, status, start/end date, days remaining, freeze state, dues.
   - Renewal/purchase CTA using the existing `PurchaseMembershipDrawer`.
   - Available membership plans filtered by member branch.
   - Recent membership history and pending invoices.
2. Keep `/my-workout` and `/my-diet` unchanged visually, as requested.
3. Update route/menu labels only if needed so “My Plans” clearly means membership plans, not fitness plans.

### Phase 4: Remove duplicate fitness tabs from My Progress
1. Keep the premium 3D body/secure photo/measurement experience intact.
2. Remove the Workout Plan and Diet Plan tabs from `src/pages/MyProgress.tsx`.
3. Add small navigation cards or buttons to `/my-workout` and `/my-diet` instead of duplicating their full content.
4. Clean up now-unused queries/imports in `MyProgress.tsx`.

### Phase 5: Member dashboard workflow polish
1. Audit `MemberDashboard`, `MyBenefits`, `MemberStore`, `MyInvoices`, and `MemberRequests` links so purchase journeys are clear:
   - Buy/Renew membership → `/my-plans`
   - Buy service add-ons → add-on drawer / benefits page
   - Buy products → `/member-store`
   - Pay invoice → `/my-invoices`
   - Freeze/unfreeze/trainer change/request new plans → `/my-requests`
2. Add clearer CTA cards where gaps exist, without changing the good existing workout/diet UI.
3. Ensure TanStack Query invalidations cover store products, invoices, wallet, benefits, and active membership after purchases.

### Phase 6: Address visible console/UI quality issues
1. Fix missing Sheet/Dialog accessibility descriptions where warnings occur.
2. Fix `THREE.Color: transparent` by replacing invalid color value with a valid transparent material/color pattern.
3. Fix missing `avatar-female.glb` path or add a safe fallback to avoid 404 and WebGL context churn.
4. Treat the realtime WebSocket close as non-blocking unless it persists after channel cleanup; avoid unnecessary subscriptions where they are not needed.
5. Investigate the profiles 406 query and change `.single()` calls that can legitimately return no row to `.maybeSingle()` where appropriate.

### Technical notes
- No direct client-side billing orchestration will be reintroduced.
- Product sales will continue through `create_pos_sale`.
- Membership purchases will continue through the backend membership purchase RPC.
- Benefit/PT add-ons will continue through `purchase_benefit_credits` and `purchase_pt_package`.
- Online payment initiation will happen after authoritative invoice creation, then hand off to the configured gateway.
- Existing Vuexy-style cards, drawers, badges, and member workout/diet UX will be preserved.