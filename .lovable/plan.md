
## Member Lifecycle Engine — End-to-end redesign plan

### What the audit confirms
The current lifecycle is split across UI, services, triggers, and edge functions, which creates duplicate writes and misleading states:

- Member onboarding is duplicated:
  - `create-member-user` already inserts a referral and marks it `converted`
  - `AddMemberDrawer.tsx` inserts another referral with status `new`
- Membership purchase is not transactional:
  - `PurchaseMembershipDrawer.tsx` creates membership, invoice, items, payment link/payment, reminders, member status, rewards, and locker assignment in separate client steps with partial rollback only
  - `membershipService.purchaseMembership()` duplicates a second membership/invoice write path
- Payment logic is only partially unified:
  - `record_payment` exists, but some UI still inserts directly into `payments` (`Payments.tsx` standalone path)
  - webhook flows and manual flows are not all routed through one lifecycle-aware authority
- Referral lifecycle is fragmented:
  - current states include `new`, `pending`, `converted`, `expired`
  - reward issuance also happens in triggers and UI code
- Reward claim is non-atomic:
  - `referralService.claimReward()` credits wallet first, then marks reward claimed
- Reminder statuses are not truthful:
  - `send-reminders` marks reminders/logs as `sent` while only creating app notifications, not guaranteed outbound delivery
- Storage policy is inconsistent:
  - progress photos are now private/signed
  - avatars still use public `avatars` bucket/public URLs
  - biometric flows and personnel sync still depend on public URLs and mixed buckets
- Hardware access is only partially aligned:
  - `revoke-mips-access` restores based on active membership dates, but not on an explicit dues grace rule
  - device sync is triggered from multiple places instead of a single lifecycle decision layer

### Business decisions captured
- Hardware access rule: block after a grace period when dues remain unpaid.
- Welcome communication defaults: WhatsApp, SMS, and Email when configured.

## Phase H1 — Introduce one authoritative lifecycle domain model

### New lifecycle principles
Create a small set of backend authorities and route all write paths through them:

1. `member_onboarding` authority
2. `membership_purchase` authority
3. `payment_settlement` authority
4. `referral_lifecycle` authority
5. `reward_claim` authority
6. `reminder_dispatch` authority
7. `access_evaluation` authority
8. `media_asset` authority

### Core rule
Client code should no longer orchestrate business-critical multi-step writes. The UI becomes form collection + status display; the backend becomes the state machine.

## Phase H2 — Normalize statuses and audit trail

### Referral lifecycle redesign
Replace the loose referral flow with one authoritative lifecycle:

- `invited`
- `joined`
- `purchased`
- `converted`
- `rewarded`
- `claimed`

### Add lifecycle logs
Introduce append-only workflow/event tables for auditable transitions, for example:

- `member_lifecycle_events`
- `referral_lifecycle_events`
- `payment_lifecycle_events`
- `hardware_access_events`
- `communication_delivery_events`

These should store:
- actor
- member/referral/invoice/payment id
- event type
- previous state
- new state
- reason / metadata
- idempotency key where relevant

This preserves auditability without relying on scattered console logs or partial UI toasts.

## Phase H3 — Transactional member onboarding flow

### New authoritative backend entry point
Create a server-side onboarding RPC or backend function such as `onboard_member(...)` that atomically:

1. validates caller role/branch scope
2. finds or creates auth user safely
3. upserts profile
4. inserts member row
5. creates exactly one referral row if a valid referrer exists
6. records lifecycle/audit events
7. schedules welcome communications
8. returns canonical IDs and resulting state

### Important fixes
- Remove duplicate referral creation from `AddMemberDrawer.tsx`
- Remove “auto-converted on member create” behavior from `create-member-user`
- On onboarding:
  - referral becomes `joined`, not `converted`
  - conversion only happens after qualifying purchase conditions
- Keep welcome communication optional but default-on when channels are configured

### Files affected
- `supabase/functions/create-member-user/index.ts` or replace with new authoritative function
- `src/components/members/AddMemberDrawer.tsx`
- referral trigger logic and migrations
- communication scheduling layer

## Phase H4 — Transactional membership purchase engine

### New authoritative backend entry point
Create a security-definer RPC such as `purchase_member_membership(...)` that performs one transaction for:

1. membership draft creation
2. invoice creation
3. invoice items creation
4. payment intent / transaction record creation
5. payment reminder scheduling for partials
6. referral lifecycle advancement
7. reward eligibility issuance
8. member status update
9. hardware/access evaluation scheduling
10. locker assignment if included
11. lifecycle event logging

### Required state model
Use explicit statuses so no misleading records exist:
- membership: `draft`, `pending_payment`, `active`, `frozen`, `expired`, `cancelled`
- invoice: `draft`, `pending`, `partial`, `paid`, `overdue`, `voided`, `cancelled`
- payment transaction: `created`, `pending_confirmation`, `settled`, `failed`, `voided`

### Critical behavior
- Never create an immediately active membership before qualifying payment conditions
- For online link flows:
  - create membership as `pending_payment`
  - invoice as `pending`
  - payment transaction as `created`
