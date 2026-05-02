## Problem

In Hybrid mode today we render three stacked rows on desktop:

```
[ sidebar header (MODULE · X) ] [ TopModulesBar          ]
[ child sidebar items          ] [ AppHeader (search…)   ]
[                              ] [ page content          ]
```

The reference (Materialize) uses a single horizontal band where the brand sits above the sidebar column, and the top-modules row + utilities row both start to the right of the brand:

```
[ BRAND  ] [ Dashboard  Members  Sales …  Finance        ]
[ MODULE ] [ search ………………………………  branch  theme  bell  👤 ]
[ items  ] [ page content                                ]
```

## Goal

Tighten Hybrid mode so it visually matches Materialize: brand above sidebar, modules + utilities aligned with brand row, sidebar shows only the active module's children with no duplicate "MODULE" chip competing with the top bar. Vertical and Collapsed modes are not changed.

## What ships

### 1. Hybrid layout restructure — `AppLayout.tsx`

Switch from "row of [sidebar | column-of-(topbar, header, content)]" to a **two-row grid** when `navMode === 'hybrid'` on `lg+`:

- Row 1 (header band, `h-14`): two cells
  - Left cell `w-64` → brand logo (re-uses `BrandLogo`)
  - Right cell `flex-1` → `TopModulesBar` (modules pills only, no border-bottom of its own)
- Row 2 (utility band, `h-14`): two cells
  - Left cell `w-64` → small "MODULE · {label}" chip (subtle, not the heavy header we have now)
  - Right cell `flex-1` → existing `AppHeader` content (search, branch, theme, nav-mode, bell, profile)
- Row 3: `flex-1` content row
  - Left cell `w-64` → child-only sidebar nav (no header, no logo, no chip)
  - Right cell `flex-1 overflow-auto` → page content

Vertical / Collapsed: unchanged (today's render path).

### 2. `AppHeader.tsx`

- Add prop `variant?: 'standalone' | 'hybrid'` (default `standalone`).
- In `hybrid` variant: drop the left padding/branch-name strip on the left so it sits flush against the modules grid line; keep all utility buttons identical.

### 3. `AppSidebar.tsx`

- New prop `headerless?: boolean`. When true (passed only in hybrid mode), the sidebar renders **without** the top header block (no logo, no MODULE chip, no collapse button) — it becomes a pure scrollable list flush under the utility band.
- Remove the duplicated MODULE chip from inside the sidebar in hybrid mode (now lives in the layout grid).

### 4. `TopModulesBar.tsx`

- Remove its own `border-b` and background (the layout band owns the border + bg now).
- Keep horizontal scroll for overflow.
- Active pill: keep the soft primary glow, add a subtle bottom indicator bar (`after:` 2px line) for parity with Materialize.

### 5. Small visual polish

- Header band background: `bg-card` with `border-b border-border`.
- Utility band background: `bg-card/60 backdrop-blur` with `border-b border-border`.
- Brand cell on row 1 gets `border-r border-border` so the column edge reads cleanly.

## Files

Edited:
- `src/components/layout/AppLayout.tsx` — new hybrid grid render branch
- `src/components/layout/AppSidebar.tsx` — `headerless` prop
- `src/components/layout/AppHeader.tsx` — `variant` prop
- `src/components/layout/TopModulesBar.tsx` — strip own chrome, add active indicator

No new files. No changes to menu config, RBAC, routes, mobile nav, or NavModeMenu.

## Non-goals / safety

- Mobile (`<lg`) untouched — still uses MobileNav sheet.
- Vertical and Collapsed modes render exactly as today.
- No changes to `getMenuForRole`, `navModules.ts`, or any business logic.
