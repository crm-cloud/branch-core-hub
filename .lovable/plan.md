## Goal

Keep the existing 4 top-level tabs in `Settings → Communication Templates` (WhatsApp / SMS / Email / AI Studio) — **SMS and Email stay**. Only restructure the WhatsApp tab so its currently-stacked sections become clean nested **sub-tabs**.

## Top-level tabs (unchanged)

```text
[ WhatsApp ] [ SMS ] [ Email ] [ AI Studio ]
```

SMS, Email, and AI Studio render exactly as today.

## New WhatsApp sub-tabs

Inside the WhatsApp tab (under the green hero), a horizontal sub-tab strip — branch-scoped:

```text
[ CRM Templates ] [ Templates Health ] [ Meta Approved ] [ Automations ] [ AI Agent ] [ Number Routing ]
```

| Sub-tab           | Component (existing, just relocated) |
|-------------------|--------------------------------------|
| CRM Templates     | `TemplateManager` (filterType=whatsapp, hideHeader) |
| Templates Health  | `WhatsAppTemplatesHealth`            |
| Meta Approved     | `MetaTemplatesPanel`                 |
| Automations       | `WhatsAppAutomations`                |
| AI Agent          | `WhatsAppAISettings`                 |
| Number Routing    | `WhatsAppRoutingSettings`            |

Each sub-tab renders inside its own `rounded-2xl` card. The **Templates Health → Fix** action still jumps to **CRM Templates** with the prefill applied.

## What gets removed

- The wrapper card titled **"WhatsApp Settings"** with the Accordion (AI Agent / Number Routing) — those are now first-class sub-tabs.
- The single giant scroll-stacked card mixing Health + Meta + Templates + Automations.

No SMS / Email / AI Studio code is touched. No backend changes. No file deletions.

## Files to edit

- `src/components/settings/CommunicationTemplatesHub.tsx` — rebuild only the `<TabsContent value="whatsapp">` body to use a nested `<Tabs>` with the 6 sub-tabs above and remove the WhatsApp Settings accordion card.
