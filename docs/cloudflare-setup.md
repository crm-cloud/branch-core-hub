# Cloudflare setup checklist for theincline.in

Lighthouse / Cloudflare Observatory keeps suggesting edge optimisations.
Here's exactly what to enable (and what to skip) in the Cloudflare dashboard.

## ✅ Enable

### 1. Polish (image optimisation)
**Speed → Optimization → Image Optimization → Polish**
- Mode: **Lossless** (or Lossy if you want max savings)
- ✅ **WebP** conversion: ON
- Effect: auto-compresses PNG/JPG, serves WebP to supported browsers.
  Fixes Lighthouse "Improve image delivery" + "Avoids enormous payloads".

### 2. Cache Rule for static assets
**Caching → Cache Rules → Create rule**
- Name: `Long-cache hashed assets`
- If incoming request matches: **URI Path** `starts with` `/assets/`
  (optionally also: OR URI Path matches `\.(js|css|woff2|png|jpg|svg|webp)$`)
- Then:
  - Cache eligibility: **Eligible for cache**
  - Edge TTL: **1 year**
  - Browser TTL: **1 year**
- Effect: silences Lighthouse "Use efficient cache lifetimes".

### 3. Brotli
**Speed → Optimization → Content Optimization → Brotli**: ON (default).

## ❌ Do NOT enable

### Rocket Loader
Breaks React / Vite hydration. Our bundle is already module-deferred.

### Auto Minify (deprecated)
Vite already minifies via esbuild. CF Auto Minify is being sunset anyway.

## 💰 Optional / paid

### Argo Smart Routing — $5/mo + $0.10/GB
Helps "Reduce server response time" + "Document request latency" if you
have a lot of overseas traffic. Skip for now (visitors are India-based,
Supabase is in Mumbai — TTFB is already low).

### Zaraz
Only useful once you add 3rd-party scripts (GA, Meta Pixel, GTM).
Currently we have none, so leave it off.

## 🧹 Housekeeping

### Delete `api.theincline.in` DNS record
**DNS → Records → api → Delete**
- It currently 403s with CF error 1014 ("CNAME Cross-User Banned") because
  it's proxying to a Supabase host on a different CF account.
- Nothing in the app uses this subdomain — every Supabase call hits
  `iyqqpbvnszyrrgerniog.supabase.co` directly.
- A real `api.theincline.in` would require Supabase's paid Custom Domains
  add-on. Not worth it.

## Expected result

After Polish + Cache Rule are enabled and `_headers` ships, Lighthouse
performance on `theincline.in` should move from **55 → ~80** with no
visual changes.
