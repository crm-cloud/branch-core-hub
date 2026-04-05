

# Clone "Incline Ascent" 3D Website into Current Project

## What We're Doing

Importing the immersive 3D scrolling website from the "Incline Ascent" project as the new default public landing page at `/`. The current `PublicWebsite.tsx` (1027-line CMS-driven page) will be renamed and kept as a backup at `/website-v1`, ready to swap back in 1-2 months.

## Files to Copy from Incline Ascent

1. **`src/components/3d/Scene3D.tsx`** — Three.js canvas with scroll controls
2. **`src/components/3d/HeroDumbbell.tsx`** — Animated 3D dumbbell with INCLINE branding
3. **`src/components/3d/FloatingWords.tsx`** — Orbiting text elements
4. **`src/components/3d/ParticleField.tsx`** — Particle system (not actively used in Scene3D but part of the set)
5. **`src/components/ui/ScrollOverlay.tsx`** — HTML content overlay (hero, sections, waitlist CTA, footer)
6. **`src/components/ui/ScrollProgressBar.tsx`** — Top progress indicator
7. **`src/components/ui/RegisterModal.tsx`** — Multi-step lead capture form (already wired to webhook-lead-capture)
8. **`src/hooks/useSoundEffects.ts`** — Scroll sound hook (placeholder sounds, no actual audio files needed)
9. **`src/assets/incline-logo.png`** — Logo image used by ScrollOverlay

## New Dependencies to Install

- `@react-three/fiber` (^8.18.0) — React renderer for Three.js
- `@react-three/drei` (^9.122.0) — Helpers for R3F (ScrollControls, Text, Environment)
- `three` (^0.160.1) — 3D engine
- `@types/three` (^0.160.0) — TypeScript types
- `howler` (^2.2.4) — Audio library (used by useSoundEffects)
- `@types/howler` (^2.2.12) — TypeScript types
- `react-hook-form` + `@hookform/resolvers` + `zod` — Already in current project

## Changes to Current Project

### 1. Rename current public website (backup)
- Rename `src/pages/PublicWebsite.tsx` → `src/pages/PublicWebsiteV1.tsx`
- Update the export/component name inside to `PublicWebsiteV1`

### 2. Create new landing page
- Create `src/pages/InclineAscent.tsx` — thin wrapper (same as Ascent's `Index.tsx`) that composes `Scene3D`, `ScrollProgressBar`, `RegisterModal`, and `useSoundEffects`

### 3. Update routing in `App.tsx`
- `"/"` → `<InclineAscent />` (new 3D site)
- Add `/website-v1` → `<PublicWebsiteV1 />` (backup, accessible if needed)

### 4. Add `glass-strong` CSS class
- The ScrollOverlay uses `glass-strong` which exists in Ascent's CSS but not in current project. Add it to `src/index.css`.

### 5. Adapt RegisterModal webhook URL
- The modal currently hardcodes a webhook slug from the Ascent project. Update it to use the current project's Supabase URL and the correct webhook slug, or better, make it call `capture-lead` edge function directly (already exists in this project).

## What Stays Intact
- All admin/member/trainer routes unchanged
- CMS service and WebsiteSettings unchanged
- The V1 website remains fully functional at `/website-v1`
- No database changes needed