- For manual full payment/wallet:
  - same backend flow calls unified settlement path before finalizing `active`
- For partial payment:
  - membership activation policy must be explicit:
    - if business allows active-on-partial, store that as a controlled rule
    - otherwise remain `pending_payment`
  - the plan should encode that rule centrally, not per component

### UI migration
Refactor:
- `PurchaseMembershipDrawer.tsx`
- `membershipService.purchaseMembership()`
to call only the new backend flow.

## Phase H5 — Unified payment authority

### One path for every payment source
Route all payment entry points through a single settlement authority, extending the existing `record_payment` concept into a richer `settle_payment(...)` workflow:

Sources:
- manual recording
- wallet
- gateway webhook
- payment link completion
- future QR/UPI flows

### Responsibilities
The payment authority must atomically:
1. lock invoice/payment transaction rows
2. validate idempotency and duplicate transaction IDs
3. insert/update payment record
4. update invoice amount/status
5. activate or reevaluate membership state
6. advance referral lifecycle if purchase threshold is crossed
7. reevaluate access eligibility
8. trigger device sync if access state changed
9. write lifecycle/audit events

### Specific fixes
- Remove direct standalone `payments` table insert from `Payments.tsx`
- Make `payment-webhook` resolve and settle through the same authority as manual and wallet flows
- Make `create-razorpay-link` create only a payment intent/transaction, not business state changes
- Strengthen `record_payment` to:
  - enforce branch/member consistency
  - detect overpayment/duplicate settlement
  - support idempotency keys/webhook replay safety
  - reevaluate hardware access on both pay and void
- Strengthen `void_payment` to also reevaluate membership/access state

## Phase H6 — Unified referral lifecycle and reward issuance

### Referral model
Referrals should become authoritative and monotonic:
- one referral row per referral relationship / invite event
- no duplicate creation in multiple places
- lifecycle advanced only by backend authorities

### Transition rules
- onboarding with referral code: `invited` → `joined`
- qualifying membership purchase created: `joined` → `purchased`
- payment fully/qualifying settled: `purchased` → `converted`
- reward rows issued: `converted` → `rewarded`
- reward actually claimed: `rewarded` → `claimed`

### Reward issuance
Move reward creation fully out of:
- UI conversion logic in `Referrals.tsx`
- referral conversion trigger side effects that can duplicate issuance

Replace with one backend function that checks:
- qualifying invoice/payment threshold
- reward settings
- whether rewards already exist
- branch scoping

## Phase H7 — Atomic and idempotent reward claim

### New authoritative backend entry point
Create `claim_referral_reward(...)` RPC that atomically:
1. locks reward row
2. confirms unclaimed state
3. creates wallet credit transaction
4. updates wallet balance
5. marks reward claimed
6. logs claim event
7. returns idempotent success if already claimed under retry

### Fixes
Replace client-side sequence in `referralService.claimReward()` with the RPC.
Update:
- `MemberReferrals.tsx`
- `Referrals.tsx`

This eliminates double-credit risk.

## Phase H8 — Truthful reminder dispatch engine

### New model
Split reminder lifecycle into real delivery states:
- `scheduled`
- `sending`
- `sent`
- `failed`
- `skipped`

### Dispatch behavior
Refactor `send-reminders` so it:
1. selects due reminders
2. marks batch rows `sending`
3. attempts actual outbound channel delivery via configured provider
4. records per-channel result
5. sets final status truthfully

### Channel rules
- WhatsApp: use configured backend send function
- SMS: use configured backend send function
- Email: use configured backend send function
- In-app notifications: optional companion channel, not a substitute for outbound delivery

### Welcome sequence
Support new reminder/communication types:
- welcome
- payment due
- overdue
- membership expiry
- class/PT/benefit reminders
- future nurture sequences

### Logging
Create/standardize a delivery log that stores:
- reminder id
- channel
- provider response id
- status
- error message
- attempt count
- timestamps

### UI impact
Settings/reminder UI can stay mostly intact, but must reflect the truthful statuses.

## Phase H9 — Unified private media/storage strategy

### Problem to solve
Progress photos are private, but avatars and biometric photos still assume public URL access. This must become one coherent model.

### New storage design
Use private buckets/paths and store storage paths, not public URLs, for:
- profile avatars
- biometric/facial enrollment photos
- progress/measurement photos

Recommended structure:
```text
member-media/
  members/{member_id}/avatar/current.jpg
  members/{member_id}/biometric/source.jpg
  members/{member_id}/progress/{measurement_id}/front.jpg
  members/{member_id}/progress/{measurement_id}/side.jpg
staff-media/
  employees/{employee_id}/avatar/current.jpg
  trainers/{trainer_id}/avatar/current.jpg
```

### Access approach
- UI reads via signed URLs
- device/backend sync fetches secure URLs or file bytes server-side
- no long-lived public URLs saved in app tables

### Required refactors
- `MemberAvatarUpload.tsx`
- `biometricService.ts`
- personnel/device sync uploaders
- profile/avatar consumers
- member progress signed URL refresh logic

### Compatibility layer
Add a migration-safe fallback reader so older public URLs can still be recognized and gradually normalized to storage paths.

