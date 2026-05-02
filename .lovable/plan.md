## Goal

In **Horizontal Menu** mode, the Settings page currently shows a left vertical sub-nav (AI Agent / Appearance / Backup / …) which looks awkward under the top horizontal bar. Convert it to a **horizontal pill-bar that sits directly under the main menu**, matching the top-bar style. In Vertical / Collapsed / Hybrid modes, keep today's left sidebar layout (it's the right pattern there).

## Behavior

- Detect current nav mode using the existing `getNavMode()` + `subscribeNavMode()` from `src/lib/navPreferences.ts` (same pattern as `AppLayout.tsx`).
- If `navMode === 'horizontal-stacked'` (desktop, `lg+`):
  - Render the settings menu as a **single horizontal scrollable bar** spanning full content width, placed at the top of the Settings page (right under the global `TopModulesBar`).
  - Bar styling matches `TopModulesBar` for consistency: `bg-card/80 backdrop-blur`, sticky-ish container, `rounded-xl` pill items, active item uses `bg-primary/10 text-primary` with a 2px primary underline; inactive uses `text-muted-foreground hover:bg-accent`.
  - Horizontal scroll via shadcn `ScrollArea` with hidden scrollbar (same as `TopModulesBar`).
  - Content area below uses full width (no left sidebar reservation).
- Otherwise (vertical / collapsed / hybrid / mobile): keep today's left sidebar layout untouched.
- Mobile (always): keep the current top horizontal scroll strip already coded in the responsive branch.

## Implementation

Edit only **`src/pages/Settings.tsx`**:

1. Add `useEffect` + `useState` to track `navMode` via `getNavMode` / `subscribeNavMode`.
2. Compute `const isHorizontalStacked = navMode === 'horizontal-stacked'`.
3. Extract the menu rendering into a small inline `SettingsNav` block with two visual variants:
   - **Horizontal variant** (used on `lg` when `isHorizontalStacked`): wraps items in `ScrollArea` → `nav` flex row, `gap-1`, centered (`justify-center`) to match `TopModulesBar`. Each button: `inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium`, active → `bg-primary/10 text-primary` + bottom underline span.
   - **Vertical variant** (default): existing left-rail markup, unchanged.
4. Layout switch:
   - When `isHorizontalStacked`: render `<div className="space-y-6"><SettingsNav variant="horizontal" /><div>{content}</div></div>` — no flex row, content takes full width. Hide horizontal bar on `<lg` and fall back to the existing mobile top-strip (or just always show horizontal variant since it scrolls — simpler; keep one bar that scrolls on mobile too).
   - Else: existing `flex flex-col md:flex-row` with left sidebar.
5. Header (Settings icon + title + subtitle) stays as-is at the top of the page in both modes.

## Visual reference (horizontal variant)

```text
┌─ AppHeader ───────────────────────────────────────────────┐
├─ TopModulesBar: Dashboard | Members | Sales | … | HRM     ┤
├─ Settings sub-bar (NEW):                                  ┤
│  [⚙ Organization] [🏢 Branches] [🎨 Appearance] [🔔 …]    │
├───────────────────────────────────────────────────────────┤
│  Settings header                                          │
│  Active panel content (full width)                        │
└───────────────────────────────────────────────────────────┘
```

## Out of scope

- No changes to `AppLayout`, `AppHeader`, `TopModulesBar`, or any settings panel component.
- No new dependencies (the requested `dock-two` / framer-motion dock is not used — it doesn't match the Vuexy pill-bar aesthetic already used by `TopModulesBar`, and adding framer-motion just for this would be inconsistent).
- No URL/query-param changes; `?tab=` continues to drive selection.
