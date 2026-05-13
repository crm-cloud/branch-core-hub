## Audit summary

### Confirmed root cause of the public website flash
- `index.html` still contains a hard-coded `#lcp-shell` static hero.
- That shell is exactly the first screenshot: no dumbbell, amber accent text, simplified layout.
- React then loads `InclineAscent`, lazy-loads `Scene3D`, and only after `scene3d:ready` does the shell get removed.
- Result: users see two different public website states on every hard load. This is not a branding/content bug in the React page; it is a deliberate static shell handoff that is now visually unacceptable.

### Performance finding
- The preview shows about `8.3s` full load / DOMContentLoaded in dev mode because Vite loads many unbundled modules. Published build will be better, but the shell swap is still architecturally fragile.
- The current optimization tried to improve LCP by painting fake content early, but it created a worse UX. The senior fix is to stop using fake content and make the real React hero paint fast.

### System Health findings
Open unresolved errors are mostly:
- `/` critical: `Cannot read properties of undefined (reading 'add')` from `react-helmet-async` / landing render stack.
- `/` critical: `Error creating WebGL context.` from the 3D scene on some devices.
- Several stale/noisy network errors: `Load failed`, `Network error - check your internet connection`, stale dynamic import errors, and already-fixed `/incline` 404.
- One real operational error: MIPS TCP timeout to the local device endpoint from attendance dashboard.

### Wider audit notes
- Backend is healthy.
- Database linter reports many warnings, but those are broad security-hardening items and should not be mixed into this public-landing emergency fix.
- I also found old patterns to address in a later audit wave: some `hasAnyRole(...)` usage in fitness pages, broad dashboard scans needed for branch scoping/RBAC, and some direct communication/task writes that need closer review.

## Implementation plan

### 1. Remove the fake initial public page completely
- Delete the `#lcp-shell` markup and shell-removal script from `index.html`.
- Keep only safe, non-visual performance hints: logo preload, font preload, SEO tags.
- This guarantees the first visible page and final page are the same React-rendered public website.

### 2. Make the real React landing render immediately
- Change `/` route from lazy-loaded to eager import for `InclineAscent` only.
- Keep heavy 3D code lazy-loaded.
- This removes the blank/fake interstitial without loading the whole app upfront.

### 3. Provide a real lightweight fallback inside React
- Add a lightweight hero layer in `InclineAscent` that matches the final public site visual language.
- Keep the logo, headline, paragraph, and CTA positioning consistent with `ScrollOverlay`.
- Mount the 3D scene after first paint/idle, but do not show a separate fake color/state.
- The fallback remains visible if WebGL is unavailable, instead of throwing or flashing.

### 4. Harden 3D/WebGL lifecycle
- Wrap `Scene3D` with safer Canvas lifecycle handling.
- Dispatch readiness only after Canvas exists and has rendered.
- Add cleanup for `webglcontextlost` listener.
- Avoid failing the whole landing page when WebGL cannot initialize.

### 5. Fix the landing critical SEO/Helmet error
- Remove duplicate static JSON-LD/head conflicts where safe, or make `SEO` injection stable for the public landing.
- Ensure `react-helmet-async` does not crash the landing route on hydration/render.

### 6. Clean System Health noise without hiding real bugs
- Improve error filtering for Safari `Load failed`, offline/network fetch failures, stale dynamic import chunks, and known preview/lovable wrapper warnings.
- Keep real backend/function/database errors visible.
- After code fixes, mark stale resolved System Health entries as resolved via a safe data update only for errors that are demonstrably addressed: `/incline` 404, stale chunk reload, old WebGL crashes if no longer reproducible, and old setup-check logging.

### 7. Focused audit report for requested modules
- Produce a concise follow-up audit list for Members, Memberships, Payroll, HRM, Invoices, Finance Dashboard, WhatsApp, and AI Brain.
- Categorize issues as: critical data integrity, RBAC/branch scoping, performance/N+1, UX/loading states, and integration reliability.
- Do not change those modules in this fix unless a live System Health error directly points to them.

## Validation plan

- Hard-refresh `/` and verify there is no first-screenshot shell anymore.
- Capture screenshot immediately after navigation and after a few seconds: both must be the same visual direction.
- Check browser console for `/` errors.
- Run browser performance profile again to confirm no new long blocking path from eager landing import.
- Re-query System Health open errors after validation.

## Files expected to change

- `index.html`
- `src/App.tsx`
- `src/pages/InclineAscent.tsx`
- `src/components/3d/Scene3D.tsx`
- `src/components/seo/SEO.tsx` if needed after Helmet review
- `src/services/errorLogService.ts`
- Possible safe data update to resolve stale System Health rows after validation