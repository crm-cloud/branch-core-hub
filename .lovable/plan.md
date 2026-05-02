## Public Site — Speed & Stability Plan

### Why your site feels slow right now
1. **3D text is broken.** My previous fix pointed `<Text>` at a Google Fonts CDN URL that troika can't load via XHR. That's the `Failure loading font` error you're seeing — the scene now hangs waiting for a font that will never arrive, which is why "the website is not loading complete".
2. **Logo preload is wrong.** `index.html` preloads `/src/assets/incline-logo.png`. That path only works in dev — in production Vite hashes the asset, so the preload 404s and the browser wastes a request.
3. **Mobile 3D is heavier than it needs to be.** Antialiasing on + DPR up to 1.5 doubles fragment shader cost on phones.
4. **Lovable preview iframe `postMessage` errors** are unrelated noise from the preview tool itself — they don't appear on the published `theincline.in` site. Documented, not fixed in code.

### Why the reference Lovable URL loads instantly
That URL (`643f75d4...lovableproject.com`) is a Lovable login screen — one SVG logo, a couple of buttons, no fonts, no 3D, no images. It's not a real comparison to a Three.js landing. The valid takeaways: small payload, system fonts, no blocking external requests on first paint. We'll apply those same principles below without removing your 3D experience.

### What we'll change

**1. Fix the broken 3D font (highest priority — currently blocking render)**
- Add `public/fonts/inter-regular.woff2` (Inter Regular only, ~30 KB, no advanced GPOS/GSUB tables).
- Point all `<Text font="...">` props in `HeroDumbbell.tsx` and `FloatingWords.tsx` at `/fonts/inter-regular.woff2`. Same-origin → no CORS/XHR failure → text renders, console is clean, no more "unsupported LookupType" warnings either.
- Keep `characters="…"` subsetting so the GPU glyph atlas stays tiny.

**2. Fix the logo preload (production-safe)**
- Copy the logo to `public/incline-logo.png`.
- Update `index.html` preload to `/incline-logo.png`.
- Update `src/pages/InclineAscent.tsx` `<img src>` to `/incline-logo.png`.
- Result: logo paints from the HTML preload, before any JS executes.

**3. Lighter 3D defaults (no visual change)**
- In `Scene3D.tsx`:
  - Mobile `dpr` `[1, 1.5]` → `[1, 1.25]`.
  - Desktop `dpr` `[1, 2]` → `[1, 1.75]`.
  - `antialias: !isMobile` (off on phones; canvas size is small enough that the difference is invisible, but it cuts ~30–40% of fragment work).
- Result: smoother scroll on mid-range Android, lower battery drain, faster first frame.

**4. Smarter mount gating for low-end mobiles**
- Current logic: mount 3D when hero is in view + browser is idle. Keep it.
- Add: if `navigator.hardwareConcurrency <= 4` AND viewport < 768 px, defer until first user scroll/tap instead of on idle. The static SEO hero stays visible; 3D loads only when the user engages.
- Honors `prefers-reduced-motion` (skip mount entirely → static hero only).

**5. Bundle hygiene**
- Extend the `three` chunk in `vite.config.ts` to also capture `troika-three-text` and `bidi-js` so they cache together with three.js.
- Add a small inline script in `index.html` that, on desktop only (`innerWidth >= 768`), injects `<link rel="modulepreload">` for the `three` chunk so it warms up while the user reads the hero. Mobiles skip this to avoid metered-data waste.

### Files to change
- `public/fonts/inter-regular.woff2` — new (~30 KB).
- `public/incline-logo.png` — copied from `src/assets/`.
- `index.html` — fix preload path, add desktop-only modulepreload injector.
- `src/components/3d/HeroDumbbell.tsx` — `font="/fonts/inter-regular.woff2"`.
- `src/components/3d/FloatingWords.tsx` — same.
- `src/components/3d/Scene3D.tsx` — DPR + antialias tuning.
- `src/pages/InclineAscent.tsx` — low-end-device mount gate; logo `src` to `/incline-logo.png`.
- `vite.config.ts` — extend `three` manualChunk.

### Explicitly NOT changing (your constraint)
- Floating words list, motion, opacity, layout.
- Dumbbell geometry, rotation, materials, scroll-driven animation.
- Scroll length, overlay copy, ScrollControls behavior.
- RegisterModal / LegalModal / SEO / branches data.
- Any visible color, typography, or interaction.

### Expected impact
- 3D text renders correctly on first load (currently broken).
- Mobile LCP improvement of ~0.4–0.8 s from correct logo preload + lighter GPU settings.
- Console clean of font/OpenType errors.
- No visual regression on any device.
