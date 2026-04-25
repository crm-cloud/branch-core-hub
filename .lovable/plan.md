## Issue Audit & Findings

I verified each issue against the database and code:

### 1. `member_workout_completions` 404 (PGRST205)
- **Confirmed**: Table does NOT exist in DB. Only `meal_catalog` exists. Service `src/services/memberPlanProgressService.ts` has TypeScript shims for `member_workout_completions`, `member_meal_completions`, and `member_meal_swaps`, but the actual tables were never migrated.
- **Result**: Plan adherence widget (`MemberPlanProgressBlock`), workout/meal check-off, and meal-swap features all crash with 404.

### 2. POS RPC 400 (`create_pos_sale`)
- **Confirmed**: RPC signature is correct, but `src/services/storeService.ts` line 134 sends `p_slip_url: sale.slipUrl` while reading `sale.slipUrl` from a type that has it correctly defined. The 400 is likely coming from RLS or a payload mismatch. Need to inspect the actual error body — likely either `idempotencyKey` collision, missing `sold_by`, or the new `wallet_applied`/`discount_amount` validation failing for guest checkouts. Will reproduce via edge logs.

### 3. Signed Contract showing only signature image
- **Confirmed**: After signing, `signature_status` flips to `signed` but there is **no "View Signed Contract" UI** in HRM. `openContractPdf` only renders the unsigned template. The drawer that's appearing to the user is showing just the signature blob instead of the full signed agreement (terms + signer details + signature panel + audit metadata).

### 4. Multi-Provider AI Gateway (Lovable + Free providers)
- **Confirmed**: All AI calls hardcoded to `https://ai.gateway.lovable.dev/v1/chat/completions` (verified in `score-leads`, `generate-fitness-plan`, `whatsapp-transactional-ai-agent`, etc.). No provider abstraction exists. User wants to optionally route to OpenRouter, Ollama (self-hosted on their VPS), DeepSeek API, or other OpenAI-compatible endpoints — keeping Lovable AI as the default/fallback.

---

## Plan

### Fix 1 — Restore Fitness Tracking Tables (DB migration)

Create the three missing tables that the service layer already expects:

```sql
CREATE TABLE public.member_workout_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_source text NOT NULL CHECK (plan_source IN ('member_fitness_plans','workout_plans','ai_generated')),
  plan_id uuid NOT NULL,
  week_number int,
  day_label text NOT NULL,
  exercise_index int NOT NULL,
  exercise_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, plan_source, plan_id, week_number, day_label, exercise_index)
);

CREATE TABLE public.member_meal_completions ( ...analogous schema, keyed by meal_date+meal_index... );

CREATE TABLE public.member_meal_swaps ( ...with original_meal jsonb, new_meal jsonb, catalog_meal_id uuid... );
```

- Enable RLS with two policies per table:
  - Member can SELECT/INSERT/DELETE rows where `member_id = (select id from members where user_id = auth.uid())`
  - Staff (`owner`/`admin`/`manager`/`staff`/`trainer`) can SELECT all in their branch scope
- Add indexes on `(member_id, plan_id)` and `(member_id, completed_at DESC)`.

### Fix 2 — POS Checkout 400

- Add structured error logging to the `create_pos_sale` RPC (`RAISE EXCEPTION 'POS_VALIDATION: %', detail`) so the 400 body returns a human-readable cause to the client.
- Update `src/pages/POS.tsx` toast handler to surface `error.message` and `error.details` instead of swallowing it, so we (and you) can see the real reason next time.
- Pull the most recent failure from Postgres logs to identify and patch the actual root cause (likely guest checkout + wallet_applied combo, or a NOT NULL on `sold_by` when the cashier is logged in via a non-staff role).

### Fix 3 — Signed Contract Viewer

- Add a new component `src/components/hrm/SignedContractViewer.tsx` (right-side Sheet, per the no-dialog rule).
- When a contract row in HRM has `signature_status = 'signed'`, replace the "Send for Signature" button with a "View Signed Contract" action.
- The viewer fetches `contracts` + `contract_signatures` + `contract_signature_requests` and renders:
  1. Full agreement terms (same `getEmploymentAgreementTemplate` rendering as `ContractSign.tsx`)
  2. Employee details block
  3. **Signature panel** showing typed signature, signer name, signer contact, signed-at timestamp, IP address, user agent
  4. "Download as PDF" button using existing `buildContractPdf` (extend `src/utils/pdfBlob.ts`)
  5. "Share via WhatsApp/Email" using the same PDF attachment pipeline as invoices
- Also surface this in the public `ContractSign.tsx` page after a successful sign — show the full signed document in a confirmation card instead of just a toast.

### Fix 4 — Multi-Provider AI Gateway (Major)

Build a unified AI dispatcher that lets you switch between Lovable AI, OpenRouter, Ollama (self-hosted on your VPS), DeepSeek, and any OpenAI-compatible endpoint — per organization, per use case.

