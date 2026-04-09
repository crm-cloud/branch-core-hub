

# Dynamic Provider Configuration Schema

## Problem

Both `IntegrationSettings.tsx` (Settings page) and `Integrations.tsx` (standalone page) use a single `getConfigFields()` function that returns the same generic fields regardless of which provider is selected. Razorpay gets `key_id, key_secret, merchant_id` — but so does PhonePe and CCAvenue, which need completely different credentials. SMS providers all get the same `api_key, auth_token` fields. This breaks actual API calls.

## Solution

Create a shared provider field schema dictionary and refactor both files to use it. No database changes needed — the existing `config` (JSONB) and `credentials` (JSONB) columns on `integration_settings` already support arbitrary key-value pairs.

## Provider Field Schemas

### Payment Gateways

| Provider | Config Fields | Credential Fields |
|---|---|---|
| **Razorpay** | — | Key ID, Key Secret, Webhook Secret |
| **PhonePe** | Environment (dropdown: PROD/UAT) | Merchant ID, Salt Key, Salt Index |
| **CCAvenue** | — | Merchant ID, Access Code, Working Key |
| **PayU** | Environment (dropdown: PROD/UAT) | Merchant Key, Merchant Salt |

### WhatsApp (already partially done in Settings — align both files)

| Provider | Config Fields | Credential Fields |
|---|---|---|
| **Meta Cloud API** | Phone Number ID, Business Account ID, Webhook Verify Token | Permanent Access Token |
| **WATI** | API Endpoint URL | Access Token |
| **Interakt** | — | API Key (Base64 Encoded) |
| **Gupshup** | App Name, Source Phone Number | API Key |
| **AiSensy** | — | API Key |

### SMS

| Provider | Config Fields | Credential Fields |
|---|---|---|
| **RoundSMS** | Sender ID, Priority (dropdown), SMS Type (dropdown), all endpoint URLs | Username, Password |
| **MSG91** | Sender ID, DLT Principal Entity ID, Route (dropdown: transactional/promotional) | Auth Key |
| **Gupshup** | App Name, Sender ID, DLT Principal Entity ID | API Key |
| **Twilio** | From Number | Account SID, Auth Token |
| **TextLocal** | Sender Name | API Key |
| **Fast2SMS** | Sender ID, DLT Principal Entity ID | API Key |

### Email

| Provider | Config Fields | Credential Fields |
|---|---|---|
| **SMTP** | Host, Port, Encryption (dropdown: SSL/TLS/None), From Email, From Name | Username, Password |
| **SendGrid** | From Email, From Name | API Key |
| **Amazon SES** | Region, From Email, From Name | Access Key ID, Secret Access Key |
| **Mailgun** | Domain, From Email, From Name | API Key |

## Implementation

### 1. Create shared schema file: `src/config/providerSchemas.ts`

A single dictionary mapping `{type}_{provider}` to an array of field definitions. Each field has: `key`, `label`, `placeholder`, `type` (text/password/select), `section` (config/credentials), and optional `options` for dropdowns.

### 2. Refactor `IntegrationSettings.tsx` — `getConfigFields()` and drawer rendering

- Replace the hardcoded `getConfigFields()` (lines 796-862) with a lookup into the shared schema.
- Update the drawer form rendering (lines 892-986) to handle field types: `text`, `password`, `select` — driven by schema, not if/else chains.
- Add webhook URL display boxes inside the drawer for providers that need them (Razorpay, Meta Cloud API).
- Sheet title: "Configure {Provider Name}" using the display name from provider lists, not raw ID.

### 3. Refactor `Integrations.tsx` — same treatment

- Replace `getConfigFields()` (lines 404-436) with the shared schema lookup.
- Update drawer rendering (lines 440-514) to use dynamic field rendering with proper types.
- Add proper sheet title.

### 4. Webhook URL helper boxes

For Razorpay/PhonePe/CCAvenue: show the payment webhook URL inside the config drawer with copy button.
For Meta Cloud API: show the WhatsApp webhook URL + verify token copy inside the drawer.

### Files Changed

| File | Change |
|---|---|
| `src/config/providerSchemas.ts` | New — shared field schema dictionary |
| `src/components/settings/IntegrationSettings.tsx` | Replace `getConfigFields()`, update drawer rendering |
| `src/pages/Integrations.tsx` | Replace `getConfigFields()`, update drawer rendering |

No database migration needed. No edge function changes. The existing JSONB columns store whatever keys each provider needs.

