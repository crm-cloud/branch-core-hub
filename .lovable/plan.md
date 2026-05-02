# Public Website Speed — Audit & Fix

## Root cause

The public landing (`/`) renders an `<InclineAscent>` page that wraps a Three.js `<Canvas>` from `@react-three/fiber` with `<ScrollControls>` + `<Scroll html>`. **The logo and all marketing copy live inside `ScrollOverlay`, which is a child of `<Scroll html>` — meaning they cannot paint until Three.js + drei (~700–900 KB gzip) finish downloading, parsing, and initializing the WebGL context.**

That's why the user sees the 3D blob appear before the logo: the logo is literally rendered *by* the 3D bundle.

Secondary issues found:
1. The static SEO hero in `InclineAscent` already paints instantly, but it does **not** include the logo — only the H1.
2. `ScrollOverlay` uses React's camelCase `fetchPriority` prop on `<img>`. React 18 emits a console warning ("React does not recognize the `fetchPriority` prop") because this DOM attr support varies. Confirmed in current console logs.
3. `Scene3D` is gated by `requestIdleCallback` + IntersectionObserver, which is good, but the gating is wasted because the visible content (logo) lives inside it.
4. `index.html` has no `<link rel="preload">` for the logo asset, so the browser only discovers it after JS executes.

## Fix plan (small, surgical)

### 1. Move the logo OUT of the 3D overlay
- Remove the logo `<img>` block and the `inclineLogo` import from `src/components/ui/ScrollOverlay.tsx`.
- Add the same `<img>` block (with proper `loading="eager"` + lowercase `fetchpriority="high"` DOM attribute to silence the React warning) directly inside `src/pages/InclineAscent.tsx`, sitting next to the static SEO hero at the top of the JSX. It uses `position: fixed; z-50` so it sits above both the static hero and the 3D canvas.
- **Result:** logo paints with the first HTML render, before any JS chunk for Three.js downloads.

### 2. Preload the logo from `index.html`
- Add `<link rel="preload" as="image" href="/src/assets/incline-logo.png" fetchpriority="high">` (Vite will rewrite the path at build) so the browser starts fetching the 11 KB logo during the HTML parse, in parallel with the JS bundle.

### 3. Static H1 already exists; no change needed
- Keep the existing `aria-hidden={mountScene}` static hero — it already covers the LCP text.

### 4. Confirm Scene3D stays lazy
- No change to `Scene3D.tsx` — it's already `lazy()`-imported with idle/intersection gating. This wave doesn't touch the 3D pipeline itself, just removes the visible content from being trapped inside it.

### 5. Optional micro-wins (low risk)
- Drop `loading="eager"` (default for above-fold) and rely on the preload link for priority signaling.
- Add `dns-prefetch` for the social-image CDN (`storage.googleapis.com`) since the OG image fetch sometimes contends with the main bundle on slow networks.

## Files to edit

```text
src/components/ui/ScrollOverlay.tsx    — remove logo block + inclineLogo import
src/pages/InclineAscent.tsx            — add logo (and import) above the static hero
index.html                             — add <link rel="preload"> for logo + dns-prefetch
```

## Expected impact

- **Logo paints simultaneously with the H1**, before the 3D canvas (the user's main complaint).
- LCP improves on 3G/4G mobile because the logo is no longer blocked behind the ~700–900 KB `three-vendor` chunk.
- One React DOM-prop warning eliminated.
- No visual regression — the 3D scene still mounts and covers the static hero exactly as before.

## Out of scope

- Restructuring the 3D scene itself (model size, lighting cost) — current asset budget is reasonable.
- Splitting `three`/`drei` further — already isolated in their own chunks per `vite.config.ts`.
- Server-side rendering / static generation — separate, larger initiative.