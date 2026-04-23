
## Focused cleanup plan — Member Profile + related production blockers

### Scope
Implement a tight cleanup pass centered on the Member Profile drawer, while also fixing the specific runtime/data issues you listed that are blocking production use.

## What will change

### 1) Member Profile tab cleanup
Update `src/components/members/MemberProfileDrawer.tsx` to:
- remove the `Access` tab trigger
- remove the `HardwareBiometricsTab` from the tab content flow
- keep hardware management elsewhere in the app, but not inside Member Profile
- remove the redundant `Quick Print` button
- keep the `Registration Form` action only

### 2) Registration Form button hardening
Add a registration-form presence check using `member_documents`:
- query whether the member already has a `document_type = 'registration_form'`
- disable the `Registration Form` button when one already exists
- show a clear disabled label like `Already Uploaded`
- prevent opening the registration form drawer from this screen once uploaded

This will be wired in:
- `src/components/members/MemberProfileDrawer.tsx`
- optionally small prop support in `src/components/members/MemberRegistrationForm.tsx` if needed for clearer status handling

### 3) Replace “Recent Visits” with a real “Recent Activity” feed
Refactor the activity tab and summary stat in `MemberProfileDrawer.tsx`:
- rename the section to `Recent Activity`
- merge recent items from:
  - attendance (`member_attendance`)
  - memberships / renewals (`memberships`)
  - payments (`payments`)
  - PT package purchases (`member_pt_packages`) when present
- normalize into one sorted timeline
- show:
  - activity type badge
  - date/time
  - amount where relevant
  - short subtitle like invoice number / plan name / checkout time

This stays simple and operational, not a redesign.

### 4) Fix broken registration-form/document links
Move member documents off fragile public-link usage.

#### Database
Add a migration to:
- add `storage_path text null` to `member_documents`
- keep `file_url` temporarily for backward compatibility
- backfill `storage_path` where possible from existing `file_url`
- avoid breaking old rows during rollout

#### Client document handling
Update:
- `src/components/members/DocumentVaultTab.tsx`
- `src/components/members/MemberRegistrationForm.tsx`

So that:
- uploads store the storage path, not just a public URL
- view/download actions generate signed URLs from storage paths
- legacy rows with only `file_url` still work via fallback logic
- registration-form saves use storage-path based records immediately

### 5) Shared signed-URL helper for documents
Add a small utility similar to the measurement photo signing helper so docs use one secure pattern:
- resolve signed URLs for `documents` bucket records
- support both single-record open/download and list hydration
- centralize fallback behavior for old `file_url` rows

## Additional targeted fixes you listed

### 6) “UI and edge-function callers are not yet fully migrated”
Make a targeted cleanup, not a full lifecycle rewrite:
- identify the specific callers still bypassing the new authority for the touched profile/payment flows
- route the relevant Member Profile / payment-related callers through the current authoritative backend path where already available
- avoid widening this into a full redesign pass

Primary targets:
- `src/pages/Payments.tsx`
- `src/components/invoices/RecordPaymentDrawer.tsx`
- any directly related payment/profile caller touched by this cleanup

### 7) `wallet_transactions.member_id does not exist`
Fix the wallet history query in:
- `src/components/members/RewardsWalletCard.tsx`

Current bug:
- it queries `wallet_transactions` by `member_id`
- the table is keyed by `wallet_id`

Fix:
- load the member wallet first
- query wallet transactions by `wallet_id`
- keep the current UI intact

### 8) `Could not find the table 'public.member_workout_completions' in the schema cache`
This is a schema/runtime mismatch in the member plan progress flow.

Fix plan:
- verify the table exists in migrations and generated types alignment
- remove the local fake-table dependency path once possible, or guard the UI/service so it fails safely if schema cache is stale
- ensure the progress block does not hard-crash Member Profile / member-facing screens

Primary target:
- `src/services/memberPlanProgressService.ts`

### 9) `/fitness/preview/... Failed to send WhatsApp message`
Improve the WhatsApp share error handling for fitness preview:
- keep the current send flow
- surface the backend error body more clearly instead of generic failure
- prevent silent/opaque failures in the sheet

Primary target:
- `src/components/fitness/member/WhatsAppShareDialog.tsx`

### 10) `payment_method` enum cast error
Fix the type mismatch where text is passed into enum-backed writes/RPC calls.

Targets:
- `src/pages/Payments.tsx`
- any related payment caller still passing raw text
- possibly SQL/RPC parameter casting if the newer migration still expects `text`

Approach:
- normalize client values to the actual `payment_method` enum values
- ensure RPC callers pass the expected type consistently
- remove direct insert patterns that are most likely to trigger enum mismatch

## Files likely to be updated

### Frontend
- `src/components/members/MemberProfileDrawer.tsx`
- `src/components/members/DocumentVaultTab.tsx`
- `src/components/members/MemberRegistrationForm.tsx`
- `src/components/members/RewardsWalletCard.tsx`
- `src/components/fitness/member/WhatsAppShareDialog.tsx`
- `src/pages/Payments.tsx`
- `src/components/invoices/RecordPaymentDrawer.tsx` if needed
- `src/services/memberPlanProgressService.ts`
- new helper, likely under `src/lib/documents/` or `src/lib/storage/`

### Database
- new migration to extend `member_documents` with `storage_path` and compatibility/backfill logic

## Acceptance checks
1. Member Profile no longer shows the `Access` tab.
2. `Quick Print` is removed.
3. If a registration form already exists, the button is disabled and labeled clearly.
4. Activity tab shows a mixed recent timeline, not just attendance.
5. Registration-form and other member document links open/download via signed URLs.
6. Wallet history no longer queries `wallet_transactions.member_id`.
7. Payment entry no longer hits the `payment_method` text-to-enum error in the cleaned flow.
8. Fitness WhatsApp share shows a real actionable error instead of only a generic failure.
9. Member Profile remains simple, production-friendly, and consistent with the existing drawer UI.

## Technical details
```text
Member Profile
  -> fetch member_documents
  -> has registration_form?
     yes -> disable button + "Already Uploaded"
     no  -> allow drawer open

Member documents
  -> upload file to storage
  -> save storage_path on member_documents
  -> view/download via signed URL
  -> fallback to legacy file_url if storage_path missing

Recent Activity
  -> attendance + memberships + payments + PT packages
  -> normalize to unified activity items
  -> sort by timestamp desc
  -> render badge + timestamp + amount/context
```
