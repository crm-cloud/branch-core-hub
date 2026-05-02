## Goal

Add a fourth desktop navigation layout that keeps the existing **AppHeader** intact (logo, search, branch selector, theme/appearance, notifications, avatar) and renders a **dedicated horizontal menu band directly below it** — no sidebar.

This is in addition to the three existing modes (Vertical / Collapsed / Horizontal-only). Vertical, Collapsed, and the current top-bar-only Horizontal mode stay exactly as they are. Mobile navigation is untouched.

## What changes (visual)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ AppHeader: logo · search · branch · theme · appearance · bell · avatar│  ← existing header, untouched
├──────────────────────────────────────────────────────────────────────┤
│  Dashboard   Members ▾   Sales ▾   Finance ▾   Operations ▾   …      │  ← NEW horizontal band
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                       Page content (full width)                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- Active module gets a subtle pill + a 2px primary underline (Vuexy-style).
- Modules with children open a clean dropdown of their child links (same as today's TopModulesBar).
- The band is `sticky` just under the header so it stays visible while scrolling.
- Horizontal scroll on overflow (already supported by `TopModulesBar` via `ScrollArea`).

## Mode catalog (after change)

| Mode id | Label in menu | Layout |
|---|---|---|
| `vertical` | Vertical sidebar | Sidebar + header (current) |
| `collapsed` | Collapsed sidebar | Icon-only sidebar + header (current) |
| `hybrid` | Horizontal (compact) | Single-band: brand + modules + header utilities (current) |
| `horizontal-stacked` | Header + Horizontal menu | **NEW** — full AppHeader on top, horizontal modules band below, no sidebar |

Default behavior and persistence stay identical (localStorage key `incline.nav-mode`).

## Files to change

**`src/lib/navPreferences.ts`**
- Extend `NavMode` union to include `'horizontal-stacked'`.
- Update `isValid()` to accept the new value.

**`src/components/layout/NavModeMenu.tsx`**
- Add a 4th option: **Header + Horizontal** with a `PanelTop` / `Rows3` icon and the description "Header on top, horizontal menu below".

**`src/components/layout/AppLayout.tsx`**
- Add a new branch: `if (navMode === 'horizontal-stacked') { … }`.
- Renders, in order:
  1. Mobile header (same block already used today — unchanged).
  2. `<AppHeader />` in its **default** variant (logo, search, branch, all utilities — unchanged).
  3. A `sticky top-[<header height>] z-30` band wrapping `<TopModulesBar groups=… activeModuleId=… onSelect=… />` (non-`bare` so it owns its own subtle border/background).
  4. `renderContent()` full width (no sidebar).
- `SessionTimeoutWarning` stays mounted as in other branches.
- Existing `vertical` / `collapsed` / `hybrid` branches are untouched.

**`src/components/layout/TopModulesBar.tsx`**
- No structural change needed. Confirm that `bare={false}` (default) renders the band with `border-b` + `bg-card/80 backdrop-blur` so it visually sits as a clean second layer under the header.
- Optional polish: tighten vertical padding to `py-1.5` so the second band doesn't feel heavy.

## Things explicitly preserved

- Role-based menu filtering — already handled in `AppLayout` via `getMenuForRole(roles)` and per-item `roles` filter; new mode reuses the same `moduleGroups` memo.
- Branch context, `SessionTimeoutWarning`, mobile header, and all existing routes.
- The current `hybrid` mode (single-band horizontal) remains available for users who prefer maximum vertical space.
- `AppHeader` default variant is reused as-is — no new variant needed for this mode.

## Acceptance checks

- Switching to **Header + Horizontal** from the layout menu hides the sidebar, keeps the full AppHeader, and shows the modules band directly under it.
- Clicking a parent module navigates to its first child and highlights the module; child dropdowns work.
- Choice persists across reloads (localStorage), and old values (`vertical` / `collapsed` / `hybrid`) keep working.
- Mobile (<lg) layout is visually identical to today in all four modes.
- No regressions to RBAC: items the user can't see in vertical mode also don't appear in the horizontal band.
