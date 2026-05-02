# Workflow Audit — Member, Membership, Payment, Facial Registration, Reminders, WhatsApp

**Date:** 2026-03-31  
**Scope:** Deep workflow audit for the highest-impact journeys requested: member onboarding/profile, membership sales/lifecycle, invoice/payment collection, facial registration (MIPS + biometric queue), reminders/notifications, and WhatsApp communication.

## Executive Outcome

The workflows are functionally rich and largely wired end-to-end, but several **transactional consistency** and **cross-branch isolation** risks remain. Most issues are remediable with service-layer refactors and stricter guardrails.

- **Coverage:** High (all requested workflows exist and are connected)
- **Reliability:** Medium (multi-step writes without transaction boundaries)
- **Security / tenant safety:** Medium (branch scoping is inconsistent in a few UI/service paths)
- **UX confidence:** Medium-high (good operational UI, but error semantics and status truthfulness need tightening)

---

## 1) Member Workflow Audit

### What works
- Rich member profile workflow exists (documents, measurements, membership actions, biometrics tab).
- Registration form supports digital signature capture + storage upload flow.

### Key risks
1. **Registration artifacts use publicly retrievable URLs by default flow path** (public URL retrieval after upload) which may expose signed docs if bucket policies are broad.  
2. **Member creation/conversion relies on edge function + follow-up updates**; if update phase fails after user creation, system can drift into partially-converted lead/member state.

### Recommendations
- Move signed registration docs to signed URL access pattern (short-lived links) and enforce strict bucket policies.
- Add idempotency key + reconciliation job for lead→member conversion finalization.

---

## 2) Membership Workflow Audit

### What works
- Membership purchase flow includes plan pricing, discount handling, invoice + item generation, payment write, referral rewards, locker assignment, and reminder seeding.
- Renewal gating logic exists (pre-expiry window support).

### Key risks
1. **Multi-step purchase is non-atomic** (membership, invoice, items, payment, reminders, referral rewards, locker assignment are separate writes). Any mid-step failure can leave inconsistent financial and entitlement state.  
2. **Client-generated invoice numbers** are created in UI flow; this is collision-prone and bypasses centralized sequencing standards.  
3. **Timezone-sensitive due/reminder scheduling is client-clock driven** (risk of drift across users/devices/timezones).

### Recommendations
- Replace client orchestration with a single server RPC/edge transaction for membership purchase.
- Centralize invoice numbering at database layer only.
- Schedule reminder times server-side in one canonical timezone.

---

## 3) Payment Workflow Audit

### What works
- Supports partial/full payments, multiple methods, wallet usage, invoice balance updates, and category tagging.
- Due-amount validations are present in UI layer.

### Key risks
1. **Wallet debit + payment insert + invoice update are not in one transaction**; failure after wallet debit can create financial mismatch.  
2. **Manual payment recording duplicates business logic across multiple places** (service + drawer behavior), increasing divergence risk.
3. **Payment status truth can overstate success in some communication paths** where delivery/verification is asynchronous.

### Recommendations
- Introduce server-side `record_payment_atomic(...)` RPC to enforce ACID behavior.
- Consolidate all payment mutations behind one domain service contract.
- Add post-commit reconciliation job comparing invoices vs payments vs wallet ledger.

---

## 4) Facial Registration / Biometric + MIPS Workflow Audit

### What works
- Biometric queueing, per-device sync status, and MIPS proxy/sync orchestration are implemented.
- Membership status integration exists in hardware access UX (frozen/expired/cancelled handling in UI).

### Key risks
1. **Device targeting in queue flows is broad when no device list is provided** (fetches all face terminals), which may unintentionally cross branches.  
2. **Conflict-key inconsistency risk in biometric upsert strategy** (different workflows use different upsert conflict keys; should align with active unique constraints).  
3. **Avatar-to-biometric sync updates ignore error handling**; silent failures can desync photo truth across entities.

### Recommendations
- Require explicit branch/device scope for biometric queueing; default to branch-filtered devices.
- Align all biometric upserts with a single canonical unique index contract.
- Add strict error handling + retry/audit trail for avatar→biometric propagation.

---

## 5) Reminder Workflow Audit

### What works
- Payment reminder records are created for partial-payment flows.
- Notification and preference scaffolding is present.

### Key risks
1. **Reminder generation is write-time and client-driven** in membership purchase flow; missed writes can silently skip reminders.  
2. **No explicit dedupe/idempotency contract is visible** for reminder runs and manual trigger paths.
3. **Preference enforcement path is not clearly centralized** across all reminder channels.

### Recommendations
- Generate reminders server-side from invoice state machine and due-date scheduler.
- Add idempotency key: `(invoice_id, reminder_type, scheduled_for_date)`.
- Enforce notification preference checks in one shared backend dispatcher.

---

## 6) WhatsApp Workflow Audit

### What works
- Dedicated chat UI with realtime refresh and pending→sent status updates.
- Template-based sends and edge-function integration exist.
- Message rows are persisted before delivery attempt (good auditability pattern).

### Key risks
1. **Template query path in drawer is not branch-filtered**, risking cross-branch template visibility.  
2. **Direct `wa.me` path logs status as sent optimistically** although actual user send/delivery is not guaranteed.  
3. **Auto-trigger helper swallows errors silently**, reducing observability and operational debugging signal.

### Recommendations
- Enforce branch filter on template fetches and fallback precedence (branch-specific over global).
- Use status lifecycle (`draft/opened/pending/sent/delivered/failed`) instead of immediate `sent` for `wa.me` links.
- Replace silent catch with structured log + metric + optional retry queue.

---

## 7) Priority Fix Plan

## P0 (Immediate)
1. Convert membership purchase and payment recording into atomic server-side transactions.
2. Enforce strict branch scoping for biometric queue target devices and WhatsApp template queries.
3. Stop optimistic “sent” logging for `wa.me` shortcut path.

## P1 (Next sprint)
4. Canonicalize invoice number generation at DB layer.
5. Canonicalize biometric upsert unique key strategy.
6. Add reconciliation jobs (invoice/payment/wallet and membership/invoice linkage).

## P2 (Hardening)
7. Improve reminder idempotency + centralized preference enforcement.
8. Add structured observability for WhatsApp auto-send failures and biometric sync failures.

---

## 8) Suggested Lovable Prompt Add-on (for this workflow scope)

When asking Lovable to implement improvements, include this explicit add-on:

> "Prioritize workflow hardening for member onboarding, membership purchase, payment collection, facial registration sync, reminders, and WhatsApp communication. Keep current routes and permissions intact, but redesign UX states for partial failures, pending sync, retry actions, and cross-branch safety."

