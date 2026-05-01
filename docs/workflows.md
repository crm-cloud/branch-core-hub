# Canonical Workflow Events

Single source of truth for the events emitted across the Incline app. Each
domain has one canonical write path; downstream side-effects (audit log,
notifications, automation triggers) hang off these events — never off ad-hoc
client toasts.

| Domain     | Canonical events                                                                 | Authoritative path                                |
| ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| Leads      | `lead.created`, `lead.status_changed`, `lead.contacted`                          | `leads` table inserts/updates + automation hooks  |
| Payments   | `payment.recorded`                                                               | `record_payment` RPC (atomic)                     |
| Invoices   | `invoice.created`, `invoice.paid`, `invoice.void`                                | `invoices` table + Razorpay webhook reconciler    |
| Reminders  | `reminder.scheduled`, `reminder.sent`, `reminder.failed`                         | `automated-reminder-runner` edge function         |
| Approvals  | `approval.requested`, `approval.decided`                                         | `approval_requests` table (Maker–Checker)         |
| Benefits   | `benefit.granted`, `benefit.consumed`, `benefit.expired`                         | `benefit_ledger` writes via grant/consume RPCs    |
| Bookings   | `booking.created`, `booking.cancelled`, `booking.attended`                       | `book_facility_slot` RPC + class booking inserts  |
| Campaigns  | `campaign.sent`, `campaign.delivery_updated`, `campaign.converted`               | `marketing_campaigns` + delivery webhook ingest   |
| Feedback   | `feedback.created`, `feedback.review_requested`, `feedback.review_link_clicked`, `feedback.recovery_opened`, `feedback.google_review_matched`, `feedback.google_review_replied` | `feedback` table + `request-google-review` / `google-review-redirect` / `fetch-google-reviews` / `reply-google-review` edge functions |

## Rules

1. **Audit log** — every authoritative write fires the database trigger that
   resolves human-readable actor/target names and inserts into `audit_log`.
   Never write to `audit_log` directly from client code.
2. **No fake-success toasts** — UI toasts must be wired to TanStack Query
   `onSuccess` / `onError`, never fired before the mutation resolves.
   Optimistic UI is fine when paired with rollback.
3. **One write path per domain** — do not introduce parallel mutation paths
   that bypass the canonical RPC / table for that domain.
4. **Automation listeners** — WhatsApp triggers, smart-retention nudges, and
   loyalty rewards consume these canonical events; adding a new side-effect
   means subscribing to an existing event, not inventing a new one.

## Known follow-ups

- Confirm every campaign-conversion path (member created from a campaign
  recipient) emits `campaign.converted` exactly once for attribution.
- Verify the public site never imports the Supabase client (enforced by
  Phase 3 — InclineAscent and legal pages have zero backend reads).
