

# Deep Audit & Comprehensive Upgrade: Templates, Phone Formatting, Sidebar, Branch/Theme Persistence & Member Self-Service

## Summary

Address 8 major areas: expand WhatsApp/email templates for all business operations, auto-prefix +91 on phone inputs, fix branch/theme persistence on refresh, improve sidebar scrollability, plan WhatsApp automation triggers, and scaffold member self-service chatbot.

---

## Epic 1: Comprehensive WhatsApp Template Library

**Problem:** Only ~15 templates exist. Missing critical ones for classes, sauna/ice bath, PT sessions, orders, leads, etc. Meta requires numbered `{{1}}` placeholders and **sample text** for each variable — the rejection screenshot shows "Template variables without sample text."

**Action — Migration SQL:**
Delete existing templates from `templates` table (local CRM templates) and re-insert a comprehensive set of ~25+ professional templates covering:

| Category | Templates |
|---|---|
| **Welcome** | New Member Welcome, Trial Day Welcome |
| **Payments** | Payment Received, Payment Reminder, Payment Overdue, Refund Processed |
| **Invoices** | Invoice Share, Invoice Reminder |
| **Membership** | Renewal Reminder (7d), Renewal Reminder (1d), Membership Expired, Freeze Confirmation, Unfreeze Confirmation |
| **Classes** | Class Booking Confirmed, Class Booking Cancelled, Class Reminder (1hr before) |
| **Facilities** | Sauna Booking Confirmed, Ice Bath Booking Confirmed, Facility Slot Reminder |
| **PT Sessions** | PT Session Booked, PT Session Reminder, PT Pack Expiring |
| **Leads** | Lead Welcome, Lead Follow-up, Lead Offer |
| **General** | Birthday Wish, Referral Reward, Missed Workout Nudge, Feedback Request |

Each template will use `{{1}}`, `{{2}}` numbered placeholders with a `variables` JSON mapping (e.g., `["member_name", "plan_name", "end_date"]`).

**Edge Function Fix:** Update `manage-whatsapp-templates` to include **example values** in the Meta API `components` payload — Meta requires sample text per variable or it rejects.

```json
{
  "type": "BODY",
  "text": "Hi {{1}}, your payment of ₹{{2}} received.",
  "example": { "body_text": [["Rahul", "5000"]] }
}
```

## Epic 2: Matching Email Templates

Create email equivalents for every WhatsApp template in `src/data/messageTemplates.ts`. These are local CRM templates used for sending via SMTP (not Lovable transactional emails). Add email templates for:
- Payment Received, Payment Reminder, Renewal Reminder, Class Booking, Facility Booking, PT Session, Birthday, Referral, etc.
- Each with `subject` and `content` fields, using `{{name}}`, `{{amount}}` style placeholders.

## Epic 3: India Phone Number Auto-Prefix (+91)

**Problem:** Phone inputs across the app don't auto-prefix `+91`. Users must type it manually.

**Action:** Create a reusable `PhoneInput` component with:
- A fixed `+91` prefix badge/label before the input
- Auto-strip leading `+91`/`91`/`0` when pasting
- Store the clean 10-digit number; format with `+91` only when sending

**Files to update** (replace raw `<Input>` for phone fields):
- `AddMemberDrawer.tsx`, `AddLeadDrawer.tsx`, `AddEmployeeDrawer.tsx`, `AddTrainerDrawer.tsx`, `EditProfileDrawer.tsx`, `MemberRegistrationForm.tsx`, `RegisterModal.tsx`, `WhatsAppChat.tsx` (new chat input), `ConvertMemberDrawer.tsx`

Also normalize phone in services (`sendWhatsApp`, `send-whatsapp` edge function) to always prepend `91` if missing.

## Epic 4: Fix Branch Selection Persistence on Refresh

**Root Cause:** `BranchContext` uses `useState('all')` — no localStorage persistence. On page refresh, it resets to `'all'`.

