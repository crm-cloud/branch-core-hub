

# Settings Sync, Webhook Security, and AI Planning Fixes

## Scope

Five modules to fix/implement. Prioritized by impact.

---

## 1. Branch-Specific Benefits Sync

**Problem**: `BenefitSettingsComponent`, `BenefitTypesManager`, and `FacilitiesManager` all hardcode `branches?.[0]?.id` instead of using the global branch selector.

**Fix**: Import `useBranchContext()` in all three components. Use `effectiveBranchId` (falls back to first branch for owners viewing "all"). Replace the local `useQuery(["branches"])` calls.

| File | Change |
|------|--------|
| `src/components/settings/BenefitSettingsComponent.tsx` | Replace `branches?.[0]?.id` with `useBranchContext().effectiveBranchId` |
| `src/components/settings/BenefitTypesManager.tsx` | Same — remove local branches query, use context |
| `src/components/settings/FacilitiesManager.tsx` | Same |

---

## 2. AI Fitness: Global Templates vs Member-Specific

**Problem**: The Generate tab requires a member name. Plans should be creatable as global master templates first, then assigned/personalized for a specific member.

**Fix**:
- Remove the member name requirement from the Generate form. Make all member fields optional (they become "hints" not requirements).
- Rename "name" field to "Plan Name" (text input for the template name, e.g. "Push Pull Legs").
- Generated plans save to `fitness_plan_templates` as global templates (no member attached).
- The existing "Assign to Member" flow in the Templates tab already works — enhance it to optionally re-generate with member-specific body data via the AI edge function.
- Add a "Personalize for Member" button on the Assign drawer that calls the AI with the base plan + member measurements.

| File | Change |
|------|--------|
| `src/pages/AIFitness.tsx` | Make member info optional, rename "Member Name" to "Plan Name", auto-save as template |
| `src/components/fitness/AssignPlanDrawer.tsx` | Add "Personalize" toggle that fetches member body data and re-generates |
| `supabase/functions/generate-fitness-plan/index.ts` | Accept optional `basePlan` param for personalization mode |

---

## 3. Webhook Lead Capture — Slug-Based Auth

**Problem**: External integrations must set `x-webhook-secret` header manually — friction for Zapier/Meta.

**Fix**:
- Add an `organization_settings` lookup: store a `webhook_slug` (UUID) per org, auto-generated on first use.
- The edge function accepts `?slug=UUID` as query param. Validates slug against DB instead of header secret.
- Keep header auth as fallback for backward compatibility.
- Update Integration Settings UI to show the slug-based URL.

| File | Change |
|------|--------|
| `supabase/functions/webhook-lead-capture/index.ts` | Add slug query param validation path |
| `src/components/settings/IntegrationSettings.tsx` | Show simplified slug URL, add "Regenerate Slug" button |
| DB migration | Add `webhook_slug` column to `organization_settings` with default `gen_random_uuid()` |

---

## 4. Notification & Security Settings — Activate Logic

**Notification Settings**: Already functional — `fetchPreferences` and `upsertPreferences` work, the save mutation is wired. The toggles control `notification_preferences` table. These ARE working, not placeholders.

**Security Settings**: Currently pure placeholder. Implement:
- **Password Policy display**: Show current policy (min length, special chars). This is an informational card — actual enforcement happens in the auth signup form validation.
- **Active Sessions viewer**: Query the user's own sessions via `supabase.auth.getSession()` and display device/time info.
- **Session Timeout**: Save timeout preference to `organization_settings` and implement a client-side inactivity timer in `AuthContext`.

| File | Change |
|------|--------|
| `src/components/settings/SecuritySettings.tsx` | Add state, load/save org settings, implement session timeout toggle with actual persistence, add password policy display card |
| `src/contexts/AuthContext.tsx` | Add inactivity timer that reads timeout setting |

---

## 5. Database Export (System Dump)

**Limitation**: Edge functions cannot run `pg_dump`. The database is managed by Lovable Cloud — backups are handled automatically.

**What we CAN do**: Build a JSON export tool that exports all table data as a downloadable JSON file via an edge function. This serves as a portable data backup.

| File | Change |
|------|--------|
| `supabase/functions/export-data/index.ts` | New edge function — authenticated, owner-only. Queries all public tables and returns JSON |
| `src/components/settings/SecuritySettings.tsx` | Add "Export Data" button that calls the function and downloads result |

---

## Execution Order

1. Branch-to-Benefits sync (3 files, quick fix)
2. AI Fitness global templates refactor
3. Webhook slug-based auth
4. Security settings activation
5. Data export tool

