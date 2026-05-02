## Tune floating words + adopt reference site's CSS tokens

You shared the working CSS from the reference project. I'll fold the parts that affect the floating-word feel into our project, then fix the size / opacity / drift issues you reported.

### 1. Fix the floating words (the actual bug)

In `src/components/3d/FloatingWords.tsx`:

- **Smaller** — drop sizes from `clamp(2–6rem)` to `clamp(1rem–2.75rem)` so they read as ambient background, not headlines.
- **Fainter** — base opacity 0.32 → **0.14** (mid-scroll 0.20, end 0.08).
- **Drift left → right** (the bit that wasn't happening). Today the keyframe only translates Y. Replace with a horizontal `inclineDrift` keyframe so each word slowly traverses the viewport with a tiny vertical sway:

```css
@keyframes inclineDrift {
  0%   { transform: translate3d(-30vw, 0, 0); }
  50%  { transform: translate3d( 20vw, -10px, 0); }
  100% { transform: translate3d( 70vw, 0, 0); }
}
```

- Long durations (22–30s, `linear`) so motion is constant and ambient.
- Staggered `animation-delay` per word so they don't all enter together.
- Add `whitespace-nowrap` so longer words don't wrap mid-drift.

### 2. Adopt the reference site's tokens (lightly)

I'll merge — **not overwrite** — the relevant pieces from the CSS you shared. Many of our admin components depend on the existing design tokens (Vuexy palette), so blanket replacement would break dashboards. What I'll lift:

- **Body font** → `'Oswald', sans-serif` for the public landing only (we already added the Google Fonts link). Admin/portal keeps Inter.
- **`html { scroll-behavior: smooth }`** + **`body { overflow-x: hidden }`** — safe globals, harmless to admin.
- **`.hero-title`** and **`.section-title`** utility classes — copied verbatim into `@layer components` so the public landing hero can use them.
- **`.fade-in-up`** keyframe + utility — used by the public sections.
- **`scroll-indicator` / `bounce`** keyframe — for the chevron under the CTA.

What I will **not** touch:
- Existing color tokens (`--primary`, `--background`, etc.) in `src/index.css` — admin theming depends on them.
- `.glass`, `.neon-text`, `.neon-border` — we already have equivalent components.
- Dark mode block — admin uses it.

### 3. Files touched
- `src/index.css` — add `inclineDrift` keyframe (replacing `inclineFloat`), add `.hero-title` / `.section-title` / `.fade-in-up` / `.scroll-indicator` utilities, add `html { scroll-behavior:smooth }` and `body { overflow-x:hidden }`.
- `src/components/3d/FloatingWords.tsx` — new sizes, opacities, animation reference, `whitespace-nowrap`.
- (Optional) `src/pages/InclineAscent.tsx` — apply `.hero-title` to the H1 if it visually improves; will check first and only swap if it's a clear win.

No changes to dumbbell, scene, fonts setup, admin app, or backend. Approve and I'll apply.
