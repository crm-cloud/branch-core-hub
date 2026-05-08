## Cloudflare Lighthouse audit — recommendations & action plan

The Cloudflare report mixes two categories: **(A) Cloudflare dashboard toggles** that you turn on at the edge, and **(B) code-side fixes** in this repo. Below is what each item means for `theincline.in` and what we should do.

### A) Turn on at Cloudflare dashboard (no code changes)

These are the items Cloudflare is upselling — they're real wins, all configurable from your CF dashboard for `theincline.in`:

| Cloudflare feature | What it fixes | Recommendation |
|---|---|---|
| **Polish** (Speed → Optimization → Image Optimization) | "Improve image delivery" + "Avoids enormous payloads" — auto WebP/AVIF, lossless compression of PNG/JPG | **Enable: Lossless + WebP**. Free on Pro plan. Will compress `/incline-logo.png`, OG image, and any future uploads. |
| **Cache Rules** (Caching → Cache Rules) | "Use efficient cache lifetimes" — Lighthouse flags assets with short max-age | **Add rule:** `*.{js,css,woff2,png,jpg,svg,webp}` → Edge TTL 1 year, Browser TTL 1 year. Already done in `_headers` for the logo; CF rule extends it to everything. |
| **Argo Smart Routing** (Traffic → Argo) | "Reduce server response time" + "Document request latency" — routes via fastest CF path to Supabase | **Paid ($5 + $0.10/GB).** Helps if your visitors are far from Mumbai. Optional. Skip unless you see slow TTFB from Western users. |
| **Zaraz** (Zaraz → Tools) | "3rd parties" + "Minimize main-thread work" — moves analytics/pixels off the main thread to a CF Worker | **Only relevant if you add GA / Meta Pixel / GTM.** Currently we have none, so this is N/A. |
| **Rocket Loader** (Speed → Optimization → Content Optimization) | "Render blocking requests" — defers `<script>` parsing | **Do NOT enable.** Known to break React/Vite SPAs. Our code-side fix below handles render-blocking properly. |

### B) Code-side fixes in this repo

Two real items Lighthouse is flagging that we can address without touching landing-page UI:

#### B1. Render-blocking requests
- The Oswald font preload pattern is already in `index.html` (good).
- Remaining render blocker: the main `/src/main.tsx` script tag. It's already `type="module"` (deferred by default), so this is fine — Lighthouse sometimes still flags it. **No change needed.**

#### B2. Avoids enormous network payloads
- Largest current asset on landing: the OG/Twitter image at `storage.googleapis.com/...Incline.webp` (~loaded for crawlers but browsers don't fetch it for landing render). **No change needed.**
- The 3D model on landing (`/three/`) is already in its own `three` chunk and IO-gated. **No change needed.**

#### B3. Use efficient cache lifetimes (extend existing config)
- `netlify.toml` and `public/_headers` only long-cache `/incline-logo.png`. Vite-emitted hashed assets in `/assets/*` are served by Netlify with a default 1-year cache already, so this is mostly fine. We'll add an explicit immutable rule for `/assets/*` to silence Lighthouse.
- Add immutable cache headers for `/assets/*` (hashed JS/CSS/images Vite outputs).

#### B4. Minimize main-thread work
- Already addressed via vendor chunk splitting, lazy routes, and `modulePreload: { polyfill: false }` in `vite.config.ts`. Nothing further to do without touching landing components (which you said is off-limits).

---

## Plan

1. **`public/_headers` + `netlify.toml`** — add immutable 1-year cache rule for `/assets/*` so Vite's hashed bundles stop showing the "efficient cache lifetimes" warning.
2. **Document Cloudflare dashboard steps** in `docs/cloudflare-setup.md` (new file) so you have a checklist for: enabling Polish (Lossless + WebP), adding the Cache Rule, and explicitly noting "do not enable Rocket Loader."

That's it — no homepage code changes, no business logic changes, nothing risky.

---

### Things I'm explicitly NOT doing (and why)

- **Not enabling Rocket Loader** — breaks React hydration.
- **Not enabling Argo** — paid, marginal gain for India-based visitors hitting Mumbai Supabase.
- **Not adding Zaraz** — no third-party scripts to offload.
- **Not touching landing components / hero / 3D scene** — per your earlier instruction.
- **Not re-checking `api.theincline.in`** — already established it's broken (CF error 1014) and unused; recommend deleting that DNS record at Cloudflare.

### Expected outcome

After (1) shipping the headers patch and (2) enabling **Polish + Cache Rule** in Cloudflare dashboard, the Lighthouse score on `theincline.in` should move from **55 → ~80** with zero visual change.
