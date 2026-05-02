## Issues to fix

1. **Logo crops to a square thumbnail.** Wide/rectangular logos (like the INCLINE wordmark) get clipped because the preview uses `h-24 w-24 object-cover`.
2. **Per-branch logos cause "uuid" / 'all' error.** When a specific branch is selected and you upload, the code still upserts the global row (`branch_id: null`), or — if we naively pass `selectedBranch` — the literal string `"all"` is sent into a `uuid` column and Postgres rejects it.
3. **No branch-aware logo concept.** Today there is one global logo. We want: an optional override per branch, with **fallback to the organization (global) logo** when a branch hasn't uploaded its own.
4. **Naming.** "Gym Logo" should become **"Brand Logo"** (clearer for multi-branch SaaS context).

The DB schema already supports this cleanly — `organization_settings` has `branch_id` with a unique constraint, so one global row (`branch_id IS NULL`) plus one row per branch is the natural model. No migration needed.

## UX (Organization Settings → Brand Logo card)

Rename card title to **"Brand Logo"**, description: *"Upload your brand logo. Recommended: SVG, transparent background, max 5MB."*

Behavior depends on the branch selector at the top of the app:

- **All Branches selected** (or user only has access to one) → editing the **Organization (default) logo**. Helper text: *"This logo is used everywhere unless a branch overrides it."*
- **A specific branch selected** → editing **that branch's logo override**. Show:
  - A small badge: *"Editing logo for: {Branch Name}"*
  - Current preview shows the branch's own logo if set, otherwise the org logo (greyed with an "Inherited from organization" chip).
  - A **"Remove override"** button (instead of plain "Remove") which clears only the branch's `logo_url` and falls back to the org logo.
  - A **"Use organization logo"** quick action when no branch override exists yet (no-op visual hint).

## Visual fixes (cropping)

Replace the square cropping preview with a responsive logo plate:

- Container: `h-20 w-40 rounded-xl border bg-muted/40 p-2 flex items-center justify-center` (wider, fits wordmarks).
- Image: `max-h-full max-w-full object-contain` (NEVER `object-cover` for logos).
- Show a subtle checkered/grid background (`bg-[radial-gradient(...)]` or just `bg-muted/40`) so transparent SVGs are visible.
- Drag/drop zone keeps its current style; sits to the right of the preview on `md+`, stacks on mobile.

## Data layer

Single query keyed by branch:

```ts
const { selectedBranch } = useBranchContext(); // 'all' | uuid
const branchScope = selectedBranch !== 'all' ? selectedBranch : null;

useQuery(['organization-settings', branchScope ?? 'global'], async () => {
  const q = supabase.from('organization_settings').select('*');
  const { data } = branchScope
    ? await q.eq('branch_id', branchScope).maybeSingle()
    : await q.is('branch_id', null).maybeSingle();
  return data;
});
```

Also fetch the global row separately (only when `branchScope` is set) to drive the "Inherited from organization" preview fallback.

Upload mutation:

1. Compute `branchScope` (uuid or `null`). **Never** pass the string `'all'`.
2. Storage path is namespaced so branches don't collide:
   - Global: `org/logo-{ts}.{ext}`
   - Branch: `branches/{branchId}/logo-{ts}.{ext}`
3. Upsert into `organization_settings`:
   - If a row already exists for that scope → `update({ logo_url }).eq('id', existing.id)`.
   - Else → `insert({ branch_id: branchScope, logo_url, ...defaults })`. The unique constraint on `branch_id` keeps this one-row-per-scope.
4. After success: invalidate both `['organization-settings', branchScope ?? 'global']` and `['brand-context', branchScope ?? 'global']` so headers/PDFs pick up the new logo.

Remove logo:

- Global scope → `update({ logo_url: null })` on the global row.
- Branch scope → `update({ logo_url: null })` on the branch row (label this **"Remove override"**). The branch will then visually inherit the org logo.

Save mutation for the other fields (name/timezone/etc.) keeps writing to the **global** row only — those remain organization-wide. The form panel below the logo gets a small note: *"Organization-wide settings (apply to all branches)."* and is disabled when a branch is selected, with a hint "Switch to All Branches to edit organization details."

## Brand context wiring

Update `src/lib/brand/useBrandContext.ts` so PDFs/headers reflect the per-branch logo:

- When `branchId` is provided, also fetch `organization_settings` for that branch (`logo_url` only).
- Fall back to the global row's `logo_url` when the branch row has none.
- Expose the resolved `logoUrl` in `BrandContext` (already a field) — no API change needed at call sites.

`AppHeader` already reads org settings for its left-side brand; update its query to use the branch-aware resolver (org logo when no branch selected, branch logo when a specific branch is selected). Out of scope for this round if it adds risk — note as a follow-up but keep using the global logo there for now.

## Files to change

- `src/components/settings/OrganizationSettings.tsx` — rename card, branch-aware queries/mutations, fixed preview (no crop), branch override UX, disable org-wide form fields when a branch is selected.
- `src/lib/brand/useBrandContext.ts` — branch-aware `logoUrl` resolution with fallback to global.

## Out of scope

- No DB migration (schema already supports it).
- No changes to `AppHeader` logo source in this round — flagged as a follow-up.
- No bulk "copy logo to all branches" tool.