## Phase H10 — Biometric, hardware, and access reevaluation engine

### New access policy authority
Create `evaluate_member_access_state(member_id)` backend authority that computes access from:

- membership status
- expiry dates
- freeze status
- suspension/blacklist state
- dues grace rule
- biometric enrollment readiness if required by device flow

### Dues grace rule
Since you chose “Block after grace”, add configurable policy data such as:
- `block_access_on_overdue boolean`
- `overdue_grace_days integer`

This evaluation should determine:
- app-visible hardware access status
- whether to revoke/restore turnstile validity
- whether device resync is needed

### Required change
All flows that can affect access must call the same reevaluator:
- membership purchase
- payment settlement
- void/refund
- freeze approval
- unfreeze
- expiry automation
- suspension/reactivation
- biometric enrollment state changes if required

### Result
No more ad-hoc revoke/restore decisions in scattered UI/service files.

## Phase H11 — Preserve and harden progress / 3D body readiness

### Keep current improvements
Preserve:
- private progress photos
- signed URL hydration
- current 3D body UI architecture

### Additional hardening
- refresh signed URLs on focus/refetch so long-lived sessions do not break
- move photo hydration behind a reusable secure media service
- ensure 3D tab only consumes signed/private sources
- keep placeholder/GLB-ready structure intact for future real male/female assets and morph targets

### Files likely touched
- `src/lib/measurements/photoSigning.ts`
- `src/hooks/useMemberData.ts`
- `src/components/members/MeasurementProgressView.tsx`
- `src/pages/MyProgress.tsx`
- progress 3D components only if API shape changes

## Phase H12 — UI integration migration

### Keep UI mostly intact, swap backend calls
Update current flows to call the new authoritative APIs:

- `AddMemberDrawer.tsx` → onboarding authority
- `PurchaseMembershipDrawer.tsx` → purchase authority
- `Payments.tsx` / `RecordPaymentDrawer.tsx` → unified payment authority only
- `Referrals.tsx` / `MemberReferrals.tsx` → lifecycle-aware referral/reward APIs
- member progress/photo/avatar/biometric components → unified media service
- reminder admin actions → truthful reminder dispatch/statuses

### Preserve UX conventions
- continue using Sheets for workflows
- keep Vuexy-style cards/badges
- keep TanStack Query as orchestration layer
- add clearer lifecycle-specific toasts based on authoritative backend responses

## Phase H13 — Migration strategy

### First pass: authoritative backend layer
Build the server-side lifecycle layer first:
1. schema/status additions
2. new RPCs/functions
3. audit/event tables
4. storage policy normalization
5. access evaluation engine

### Second pass: adapt existing UI
Switch UI files one by one to the new backend flows without redesigning every screen.

### Third pass: retire duplicates
Remove or deprecate legacy paths:
- duplicate referral inserts
- direct payments inserts
- old purchaseMembership client orchestration
- trigger-based reward issuance that conflicts with new lifecycle engine

## Files most likely to change

### Backend / database
- `supabase/migrations/<new>.sql`
- `supabase/functions/create-member-user/index.ts` or replacement onboarding function
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/create-razorpay-link/index.ts`
- `supabase/functions/send-reminders/index.ts`
- `supabase/functions/revoke-mips-access/index.ts`
- possibly a new shared lifecycle helper function set in SQL and/or shared edge code

### Frontend
- `src/components/members/AddMemberDrawer.tsx`
- `src/components/members/PurchaseMembershipDrawer.tsx`
- `src/pages/Payments.tsx`
- `src/components/invoices/RecordPaymentDrawer.tsx`
- `src/services/membershipService.ts`
- `src/services/billingService.ts`
- `src/services/referralService.ts`
- `src/services/walletService.ts`
- `src/services/biometricService.ts`
- `src/components/members/MemberAvatarUpload.tsx`
- `src/hooks/useMemberData.ts`
- `src/components/members/MeasurementProgressView.tsx`
- `src/pages/MyProgress.tsx`

## Acceptance checks
1. Member onboarding creates one authoritative referral state only.
2. Membership purchase cannot leave active membership/invoice side effects after downstream failure.
3. Manual, wallet, and webhook payments converge to one lifecycle authority.
4. Reward claim cannot double-credit under retries.
5. Reminders are only marked `sent` after actual outbound success; otherwise `failed` or `skipped`.
6. Avatar, biometric, and progress photos all work through private storage + signed access.
7. Hardware access reflects expiry, freeze, suspension, and overdue-after-grace rules consistently.
8. The existing 3D progress feature continues working without privacy regressions.
9. Existing UI remains functional while moving to backend-first workflows.

## Technical details
```text
UI sheets/forms
  -> call authoritative lifecycle RPC / backend function
  -> backend performs validation, locking, state transitions, audit logging
  -> backend returns canonical lifecycle result
  -> UI invalidates queries and renders resulting state

Authoritative engines:
  onboard_member
  purchase_member_membership
  settle_payment / void_payment
  advance_referral_lifecycle
  claim_referral_reward
  dispatch_reminders
  evaluate_member_access_state
  media signing / secure asset resolution
```
