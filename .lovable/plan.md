## Goal

Adopt the proven pattern from the reference site: keep the dumbbell as a real 3D object, but render every "floating word" as a normal HTML element. Switch the public site's typography to **Oswald** loaded straight from Google Fonts. This eliminates the GPOS/GSUB warnings, removes the woff/woff2 failure path, and meaningfully shrinks the 3D bundle.

The hero "feel" stays the same (dumbbell rotates, words float behind/around it, parallax on scroll). Only the rendering technique changes.

## What changes

### 1. Typography — Oswald via Google Fonts
- In `index.html`: remove the `<link rel="preload" ... inter-regular.woff>` and add Google Fonts links for **Oswald** (weights 400/500/600/700, `display=swap`) plus `preconnect` to `fonts.gstatic.com`. Same recipe the reference site uses.
- In `src/index.css` / Tailwind config: set Oswald as the display/heading font on the public landing only. Keep Inter as the app-wide UI font everywhere else (admin, member portal, dashboards) so we don't disturb the whole product.
- Delete `public/fonts/inter-regular.woff` (no longer needed).

### 2. FloatingWords — move from `<Text>` (WebGL) to DOM
- Rewrite `src/components/3d/FloatingWords.tsx` as a plain React component that renders absolutely-positioned `<span>`s in the HTML overlay above the canvas (not inside `<Canvas>`).
- Each word gets a CSS animation (slow float on Y, slight horizontal drift) and an opacity that scales with `scrollProgress` (same curve as today). Use `transform: translate3d` + `will-change: transform` for GPU compositing — zero main-thread work per frame.
- Words: `RISE`, `REFLECT`, `REPEAT`, `RECOVER`, `RESTORE`, `REBUILD`. Uppercase Oswald, low opacity (~25–40%), large size, scattered around the dumbbell area.
- Mount this component as a sibling of `<Scene3D>` inside `InclineAscent.tsx`, pinned `fixed inset-0` with `pointer-events-none` so it sits behind/around the canvas without blocking clicks.

### 3. HeroDumbbell — remove the in-mesh `<Text>` labels
- The dumbbell currently embeds three small `<Text>` labels (centre band "RISE·REFLECT…" and two "INCLE" side labels) using `troika-three-text`. These are the source of the `unsupported GPOS/GSUB LookupType` warnings.
- Replace those with either:
  - tiny **decal textures** (a one-time PNG generated from a `<canvas>`), or
  - simply **remove them** — they're sub-pixel at most viewport sizes and not visually meaningful.
- Recommendation: remove. The dumbbell silhouette and chrome material carry the hero on their own (this is exactly what the reference site does).

### 4. Drop `troika-three-text` from the bundle
- Once `<Text>` is gone from both `FloatingWords` and `HeroDumbbell`, remove the `Text` import from `@react-three/drei` everywhere.
- Update `vite.config.ts` manual chunking: drop the `troika-three-text` / `bidi-js` group since it's no longer pulled in. Three.js chunk shrinks noticeably.

### 5. Scene3D — small simplifications
- No font-related code changes needed inside the canvas anymore.
- Keep current DPR caps (mobile 1.25, desktop 1.75) and antialias-off-on-mobile — they're already good.

### 6. Cleanup
- Remove the font preload line from `index.html`.
- Delete `public/fonts/` if empty after removing the woff.
- No DB / edge function changes. No auth changes. No memory updates required (this is a public-site visual refactor).

## Files touched

- `index.html` — swap font preload for Google Fonts links
- `src/index.css` — add Oswald font-family for landing
- `tailwind.config.ts` — add `oswald` font key (optional; can use inline `style` instead)
- `src/components/3d/FloatingWords.tsx` — rewrite as DOM component (no R3F)
- `src/components/3d/HeroDumbbell.tsx` — remove three `<Text>` instances
- `src/components/3d/Scene3D.tsx` — render `<FloatingWords>` outside the `<Canvas>` (or move mounting up to the page)
- `src/pages/InclineAscent.tsx` — mount the new DOM `<FloatingWords>` as overlay
- `vite.config.ts` — remove troika manual-chunk entries
- `public/fonts/inter-regular.woff` — delete

## Expected outcome

- Console warnings `unsupported GPOS/GSUB LookupType …` → gone.
- Font load failures → gone (no font is fetched by the WebGL canvas).
- First contentful paint earlier on mobile (no font waiting on the hero text — Oswald uses `display=swap`).
- Smaller JS bundle (drop troika + bidi-js, ~70–120 KB gz off the three chunk).
- Same visual: rotating dumbbell + floating "RISE/REFLECT/…" words + scroll parallax.

## Out of scope

- No changes to admin app, member portal, dashboards, auth, or backend.
- No changes to dumbbell geometry, lighting, or animation curves.
- No changes to the scroll/section content beneath the hero.

Approve and I'll implement in this same order: fonts → FloatingWords rewrite → HeroDumbbell label removal → bundle cleanup.
