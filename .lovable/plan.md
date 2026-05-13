# Deep Scan & Audit — Plan

## Findings

### A. Front-website color flash on load / hard refresh (issues #1 & #3)

Root cause: the static **LCP shell** we inlined into `index.html` last round is **visually different** from the real React `InclineAscent` experience.

- `index.html` shell uses a **light gradient** (`#f8fafc → #e2e8f0 → #f1f5f9`) with **dark navy + amber** text and a **black** Incline logo (`filter: brightness(0)`). This is exactly what the screenshot you sent shows.
- The React `InclineAscent` page renders the same hero copy, **then** mounts a full-screen 3D `<Canvas>` on top (dark scene with its own background) once idle/in-view.
- Result on hard refresh:
  1. **t=0**: light shell paints (the screenshot you sent — "different colored" flash).
  2. **t≈300–800 ms**: React boots, renders an identical light hero in `#root`.
  3. **t≈1–2 s**: 3D Scene3D lazy-loads and covers the hero with the dark experience.
  4. **t = window load + 100 ms**: shell gets `.remove()`d.
- `<meta name="theme-color" content="#000000">` also conflicts with the light shell, causing the iOS/Chrome chrome to flash dark→light→dark.

### B. SystemHealth error log (issue #2)

Top unresolved errors in `error_logs` (last 7 days):

| count | route | message | source |
|---|---|---|---|
| 4 | /system-health | "Network error - check your internet connection" | frontend |
| 3 | /dashboard | "Load failed" | frontend |
| 3 | /all-bookings | "Network error..." | frontend |
| 2 | / | **"Error creating WebGL context."** (critical) | frontend |
| 1 | / | **"Cannot read properties of undefined (reading 'add')"** (critical) | frontend |
| 1 | /auth | "Setup check failed: Failed to send a request to the Edge Function" | frontend |
| 1 | /attendance-dashboard | MIPS `212.38.94.228:9000` TCP timeout | edge_function |
| 1 | /incline | 404 route | frontend |
| 1 | /dashboard | Stale dynamic import chunk | frontend |

The two **critical** ones are both Scene3D / Three.js related and only happen on `/` — same area as issue A.

### C. Audit scope (issue #4)

Member · Membership · Payroll · HRM · Invoice · Finance · WhatsApp · AI Brain. This is a large surface — proposing a **read-only audit pass** (no code changes in plan mode), reporting findings per dashboard with severity + recommended fix. No business-logic rewrites unless you approve them after the report.

---

## Plan

### Step 1 — Eliminate landing-page flash (no public visual change)

1. **Make the LCP shell visually neutral & match the final dark scene.** Change the shell background to a near-black gradient (`#0a0a0a → #111827`), text color to light, and **remove the light gradient**. The shell will then look like the loaded Scene3D, not a different page.
2. Keep the H1 copy + Incline logo for LCP/SEO, but invert logo to white (`brightness(0) invert(1)`) and switch heading text color to slate-100 / amber.
3. Hide the React-rendered light hero on `/` until Scene3D is ready (it's already `aria-hidden={mountScene}`, but it's still painted — gate it with `opacity-0` while `!mountScene` and the shell is still present).
4. Remove the shell **only when Scene3D actually mounts** (listen for a custom `scene3d:ready` event dispatched from `Scene3D` `onCreated`), with a hard fallback at 4 s. This kills the "100ms after window.load" race that produces the flicker.
5. Drop `<meta name="theme-color" content="#000000">` duplication or align it to the shell color so the browser chrome doesn't strobe.

### Step 2 — Fix the two critical `/` errors

- **WebGL context error**: in `Scene3D` add a `<canvas>`-level `webglcontextlost` / `webglcontextrestored` listener and a `failIfMajorPerformanceCaveat: false` GL prop, and gate mounting on `WebGLRenderingContext` availability. Show the static hero permanently if WebGL is unavailable.
- **"Cannot read properties of undefined (reading 'add')"**: this is a Three.js cleanup race when the component unmounts before the scene finished initializing. Wrap the `useEffect` cleanup that calls `scene.add` / `group.add` with null checks and cancel pending RAFs in a `cancelled` flag.

### Step 3 — Quiet the noisy non-critical errors

- `/system-health` & `/all-bookings` "Network error": add an `onError` filter in `errorReporter` that drops `TypeError: Failed to fetch` / `Load failed` when `navigator.onLine === false` (these are user-side connectivity, not app bugs).
- `/auth` "Setup check failed": already non-fatal — downgrade severity from `error` to `warn` in `check-setup` invocation in `Auth.tsx`.
- `/incline` 404: add a redirect `/incline → /` in the router (legacy link from somewhere).
- Stale dynamic-import chunk: add the standard `vite:preloadError` listener in `main.tsx` that does `location.reload()` once per session.
- MIPS TCP timeout from `212.38.94.228:9000`: not an app bug, it's a customer device offline. Suppress repeated entries by deduping on `(branch_id, device_ip)` for 30 min in the MIPS edge function's `log_error_event` call.

### Step 4 — Dashboard audit (read-only, deliverable = report)

For each of: **Members, Memberships, Payroll, HRM, Invoices, Finance, WhatsApp, AI Brain** I will check:

- RBAC enforcement (does Staff/Trainer ever see Owner-only widgets?)
- `branch_id` filter on every TanStack query
- `useAuthReady`-style gate before first authenticated query (root cause for the "wrong content flashes" pattern in your stack-overflow note)
- Loading skeleton + error fallback presence
- Numeric correctness for finance: `pending_dues = total - paid` always derived
- N+1 query / RLS recursion risk
- Drawer-vs-Dialog policy compliance
- Realtime subscription cleanup

Output: a single markdown report posted in chat with a per-dashboard table (Severity / Finding / Suggested Fix). I will **not** modify those dashboards in this round; you pick which findings to fix.

---

## Files that will change in Step 1–3

- `index.html` — shell colors, theme-color, removal trigger
- `src/pages/InclineAscent.tsx` — hero opacity gating, scene3d:ready event
- `src/components/3d/Scene3D.tsx` — context-loss handlers, dispatch ready event, cleanup null-checks
- `src/main.tsx` — `vite:preloadError` reload
- `src/lib/errorReporter.ts` — offline filter, severity downgrade helper
- `src/pages/Auth.tsx` — downgrade setup-check severity
- `src/App.tsx` (router) — `/incline → /` redirect
- `supabase/functions/mips-proxy/index.ts` (or wherever the MIPS device call lives) — dedupe device-offline log

No backend schema changes. No public copy or layout changes. Visual outcome on `/`: identical to today **after** Scene3D loads, but **without** the light flash beforehand.

---

## What I need from you before building

Please confirm:

1. Approve Step 1 visual change to the LCP shell (shell becomes **dark** instead of light — matches final loaded state, eliminates flash). Public design unchanged after Scene3D loads.
2. Approve Steps 2 & 3 error fixes as listed.
3. For Step 4 — you want a **report first** (recommended) or want me to fix as I find?