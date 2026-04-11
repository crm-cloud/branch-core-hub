

# Settings Reorganization: AI Hub, Template Consolidation & Ice Bath Tool

## Audit Summary

Current mess:
- **AI settings scattered across 5 places**: AIAgentControlCenter (Settings > AI Agent), WhatsAppAISettings (Integrations > WhatsApp), AIFlowBuilderSettings (Integrations > Lead Capture), LeadNurtureConfig (inside RetentionCampaignManager), WhatsAppAutomations (inside RetentionCampaignManager)
- **Templates duplicated in 3 places**: TemplateManager (Settings > Templates), LeadNotificationSettings message templates (inside NotificationSettings), RetentionCampaignManager inline message editors
- **WhatsApp Automations** lives inside Marketing & Retention instead of Integrations > WhatsApp

---

## Module 1: AI Agent Hub (Tabbed)

Rebuild `AIAgentControlCenter.tsx` as a tabbed hub consolidating all AI features:

| Tab | Content (moved from) |
|---|---|
| **Dashboard** | Current activity feed + stats (already here) |
| **Tools & Testing** | Tool toggles + Manual Test Lab (already here) |
| **Auto-Reply** | WhatsAppAISettings (from IntegrationSettings) |
| **Lead Capture** | AIFlowBuilderSettings (from IntegrationSettings) |
| **Lead Nurture** | LeadNurtureConfig (from RetentionCampaignManager) |

Each tab gets a clean card layout. The existing components are moved as-is into tab panels.

**Remove** WhatsAppAISettings and AIFlowBuilderSettings from IntegrationSettings.
**Remove** LeadNurtureConfig from RetentionCampaignManager.

---

## Module 2: WhatsApp Automations to Integrations

Move `WhatsAppAutomations` component from RetentionCampaignManager into IntegrationSettings under the WhatsApp tab.

**Remove** the `<WhatsAppAutomations />` render from RetentionCampaignManager's LeadNurtureConfig.

---

## Module 3: Template Consolidation

### Move Lead Notification Templates to Template Manager
- Add new trigger types in TemplateManager: `lead_welcome_sms`, `lead_welcome_whatsapp`, `team_alert_sms`, `team_alert_whatsapp`
- The LeadNotificationSettings component keeps its channel toggle switches but **removes** the inline Textarea template editors
- Instead, show a link/note: "Edit message templates in Settings > Templates"

### Retention Campaign Templates
- RetentionCampaignManager already stores templates in `retention_templates` table (separate from `templates`)
- Keep the inline editors there since they're stage-specific and tightly coupled to the retention flow
- But replace the `mailto:` test send with the provider-based email utility (already done in previous sprint)

### Remove LeadNotificationSettings from NotificationSettings
- Move `<LeadNotificationSettings />` out of `RunRemindersButton` (currently nested awkwardly inside it)
- Place it as its own section within NotificationSettings, properly separated

---

## Module 4: Ice Bath / Sauna Booking Tool

The system already has `book_facility_slot` RPC and the AI tool `book_facility_slot` registered in the webhook. The user's proposed SQL function is redundant since the existing RPC handles capacity checks, benefit validation, and atomic booking.

**No new SQL function needed.** The existing `book_facility_slot(p_slot_id, p_member_id, p_membership_id)` RPC already handles ice bath and sauna bookings. The AI agent already has `get_available_slots` + `book_facility_slot` + `cancel_facility_booking` tools registered.

Verify the tool is enabled in the AI Agent Control Center's toggle panel.

---

## Module 5: Clean Up NotificationSettings

Fix the awkward nesting where `LeadNotificationSettings` is rendered inside `RunRemindersButton`. Move it to be a proper sibling section.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/settings/AIAgentControlCenter.tsx` | Add tabs: Dashboard, Tools, Auto-Reply, Lead Capture, Lead Nurture. Import and embed WhatsAppAISettings, AIFlowBuilderSettings, LeadNurtureConfig |
| `src/components/settings/RetentionCampaignManager.tsx` | Remove LeadNurtureConfig section and WhatsAppAutomations import |
| `src/components/settings/IntegrationSettings.tsx` | Remove WhatsAppAISettings and AIFlowBuilderSettings. Add WhatsAppAutomations to WhatsApp tab |
| `src/components/settings/NotificationSettings.tsx` | Move LeadNotificationSettings out of RunRemindersButton into its own card section. Remove inline template editors, add note pointing to Template Manager |
| `src/components/settings/LeadNotificationSettings.tsx` | Remove inline message template Textareas. Keep channel toggle switches only. Add info banner linking to Templates |
| `src/components/settings/TemplateManager.tsx` | Add lead notification trigger types (lead_welcome, team_alert) to TEMPLATE_TRIGGERS |
| `src/pages/Settings.tsx` | No menu changes needed (AI Agent tab already exists) |

No database migrations required.

