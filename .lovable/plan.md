# Plan: True Horizontal Hybrid + Equipment Consolidation

## Part 1 — Hybrid navigation = horizontal only (no sidebar)

**Current problem:** In `hybrid` mode we render BOTH the top modules bar AND a left sidebar (with the active module's child items). Reference (Materialize) shows children as **dropdowns from the top bar** with no left rail.

**New behavior — three clean modes:**

| Mode | Left sidebar | Top bar | Children open from |
|------|--------------|---------|--------------------|
| `vertical` | Full (label + icons) | — | Sidebar |
| `collapsed` | Icon-only rail | — | Sidebar (tooltip/flyout) |
| `hybrid` (horizontal) | **None** (desktop) | Top modules bar | **Dropdown menu from each top module** |

Mobile is unchanged in all modes (uses the existing `MobileNav` sheet).

### Files to change

1. **`src/components/layout/TopModulesBar.tsx`** — convert each module button into a `DropdownMenu` (shadcn) trigger. Menu content lists that module's child `MenuItem`s as `DropdownMenuItem` rows (icon + label, `Link` to `item.href`, active highlight). Clicking the trigger itself still navigates to the first child (current behavior preserved). Keep horizontal scroll for overflow.

2. **`src/components/layout/AppLayout.tsx`** — in the `navMode === 'hybrid'` branch:
   - Remove the left brand cell, the "MODULE · {label}" cell, and the `<AppSidebar …>` render.
   - Render a single full-width top band: brand on the left, `TopModulesBar` in the middle (flex-1), `AppHeader variant="hybrid"` utilities on the right. Sticky.
   - Main content becomes full-width below the band.
   - Mobile branch stays as it is (uses `MobileNav` from `AppSidebar`).

3. **`src/components/layout/AppSidebar.tsx`** — drop the now-unused `mode="hybrid"` rendering path and the `hybridItems` / `hybridModuleLabel` / `headerless` / `embedded` props (or leave as no-ops). `MobileNav` export stays untouched so mobile keeps working.

4. **`src/lib/navPreferences.ts`** — no schema change. The three `NavMode` values already match (`vertical`, `collapsed`, `hybrid`); the `NavModeMenu` UI labels can read "Horizontal" for `hybrid` for clarity.

5. **`src/components/layout/NavModeMenu.tsx`** — relabel `hybrid` option as **"Horizontal"** with a horizontal-bars icon, keep `vertical` and `collapsed` as-is, so the picker reads exactly: Vertical / Collapsed / Horizontal.

### Preserved guarantees
- RBAC unchanged (`groupMenuIntoModules` still filters by role).
- All existing routes/menu items still reachable (now via top-bar dropdowns).
- Per-user persistence in `localStorage` (`incline.nav-mode`) unchanged.
- Mobile navigation untouched.

---

## Part 2 — Merge Equipment + Equipment Maintenance into one page

**Findings**
- `/equipment-maintenance` → `EquipmentMaintenance.tsx` is the **richer** page (KPIs, maintenance tabs, QR, status change, maintenance log, costs).
- `/equipment` → `Equipment.tsx` is a **simpler duplicate**, and the route **isn't even registered in `App.tsx`** — the menu link is broken.
- Both menus (admin + manager) currently list both items, which is what the user is seeing twice.

### Changes

1. **Delete `src/pages/Equipment.tsx`** (duplicate, orphan route).
2. **`src/config/menu.ts`** — remove the **"Equipment Maintenance"** rows in `adminMenuConfig` and `managerMenuConfig`; keep only one entry **labeled "Equipment"** pointing to `/equipment-maintenance`. Staff menu already has only one "Equipment" entry — no change.
3. **`src/config/navModules.ts`** — drop `/equipment` from the `operations` module hrefs (keep `/equipment-maintenance`).
4. **`src/App.tsx`** — remove the unused `Equipment` lazy import (no route to remove since `/equipment` was never registered).
5. **`src/pages/EquipmentMaintenance.tsx`** — rename the page heading from "Equipment & Maintenance" to **"Equipment"** (maintenance remains a tab inside).

### Add search bar (Equipment page)

In `EquipmentMaintenance.tsx`, above the equipment table (inside the "Equipment" tab):

- A shadcn `Input` with a `Search` icon, placeholder **"Search by name, brand, model, serial, category, or location…"**.
- Local `useState` for `searchQuery`; filter `equipment` client-side (case-insensitive `includes` across `name`, `brand`, `model`, `serial_number`, `category`, `location`).
- Show a "No results" empty state when the filter yields zero rows.
- Debouncing not needed (client-side, small list).

---

## Out of scope / unchanged
- No DB / RLS / edge-function changes.
- No changes to routing for any other page.
- Vertical and Collapsed modes look exactly as they do today.

```text
HYBRID (new)                    VERTICAL / COLLAPSED (unchanged)
┌──────────────────────────┐    ┌──────┬─────────────────────┐
│ Brand  Top modules  Hdr │    │ Side │  Header             │
├──────────────────────────┤    │ bar  ├─────────────────────┤
│         Content          │    │      │  Content            │
└──────────────────────────┘    └──────┴─────────────────────┘
        (no sidebar)
```