**Fix in `BranchContext.tsx`:**
```typescript
const [selectedBranch, setSelectedBranch] = useState<string>(() => {
  return localStorage.getItem('incline-selected-branch') || 'all';
});

// In setSelectedBranch wrapper:
const handleSetBranch = (id: string) => {
  setSelectedBranch(id);
  localStorage.setItem('incline-selected-branch', id);
};
```

## Epic 5: Fix Theme Persistence on Login

**Root Cause:** `ThemeContext` already reads from localStorage on init, so the theme SHOULD persist. The likely issue is that the `ThemeProvider` mounts before localStorage is populated, or there's a race condition on login redirect.

**Fix:** Ensure `ThemeProvider` reads localStorage synchronously in the initial state (it already does — verify no clearing on login). Also check if `AuthContext` or login flow clears localStorage. If `signOut` clears all localStorage, make it selective.

**Files:** `AuthContext.tsx` — audit `signOut` for `localStorage.clear()` calls. If found, change to only clear auth-related keys.

## Epic 6: Sidebar Scroll & Fixed Layout

**Problem:** On smaller screens, sidebar items may overflow without proper scrolling.

**Current state:** Sidebar already uses `<ScrollArea className="flex-1 py-4">` which should handle scrolling. The issue may be that `h-screen` or `min-h-screen` isn't set on the sidebar.

**Fix in `AppSidebar.tsx`:**
```
className="hidden lg:flex flex-col h-screen sticky top-0 bg-sidebar ..."
```
This makes the sidebar fixed on scroll and internally scrollable. Same for mobile: ensure `SheetContent` uses full viewport height with `ScrollArea`.

## Epic 7: WhatsApp Automation Trigger System

**Plan:** Create a `whatsapp_triggers` table that maps events to template IDs:

| event | template_id | delay_minutes | is_active |
|---|---|---|---|
| `member_created` | (welcome template UUID) | 0 | true |
| `payment_received` | (payment template UUID) | 0 | true |
| `class_booked` | (class confirm UUID) | 0 | true |
| `membership_expiring_7d` | (renewal reminder UUID) | 0 | true |
| `missed_workout_3d` | (nudge UUID) | 0 | true |

Add a Settings UI tab "WhatsApp Automations" where admins can enable/disable triggers and map templates.

Create a `send-automated-whatsapp` edge function that accepts an event name + context data, looks up the trigger config, renders the template, and sends via `send-whatsapp`.

## Epic 8: Member Self-Service WhatsApp Bot (Future Scaffold)

**Plan for later implementation:** Extend the existing AI chatbot (in `whatsapp-webhook`) to handle member queries:
- "What's my membership status?" → query `members` + `memberships`
- "Book sauna at 3 PM" → call `book_facility_slot` RPC
- "Cancel my class booking" → delete from `class_bookings`
- "How many PT sessions left?" → query `pt_sessions`
- "Show my payment history" → query `invoices`

This requires adding tool-calling capability to the AI system prompt with function definitions that map to Supabase RPCs. The AI would use structured tool calls, and the webhook would execute them.

**This is a large feature — scaffold the architecture now, implement in next sprint.**

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Delete old templates, insert 25+ comprehensive templates with variable mappings |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Add `example` field to Meta API create payload |
| `src/data/messageTemplates.ts` | Add ~20 email template equivalents |
| `src/components/ui/PhoneInput.tsx` | **New** — reusable +91 prefixed phone input |
| ~9 drawer/form components | Replace phone `<Input>` with `<PhoneInput>` |
| `src/contexts/BranchContext.tsx` | Persist `selectedBranch` to localStorage |
| `src/contexts/AuthContext.tsx` | Audit signOut — prevent clearing theme/branch keys |
| `src/contexts/ThemeContext.tsx` | Verify persistence (likely already working, fix if needed) |
| `src/components/layout/AppSidebar.tsx` | Add `h-screen sticky top-0` for fixed sidebar |
| **Migration** | Create `whatsapp_triggers` table |
| `src/components/settings/WhatsAppAutomations.tsx` | **New** — trigger mapping UI |

