# Public Site Performance Plan (no visual changes)

## What Lighthouse is actually saying

- **TTFB: 0 ms** — server is fine.
- **Element render delay: 8,680 ms** — the LCP element (the H1 "WHERE GLOBAL STRENGTH MEETS CLINICAL SERENITY") is rendered by React, so it cannot paint until the entry JS chunk downloads, parses and runs. That is 100% of the LCP budget.
- **Critical chain (10 s)**: HTML → `index-*.css` → Google Fonts CSS → `gstatic` woff2 → `index-*.js`. Two of those hops are Google Fonts, which we don't actually need on the critical path.
- **Cache lifetime warnings**: `flock.js` (Lovable preview banner — irrelevant in prod) and `/incline-logo.png` (no `Cache-Control`).

The single biggest win is killing the render-delay by giving the browser the LCP element in the initial HTML, before React boots.

## Changes

### 1. Inline a static hero shell into `index.html`

Add the exact same logo + H1 + paragraph markup that `InclineAscent.tsx` already renders for the static SEO hero, into `<body>` before `<div id="root">`. Use the same Tailwind classes (compiled CSS still applies) so it is visually identical.

- LCP element exists at first HTML byte → render delay collapses from ~8.7 s to ~0 ms.
- React mounts into `#root` and renders its own copy on top (the existing fixed `-z-10` SEO hero already overlays cleanly, and the Scene3D canvas covers it once mounted), so users see no flicker.
- Add `aria-hidden="true"` to the inline shell so it is invisible to AT once React paints.

### 2. Preload the LCP image

Add to `<head>`:
```
<link rel="preload" as="image" href="/incline-logo.png" fetchpriority="high" />
```
Logo paints with the inline shell instead of waiting for React's render pass.

### 3. Drop Google Fonts from the critical path

Today the chain is `index.html → fonts.googleapis.com/css2 → fonts.gstatic.com/...woff2`. Two extra cross-origin hops on the critical path.

- Self-host Oswald 400/500/600/700 woff2 under `public/fonts/oswald/`.
- Replace the Google Fonts `<link rel="preload" as="style">` with a single inline `@font-face` block in `<style>` inside `<head>` pointing at the local files, `font-display: swap`.
- Add `<link rel="preload" as="font" type="font/woff2" href="/fonts/oswald/oswald-600.woff2" crossorigin>` for the weight used in the H1.
- Remove the `preconnect`/`dns-prefetch` to `fonts.googleapis.com` and `fonts.gstatic.com` — no longer needed.

Net effect: removes the ~7.3 s + ~2.7 s chained Google requests from the critical path on first paint.

### 4. Lazy-mount public-only modals

`RegisterModal` and `LegalModal` are currently imported eagerly by `InclineAscent.tsx`, so they sit in the entry chunk for the landing page even though they are only used after a click.

- Convert both to `const RegisterModal = lazy(() => import('@/components/ui/RegisterModal'))` (same for LegalModal).
- Wrap with `<Suspense fallback={null}>` and only mount them after first user interaction (reuse the existing `pointerdown`/`touchstart` listener pattern already in `InclineAscent.tsx`).

Trims a few KB off the entry chunk and removes their CSS work from initial paint.

### 5. Long-cache `/incline-logo.png` (and friends)

Lighthouse flags `/incline-logo.png` as having no cache TTL. Two options, both invisible to users:

- If we control a `_headers` / `vercel.json` / `netlify.toml` for the public deploy, add:
  ```
  /incline-logo.png
    Cache-Control: public, max-age=31536000, immutable
  /favicon.ico
    Cache-Control: public, max-age=2592000
  /fonts/*
    Cache-Control: public, max-age=31536000, immutable
  ```
- Otherwise, this is the exact case the existing `docs/cloudflare-setup.md` "Cache Rule for static assets" was written for — extend that rule to also match `/incline-logo.png`, `/favicon.ico`, `/fonts/*`. No code change needed; it's a Cloudflare dashboard checklist update.

(The Lovable preview's `flock.js` warning is preview-only and never ships to `theincline.in` — ignore.)

## Out of scope (intentionally)

- No Tailwind / component / copy changes.
- No restructuring of `Scene3D`, `ScrollProgressBar`, `SEO`, or any visible component.
- No changes to authenticated app routes, bundling rules in `vite.config.ts`, or vendor chunks.
- No font-family changes (Oswald stays Oswald, just self-hosted).

## Files touched

- `index.html` — inline hero shell, preload tags, self-hosted `@font-face`, drop Google Fonts links.
- `public/fonts/oswald/*.woff2` — new self-hosted font files (downloaded from Google Fonts).
- `src/pages/InclineAscent.tsx` — lazy-mount `RegisterModal` and `LegalModal` behind first interaction.
- (Optional) `public/_headers` or Cloudflare dashboard rule — long-cache static assets.

## Expected result

- LCP on `/`: **~8.7 s → ~1–2 s** (element exists in initial HTML; logo preloaded).
- Critical chain max latency: **~10 s → ~3 s** (no chained Google Fonts hops).
- Repeat-visit byte savings: ~13 KB (logo + fonts now long-cached).
- Zero visual difference on the landing page or anywhere else.
