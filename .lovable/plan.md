# Audit findings + speed plan

## 1. `api.theincline.in` — broken (Cloudflare error 1014)

What I found by querying the live DNS + endpoint:

- DNS: `api.theincline.in` → `104.21.29.144`, `172.67.149.68` (Cloudflare proxy IPs, orange-cloud ON, no CNAME).
- HTTPS response: **HTTP 403, body `error code: 1014`**.

Cloudflare error **1014 = "CNAME Cross-User Banned"**. It happens when a Cloudflare-proxied hostname is forwarding to another origin that is itself on Cloudflare but **not registered to your Cloudflare account** — which is exactly what Supabase's API host (`*.supabase.co`) is.

In other words: pointing `api.theincline.in` straight at `iyqqpbvnszyrrgerniog.supabase.co` through Cloudflare's proxy will **never work** without one of:

| Option | What it does | Cost / effort |
|---|---|---|
| **A. Just use `iyqqpbvnszyrrgerniog.supabase.co` directly** | Drop the custom subdomain. Everything in the app already uses this URL. | Free, zero work. **Recommended.** |
| **B. Lovable Cloud / Supabase Custom Domains add-on** | Officially maps `api.theincline.in` → your project. | Paid add-on (~$10/mo on Supabase Pro). Requires enabling in Cloud settings. |
| **C. Cloudflare Worker proxy** | Worker on `api.theincline.in` forwards every request to `iyqqpbvnszyrrgerniog.supabase.co` rewriting `Host` header. | Free tier OK, but adds latency, breaks realtime websockets, and Supabase auth cookies/CORS get messy. Not recommended. |

**Currently nothing in the codebase uses `api.theincline.in`** — `vite.config.ts` and the Supabase client both hard-code `iyqqpbvnszyrrgerniog.supabase.co`. So the broken subdomain is purely cosmetic right now. Safest move: delete the DNS record in Cloudflare and forget about it, unless you want to pay for option B.

---

## 2. Why "Scores could not be computed" appeared

That error comes from Lovable's Lighthouse runner, not your app. It's a transient analyser-side failure (rate limit / timeout fetching the live URL). The Performance and SEO scores **did** compute — only Accessibility and Best Practices are blank. Click "Click to analyze" again on those two cards in a minute and they'll fill in. Nothing to fix in code.

---

## 3. Speed audit — fixes that DO NOT touch the homepage visuals

The 55 perf score is dominated by the 3D landing page (Three.js bundle 242 KB, hero render delay 5.2 s). You've asked to leave the homepage alone, so I'll skip Three.js / hero changes and only do the "free" wins:

### Fix list (no visual change to homepage)

1. **Force minification of `icons-vendor` (-45 KB)**
   The lucide-react chunk is shipping unminified. Add `build.minify: 'esbuild'` (or `terser`) explicitly + `esbuild: { legalComments: 'none' }` in `vite.config.ts`. Right now Vite default is `esbuild` but the pre-bundled lucide ESM appears to be slipping through; forcing post-bundle minify on all chunks fixes it.

2. **Don't ship `charts-vendor` + `data-vendor` on landing (-200 KB unused JS)**
   Lighthouse shows `charts-vendor-Chs3RfeM.js` (111 KB, 80 % unused) and `data-vendor-CvqvgvRS.js` (55 KB, 74 % unused) loading on `/`. That means something the landing imports pulls them in. I'll trace the import graph (likely `App.tsx` eagerly imports a route that uses recharts / react-query) and convert those routes to `React.lazy()`. Landing markup is untouched.

3. **Resize/optimise `/incline-logo.png` (-9 KB + LCP)**
   Source is 448×256 PNG, displayed at max 196×112. I'll re-export it as a properly-sized PNG (or keep filename, swap bytes). Same `<img>` tag, same look — just smaller file. Also covers the "use efficient cache lifetimes" warning by adding a long-cache header for `/incline-logo.png` in `netlify.toml` / `public/_headers`.

4. **Self-host or `font-display: swap` the Oswald font (render-blocking 202 ms)**
   The `<link rel="stylesheet" href="…fonts.googleapis.com/css2?family=Oswald…">` blocks render. Switch to `<link rel="preload" as="style" onload="this.rel='stylesheet'">` pattern, or self-host the woff2. No visual change.

5. **Purge unused CSS (-24 KB)**
   91 % of the 27 KB CSS bundle is unused on landing. Tailwind's `content` glob already covers `src/**`, so the unused CSS is mostly shadcn component classes pulled in globally. I'll move global imports of unused shadcn primitives out of the landing-route bundle (lazy-load the app shell). Homepage CSS unchanged.

6. **Cache header for `/incline-logo.png`**
   Add a `Cache-Control: public, max-age=31536000, immutable` header in `netlify.toml`. One-line config change.

### Things I will NOT touch (per your request)

- The Three.js hero, the `<h1>`, font choices, copy, layout, animations, IO triggers — anything visible on `/`.
- The 5.2 s LCP element-render-delay (caused by the 3D scene). Fixing this requires deferring/replacing the hero, which would change the homepage.
- Forced reflow inside `react-vendor` (0.7 ms, negligible — Lighthouse flagged it but it's noise).

### Expected impact

| Metric | Now | After fixes (estimate) |
|---|---|---|
| Performance score | 55 | 75-82 |
| Unused JS | 359 KB | ~120 KB |
| Unminified JS | 45 KB | 0 |
| TTI | 26 s | 8-12 s (still gated by 3D scene) |
| LCP | 1.2 s | 1.0 s |

To break past 85 you'd need to either lazy-load the 3D scene behind a poster image or defer it until after first paint — both visible changes I'm not making here.

---

## What I'll do when you approve

1. Tell you (in chat) to delete the `api.theincline.in` DNS record in Cloudflare — no code change needed. Or, if you want option B, I'll guide you through the Supabase custom-domain add-on.
2. Edit `vite.config.ts` (force minify, ensure terser).
3. Convert eagerly-imported chart/query routes to `React.lazy` in `App.tsx` (no UI change).
4. Re-export `public/incline-logo.png` at 224×128.
5. Swap the Oswald `<link>` in `index.html` for the non-blocking preload pattern.
6. Add long-cache header for the logo in `netlify.toml`.
7. Re-run Lighthouse and report new scores.

Total touched files: `vite.config.ts`, `src/App.tsx`, `index.html`, `netlify.toml`, `public/incline-logo.png`. Zero changes to landing components.
