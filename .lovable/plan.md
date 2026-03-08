

# Plan: PT Analytics, Dashboard Theme Fix & Global Theme Audit

## Issue 1: Analytics Missing PT Data

The Analytics page has no PT-related widgets. Need to add:
- **PT Revenue card** — total revenue from `member_pt_packages` (`price_paid`)
- **Top Performer Trainer** — trainer with highest PT sales (revenue + client count)
- **PT Packages Sold** — count of active packages

Add a new React Query fetching PT stats and render a dedicated row with a hero-style top trainer card + PT revenue/packages stat cards.

## Issue 2: Dashboard Hero Uses Hardcoded Slate Colors

`Dashboard.tsx` line 267 uses `text-slate-800` and line 277 uses `from-slate-800 to-slate-900`. These bypass the theme system entirely, so switching to Rose/Ocean/Amber changes nothing on the dashboard hero.

**Fix:** Replace with theme tokens:
- `text-slate-800` → `text-foreground`
- `from-slate-800 to-slate-900` → `from-primary to-primary/80` (matches Analytics page pattern)

## Issue 3: Global Theme Audit — Hardcoded Colors Breaking Non-Emerald Themes

**Root cause:** 275 instances across 13 files use hardcoded Tailwind colors (`shadow-indigo-*`, `text-slate-*`, `bg-slate-*`, `from-violet-600 to-indigo-600`) instead of CSS variable tokens. These look fine on the default Indigo theme but clash with Rose, Amber, Ocean, and Slate themes.

Additionally, the `.glass` CSS class exists but is barely used. Cards should adopt a modern glass-morphism aesthetic (backdrop blur + subtle transparency) for a 2026 feel.

### Files requiring hardcoded color replacement:

| File | Hardcoded instances | Fix |
|------|-------------------|-----|
| `src/components/ui/stat-card.tsx` | `shadow-indigo-100`, `text-slate-800` | → `shadow-primary/10`, `text-foreground` |
| `src/components/dashboard/DashboardCharts.tsx` | `shadow-indigo-500/20` (5x) | → `shadow-primary/10` |
| `src/pages/Dashboard.tsx` | `text-slate-800`, `from-slate-800 to-slate-900` | → `text-foreground`, `from-primary to-primary/80` |
| `src/pages/Analytics.tsx` | Already uses `shadow-primary/5` — OK ✓ | Minor: hero card OK |
| `src/pages/Store.tsx` | `text-slate-800` (3x), `shadow-indigo-100` (8x), `text-slate-700` | → theme tokens |
| `src/pages/Leads.tsx` | `from-violet-600 to-indigo-600`, `shadow-indigo-500/20`, `shadow-slate-200/50` | → `from-primary to-primary/80`, `shadow-primary/10` |
| `src/pages/Announcements.tsx` | `from-violet-600 to-indigo-600`, `shadow-indigo-500/20` | → theme tokens |
| `src/pages/AllBookings.tsx` | `from-violet-600 to-indigo-600` | → `from-primary to-primary/80` |
| `src/pages/DiscountCoupons.tsx` | `shadow-indigo-100/50` (3x) | → `shadow-primary/5` |
| `src/pages/Members.tsx` | Likely hardcoded | → audit + fix |
| `src/pages/Finance.tsx` | Likely hardcoded | → audit + fix |
| `src/pages/HRM.tsx` | Likely hardcoded | → audit + fix |

### Glass-morphism upgrade

Update the `.glass` class and card base to support a modern frosted-glass effect:
```css
.glass {
  @apply bg-card/70 backdrop-blur-xl border border-white/20 shadow-lg;
}
```

Update `Card` component default to include subtle glass when used with a new `glass` variant, and ensure all major dashboard/analytics cards use `shadow-primary/10` for theme-aware depth.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Analytics.tsx` | Add PT revenue query, top performer widget, PT stats cards |
| `src/pages/Dashboard.tsx` | Replace hardcoded slate colors with theme tokens |
| `src/components/ui/stat-card.tsx` | Replace `shadow-indigo-100` → `shadow-primary/10`, `text-slate-800` → `text-foreground` |
| `src/components/dashboard/DashboardCharts.tsx` | Replace all `shadow-indigo-500/20` → `shadow-primary/10` |
| `src/pages/Store.tsx` | Replace all `text-slate-*`, `shadow-indigo-*` with theme tokens |
| `src/pages/Leads.tsx` | Replace hardcoded gradient + shadow colors |
| `src/pages/Announcements.tsx` | Replace hardcoded gradient + shadow colors |
| `src/pages/AllBookings.tsx` | Replace hardcoded gradient |
| `src/pages/DiscountCoupons.tsx` | Replace `shadow-indigo-100/50` |
| `src/index.css` | Enhance `.glass` class for modern frosted-glass look |
| Remaining pages with hardcoded colors | Audit and fix (Members, Finance, HRM, etc.) |

