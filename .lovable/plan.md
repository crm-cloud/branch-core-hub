

# Plan: AI Flow Builder Upgrade + Branded Experience + Roles UI + Notification Merge + Meta Template Audit

## Module 1: Dynamic AI Flow Builder (Interactive Buttons + Visual Upgrade)

**File: `src/components/settings/AIFlowBuilderSettings.tsx`**

Current state: Basic card-based flow rules with keyword triggers and 3 action types. Missing interactive button support and visual flow visualization.

Changes:
- Add `interactive_buttons` field to the `FlowRule` interface — an array of `{ id: string, title: string }` (max 3 per WhatsApp spec)
- Add a new action type: `send_interactive` (sends text + button list)
- For each flow rule card, add a "WhatsApp Buttons" section that appears when action is `send_interactive` or `send_text` — allows defining up to 3 reply buttons
- Add visual flow preview: a simple top-to-bottom card chain with arrows between trigger → condition → response, using CSS borders and pseudo-elements (not a full node editor)
- Add drag-to-reorder support for rules using native HTML drag events (priority ordering)
- Add a "Test Rule" dry-run button per card that shows what would happen for a sample message

**File: `supabase/functions/whatsapp-webhook/index.ts`**
- Update the flow rule executor to send interactive button messages when `interactive_buttons` is present, using the Meta API interactive message format

## Module 2: Professional HTML Email Templates

**File: `supabase/functions/send-email/index.ts`**

Current state: Accepts raw `html` or `text` from the caller. No built-in branded template.

Changes:
- Add a `wrapInBrandedTemplate(bodyHtml, subject)` helper function that wraps any content in a responsive HTML email shell
- Template specs: `#000000` background, `#EAB308` accent, white text, Incline logo header, footer with "The Incline Life by Incline" branding
- Support `{{user_name}}`, `{{invoice_id}}`, `{{amount}}` variable interpolation in the body
- Add a `use_branded_template: true` flag in the request body (default false for backward compat)
- When enabled, wrap the provided `html`/`text` in the branded shell before dispatching

## Module 3: Unified Sidebar Branding

**File: `src/components/layout/AppSidebar.tsx`**

Current state: `BrandLogo` shows either uploaded logo or text-only "Incline". No icon + text combo.

Changes:
- Update `BrandLogo` to render a horizontal layout: small dumbbell/fitness icon SVG + org name text
- When `collapsed` prop is passed, show only the icon (shrink gracefully)
- Use Incline brand colors (`#EAB308` accent) for the icon
- If `org.logo_url` exists, show it as before but with proper collapsed-state handling (show only a cropped/small version)

## Module 4: Admin Roles Redesign

**File: `src/pages/AdminRoles.tsx`**

Current state: Single list with search and role filter dropdown. Uses Dialog for add role (should use Sheet per project rules).

Changes:
- Replace the single role filter dropdown with 4 tabs: "All Users", "Admins", "Trainers", "Staff" (using Shadcn Tabs)
- Add columns: Name, Role badges, Branch (join with `branch_members` or `profiles`), Phone, Status (active/inactive based on last login or role presence)
- Replace Dialog with Sheet (right-side drawer) for "Assign Role" per project convention
- Add a DropdownMenu per row with actions: "Assign Role", "Change Branch", "Deactivate User", "View Profile"
- Apply Vuexy card styling: `rounded-xl`, soft shadows, gradient header

## Module 5: Notification Settings Merge

**Files: `src/components/settings/LeadNotificationSettings.tsx` + `NotificationSettings.tsx`**

Current state: `LeadNotificationSettings` has its own card style with channel toggles. `NotificationSettings` has a different card layout for system alerts. They don't match visually.

Changes:
- Refactor `LeadNotificationSettings` to group toggles into 3 sections: "Lead Capture Alerts" (SMS/WhatsApp to lead), "Follow-up Reminders" (to admins/managers), "Conversion Notifications" (future placeholder)
- Match the Card/Switch/Label pattern used in `NotificationSettings` system alerts card
- Remove redundant info banners and consolidate into a single top-level description
- Keep the link to Templates settings

## Module 6: Meta Template Manager Audit

**File: `supabase/functions/manage-whatsapp-templates/index.ts`**

Current state: Already uses v25.0 and `appsecret_proof`. Handles WhatsApp templates only.

Changes:
- Add `action: 'sync_ig_icebreakers'` and `action: 'sync_messenger_quick_replies'` cases
- For Instagram: Fetch ice-breaker questions via `GET /{ig_account_id}/ice_breakers` (Meta Graph API)
- For Messenger: Fetch persistent menu / quick replies via `GET /{page_id}/messenger_profile?fields=persistent_menu`
- Store synced IG/Messenger assets in existing `whatsapp_templates` table with a `platform` discriminator column (or a new `meta_assets` table if cleaner)
- Harden WABA_ID and APP_SECRET validation: return 400 with clear error messages when missing, rather than hitting Meta and getting 403

---

## Files Changed

| File | Change |
|---|---|
| `src/components/settings/AIFlowBuilderSettings.tsx` | Interactive buttons field, visual flow preview, drag reorder |
| `supabase/functions/whatsapp-webhook/index.ts` | Send interactive button messages from flow rules |
| `supabase/functions/send-email/index.ts` | Branded HTML email template wrapper |
| `src/components/layout/AppSidebar.tsx` | Icon + text logo layout, collapsed state |
| `src/pages/AdminRoles.tsx` | Tab-based UI, DropdownMenu actions, Sheet drawer, Vuexy styling |
| `src/components/settings/LeadNotificationSettings.tsx` | Grouped sections, visual alignment with NotificationSettings |
| `supabase/functions/manage-whatsapp-templates/index.ts` | IG icebreakers + Messenger quick replies sync |

