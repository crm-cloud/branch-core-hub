Audit result

I found two high-confidence causes behind the symptoms:

1. Meta WhatsApp API details appear blank after reopening the sheet because credential fields are rendered as normal password inputs bound directly to stored values. If the browser/password-manager autofills or clears those password fields, saving the form can overwrite the saved `credentials` JSON with blank strings. There is currently no “leave existing secret unchanged” behavior.

2. There are two integration UIs with different provider lists:
   - Settings → Integrations uses `meta_cloud` for Meta Cloud API.
   - `/integrations` currently lists WATI/Interakt/Gupshup/Custom but not `meta_cloud`.
   This can make users configure the wrong provider or see a different/blank-looking configuration from another screen.

3. Template Manager error handling is too generic. The backend function currently returns 502 for Meta business-rule rejections, and the frontend throws the platform function error object first. This is why the UI can show a generic “Edge Function error” / “200 edge issue” instead of Meta’s actual message like:
   - “Content in this language already exists”
   - “Template category doesn't match”
   - “An unknown error occurred”

4. The latest backend logs confirm Meta rejected recent template submissions with real, actionable errors, but the UI does not surface them well.

Plan

1. Protect saved Meta/API credentials from being wiped
   - Update integration credential inputs so stored password/token fields show as masked placeholders, not the actual secret value.
   - Track whether each credential field was edited in the current sheet session.
   - On save, merge unchanged credential fields from the existing row, so blank untouched password fields cannot overwrite stored tokens.
   - Add an explicit “Replace” / “Clear” behavior for secrets only when the user intentionally changes them.
   - Apply this to both integration configuration components currently in the app so behavior is consistent.

2. Unify WhatsApp provider configuration
   - Add `meta_cloud` to the `/integrations` WhatsApp provider list and align it with Settings → Integrations.
   - Prefer Meta Cloud API as the primary WhatsApp provider in UI copy because existing template/webhook functions use that provider shape.
   - Add a small credential health badge per provider: “Configured”, “Missing token”, “Missing WABA ID”, “Inactive”.

3. Add integration credential audit visibility without exposing secrets
   - Add a safe audit/health panel in the integration sheet showing only presence checks, for example:
     - Phone Number ID: present/missing
     - WABA ID: present/missing
     - Access Token: saved/missing
     - App Secret: saved/missing
   - Do not print or reveal secret values.
   - Optionally log integration configuration updates to the existing audit/error infrastructure with masked metadata only.

4. Fix Template Manager error reporting
   - Change `handleSubmitToMeta` to inspect both `data` and `error.context/body` returned by the function, so the actual Meta message is shown even when the function returns a non-2xx response.
   - Display Meta’s `error_user_title`, `error_user_msg`, `code`, `subcode`, and `fbtrace_id` in the Submit to Meta drawer when available.
   - Replace generic toast-only failure with an inline error card that users can copy.

5. Improve the backend template function response contract
   - Update `manage-whatsapp-templates` to return structured JSON for Meta API errors:
     - `success: false`
     - `error`
     - `meta_error: { message, user_title, user_msg, code, subcode, fbtrace_id, raw }`
   - Use more accurate statuses:
     - 400 for Meta validation/business-rule rejections
     - 401/403 for auth/role issues
     - 502 only for true network/upstream reachability failures
   - Keep CORS headers on every response.
   - Continue logging errors, but include structured details so System Health becomes useful.

6. Add pre-submit template validation to prevent avoidable Meta rejections
   - Before submitting, check if the same template name/language/category already exists in the local synced `whatsapp_templates` table.
   - If same name + language exists with a different category, block submission and explain: “Meta does not allow changing category for existing template name.”
   - If same name + language already exists, block duplicate creation and suggest using a new template name.
   - Show a “Sync from Meta first” warning when the local catalog is stale or empty.

7. Test and verify
   - Test saving integration settings with existing secret fields untouched; confirm they remain present.
   - Test intentionally replacing a token; confirm the new token is saved.
   - Test Meta template submit with a duplicate name/language and category mismatch; confirm the UI shows the exact actionable message instead of a generic edge error.
   - Test Meta template sync/list after changes.

Files expected to change

- `src/components/settings/IntegrationSettings.tsx`
- `src/pages/Integrations.tsx`
- `src/components/settings/TemplateManager.tsx`
- `src/components/settings/MetaTemplatesPanel.tsx` if needed for health messaging
- `supabase/functions/manage-whatsapp-templates/index.ts`

No secrets will be exposed in the UI or logs.