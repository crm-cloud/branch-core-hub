## Goal

Introduce a Vuexy-style "Navigation Mode" with three options — **Vertical** (current default), **Collapsed** (current icon-only mode), and **Hybrid** (new: top horizontal modules + left sidebar showing only child items of the active module). Existing menu config, role permissions, and routes stay 100% untouched. Mobile nav stays exactly as-is.

## What ships

### 1. Navigation mode setting

- New file `src/lib/navPreferences.ts`
  - `type NavMode = 'vertical' | 'collapsed' | 'hybrid'`
  - `getNavMode()` / `setNavMode(mode)` — reads/writes `localStorage` key `incline.nav-mode` (per-browser, per-user since auth is single-session).
  - Falls back to `'vertical'`. Safe try/catch.
- Backwards compat: existing `sidebar-collapsed` localStorage key is migrated once → if `true`, seed `nav-mode = 'collapsed'`.

### 2. Module derivation (no menu rewrite)

- New file `src/config/navModules.ts`
  - Hard-coded ordered list of "top modules" with label + icon + matching section titles in the existing `menuConfig`:
    ```
    Dashboard   → ['Main']
    Members     → ['Members & Leads', 'My Account']
    Sales       → ['E-Commerce & Sales']
    Finance     → ['Finance']
    Operations  → ['Operations & Comm', 'Core']
    PT/Trainers → ['Training & Bookings', 'Training', 'Earnings']
    Benefits    → items whose href starts with `/benefit` / `/book-benefit` / `/my-benefits`
    HRM         → ['Admin & HR', 'Work']
    Marketing   → ['Communication']  (chats, announcements, campaigns)
    Reports     → items whose href is `/analytics`, `/reports`, `/audit-logs`, `/system-health`
    Settings    → items whose href is `/settings`, `/admin-roles`, `/devices`
    ```
  - Helper `groupMenuIntoModules(sections)` returns `Array<{ module, items }>`, dropping modules with zero visible items so RBAC continues to gate everything.
  - A module is considered "active" if `location.pathname` matches any of its child items' `href` (longest-prefix wins). Falls back to first non-empty module.

### 3. New components

- `src/components/layout/NavModeMenu.tsx`
  - Small dropdown (icon-only button in `AppHeader`) listing the 3 modes with check marks. Calls `setNavMode` and dispatches a `storage`-like event so `AppLayout` re-reads.
- `src/components/layout/TopModulesBar.tsx`
  - Horizontal pill bar rendered only when `navMode === 'hybrid'` and viewport ≥ `lg`.
  - Shows brand logo on the left, module pills in the middle (icon + label), header utilities (search, notifications, profile) reused via existing `AppHeader` placement.
  - Active pill: `bg-indigo-50 text-indigo-700 rounded-xl shadow-sm` (Vuexy-flavoured, matches project tokens).
  - Clicking a pill navigates to the module's first child route AND sets that module as active for the sidebar.

### 4. AppLayout / AppSidebar wiring

- `AppLayout.tsx`
  - Replace `collapsed` boolean state with `navMode` state.
  - Subscribe to `storage` events to keep multiple tabs in sync.
  - Render order:
    - `navMode === 'hybrid'`: render `TopModulesBar` above the content row; pass the active module to `AppSidebar`.
    - Else: render today's layout unchanged.
- `AppSidebar.tsx`
  - Accept new optional props: `mode: NavMode`, `activeModuleId?: string`.
  - When `mode === 'hybrid'`: filter `menuSections` down to only the items belonging to the active module (no section headers, single flat list). Hide collapse toggle. Width stays `w-64`. Logo hidden in hybrid (it's already in TopModulesBar) — header area becomes the active module title.
  - When `mode === 'collapsed'`: behave exactly as today's collapsed.
  - When `mode === 'vertical'`: behave exactly as today's expanded.
- `MobileNav` is **not modified** — mobile keeps the full grouped sidebar via the existing Sheet.

### 5. Header touch-up

- `AppHeader.tsx`: insert `<NavModeMenu />` next to the theme toggle. No other changes.

## Visual / UX polish (Vuexy 2026)

- Top bar: `h-14 bg-white/80 backdrop-blur border-b border-slate-200/70 shadow-sm`, pills `rounded-xl px-3 py-1.5 text-sm font-medium`, active pill carries soft indigo glow `shadow-[0_6px_20px_-10px_hsl(var(--primary)/0.55)]`.
- Sidebar in hybrid mode: subtitle chip at top showing "MODULE · {name}" in `text-[10px] uppercase tracking-widest text-slate-500`.
- Smooth `transition-all duration-200` when switching modes.
- Honors existing dark theme tokens (`sidebar-*`, `primary`).

## Safety / non-regression

- Zero changes to `src/config/menu.ts`, role checks, routes, or `getMenuForRole`.
- All filtering still runs through the existing role-based `menuSections` pipeline before module grouping → RBAC preserved.
- If module grouping yields zero items for the user (e.g. a Trainer with no Sales module), that pill is simply not rendered.
- Mobile (`<lg`) always uses the existing `MobileNav` Sheet regardless of `navMode`.
- Auth pages, member portal pages, and any page not wrapped in `AppLayout` are untouched.

## Files

Created:
- `src/lib/navPreferences.ts`
- `src/config/navModules.ts`
- `src/components/layout/TopModulesBar.tsx`
- `src/components/layout/NavModeMenu.tsx`

Edited:
- `src/components/layout/AppLayout.tsx` (state → navMode, conditional render)
- `src/components/layout/AppSidebar.tsx` (accept `mode` + `activeModuleId`, hybrid render branch)
- `src/components/layout/AppHeader.tsx` (mount `NavModeMenu`)

No DB, no edge functions, no route changes, no menu config changes.