**a) New table `ai_provider_configs`** (`integration_settings` style):
- `id`, `org_id`/`branch_id`, `provider` (`lovable` | `openrouter` | `ollama` | `deepseek` | `openai_compatible`), `display_name`, `base_url`, `api_key_secret_name` (points to a Supabase secret), `default_model`, `is_active`, `is_default`, `usage_scope` (`whatsapp_ai` | `lead_scoring` | `fitness_plans` | `dashboard_insights` | `all`), `extra_config jsonb`.
- RLS: only `owner`/`admin` can insert/update/select.

**b) New shared edge module `supabase/functions/_shared/ai-dispatcher.ts`**:
- Exports `callAI({ scope, messages, tools?, response_format?, model?, branchId })`.
- Resolves the active provider for that scope:
  1. Look up `ai_provider_configs` matching scope + active + default.
  2. If `provider = lovable` → uses `LOVABLE_API_KEY` + `https://ai.gateway.lovable.dev/v1/chat/completions`.
  3. If `provider = openrouter` → `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <secret>` and `HTTP-Referer` header.
  4. If `provider = ollama` → user-supplied `base_url` (e.g. `https://ollama.yourvps.com/v1/chat/completions`), API key optional.
  5. If `provider = deepseek` → `https://api.deepseek.com/v1/chat/completions`.
  6. If `provider = openai_compatible` → arbitrary `base_url` + `api_key`.
- All providers use the OpenAI-compatible chat-completions schema, so the call shape stays identical.
- Built-in **automatic fallback to Lovable AI** if the configured provider returns 5xx / times out, with logging to a new `ai_call_logs` table (provider, scope, model, duration_ms, status, fallback_used).

**c) Refactor existing AI edge functions** to use the dispatcher:
- `score-leads`, `generate-fitness-plan`, `whatsapp-transactional-ai-agent`, `lead-nurture-followup`, `ai-dashboard-insights`, `whatsapp-webhook` (AI extraction).
- Zero behaviour change when no custom provider is configured (Lovable AI remains the default).

**d) New Settings UI `src/components/settings/AIProvidersSettings.tsx`** (added to `AIAgentControlCenter` as a new "Providers" tab):
- List existing provider configs in a Vuexy-style table.
- Right-side Sheet for "Add Provider" / "Edit Provider":
  - Provider type select (Lovable / OpenRouter / Ollama / DeepSeek / Custom OpenAI-compatible)
  - Display name, base URL (auto-filled per type), API key (stored as Supabase secret via `add_secret` flow), default model, scope, active toggle, default-for-scope toggle
- "Test connection" button that calls a new `test-ai-provider` edge function which makes a 1-token completion and returns latency.
- Clear copy explaining: *"Lovable AI is the default and requires no setup. Add OpenRouter for free/cheap models like Llama 3.1, or point to your own Ollama VPS for fully free self-hosted inference."*

**e) Per-scope routing**:
- A user can set OpenRouter (free Llama) for `lead_scoring` (high volume, low stakes) and keep Lovable AI / GPT-5 for `whatsapp_ai` (customer-facing).

---

## Files to Create / Modify

**Create**
- `supabase/migrations/[ts]_fitness_tracking_tables.sql`
- `supabase/migrations/[ts]_ai_providers.sql`
- `supabase/functions/_shared/ai-dispatcher.ts`
- `supabase/functions/test-ai-provider/index.ts`
- `src/components/hrm/SignedContractViewer.tsx`
- `src/components/settings/AIProvidersSettings.tsx`

**Modify**
- `src/services/storeService.ts` — surface RPC error details
- `src/pages/POS.tsx` — better error toasts
- `src/pages/HRM.tsx` — add "View Signed" action
- `src/pages/ContractSign.tsx` — full signed-doc confirmation
- `src/utils/pdfBlob.ts` — add `buildSignedContractPdf`
- `src/components/settings/AIAgentControlCenter.tsx` — add "Providers" tab
- `supabase/functions/{score-leads,generate-fitness-plan,whatsapp-transactional-ai-agent,lead-nurture-followup,ai-dashboard-insights}/index.ts` — switch to dispatcher
- DB migration to add detail messages in `create_pos_sale`

## Open Questions

1. **AI provider scope granularity**: The plan above lets you set a default provider *per use case* (lead_scoring, whatsapp_ai, etc.). Want that, or just one global default for all AI calls?
2. **Fallback behavior**: If your custom provider (e.g. Ollama VPS) is down, should we auto-fallback to Lovable AI silently, or fail loudly so you know?
3. **Signed contract PDF storage**: Should we auto-upload the signed PDF to the `documents` bucket and store its URL in `contracts.signed_pdf_url`, so it's archived for compliance? (Recommended.)
