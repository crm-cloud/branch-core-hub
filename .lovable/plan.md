# Login Page Redesign — Premium Split-Screen

Inspired by the Dribbble references (3D animated landing-style login, Rive-animated brand panel, illustration-led hero):

- Left = a rich, branded "visual stage" with motion (Incline electric-blue palette).
- Right = a clean, focused glass auth card.
- Mobile = visual collapses to a compact gradient hero on top, form below.

All existing auth flows (Password, Email Code, OTP, Forgot Password, Google) keep working unchanged — only the **shell + visuals** of `Auth.tsx` and `LoginForm.tsx` styling are redesigned.

---

## What it will look like

```text
┌──────────────────────────────────────────────────────────────┐
│  LEFT PANEL (50%)            │  RIGHT PANEL (50%)            │
│  electric-blue gradient      │  off-white / subtle texture   │
│                              │                               │
│  • Incline logo (top-left)   │   ┌─ Glass card ──────────┐   │
│  • Floating words: RISE,     │   │ Welcome back          │   │
│    REFLECT, REPEAT (slow     │   │ Sign in to continue   │   │
│    drift, scoped CSS anims)  │   │                       │   │
│  • Animated grid + glow orbs │   │ [ Google sign-in ]    │   │
│  • Big tagline:              │   │ ─── or ───            │   │
│      "Climb higher.          │   │ [ Tabs Pwd | Code ]   │   │
│       Every. Single. Day."   │   │ [ Email ]             │   │
│  • Small testimonial /       │   │ [ Password 👁 ]       │   │
│    member avatar stack       │   │ [ Sign In CTA ]       │   │
│  • Footer: © Incline · v…    │   │ Forgot password?      │   │
│                              │   └───────────────────────┘   │
│                              │   Privacy · Terms · Deletion  │
└──────────────────────────────────────────────────────────────┘
```

Mobile (<768px): left panel collapses into a 220px gradient hero with logo + tagline + 2 floating words; auth card sits below as a full-width sheet.

---

## Visual system

- **Palette (scoped to `.incline-auth`)** — electric blue primary, deep navy ink, soft ice surface:
  - `--primary: 217 91% 50%` (electric blue)
  - `--primary-glow: 199 95% 60%` (cyan accent for orbs)
  - `--ink: 222 47% 11%` (card text)
  - `--surface: 0 0% 100%` with 70% opacity + backdrop blur for the glass card
  - Left panel: `bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(217_91%_18%)] to-[hsl(199_95%_30%)]`
- **Typography**: existing Inter + Oswald (already loaded). Tagline uses Oswald 600, body Inter.
- **Surfaces**: `rounded-3xl`, `shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)]`, 1px hairline border `border-white/60`.
- **Motion** (CSS only, respects `prefers-reduced-motion`):
  - `authOrbDrift` — slow 18–24s translate/scale on 3 blurred orbs.
  - `authGridShift` — subtle 40s background-position pan on a faint grid.
  - `authWordFloat` (reuse existing keyframes `incFloatA/B/C`) — 3 floating words on the left panel.
  - Card entrance: `translateY(12px) + opacity 0 → 1` over 400ms ease-out.
  - Button hover: subtle scale 1.01 + glow shadow.
- **Icons**: lucide-react only (Mail, Lock, Eye/EyeOff, Loader2 — already used).

---

## Files to change

1. **`src/pages/Auth.tsx`** — replace single-card layout with split-screen shell:
   - Wrap in `.incline-auth` (scoped palette).
   - `lg:grid-cols-2` two-column layout, left = `<AuthVisualPanel />`, right = centered `<LoginForm />` inside glass card.
   - Mobile: stack with compact hero on top.
   - Keep all existing redirect/setup-check logic untouched.
   - Keep `<SEO />` and footer legal links (move into right column footer).

2. **`src/components/auth/AuthVisualPanel.tsx`** *(new)* — pure DOM/CSS, no R3F:
   - Logo lockup (Incline wordmark, gradient text).
   - 3 absolutely-positioned floating words ("RISE", "REFLECT", "REPEAT") using existing `incFloatA/B/C` keyframes.
   - 3 blurred gradient orbs with `authOrbDrift`.
   - SVG dot/line grid overlay at low opacity.
   - Big tagline + sub-copy.
   - Avatar stack + "Trusted by 4,000+ members across 6 branches" social proof.
   - Bottom-left: small `© Incline · The Incline Life`.

3. **`src/components/auth/LoginForm.tsx`** — *visual polish only, no logic changes*:
   - Heading: `text-2xl` + a small "Hi 👋" replaced with "Welcome back" + warm subcopy.
   - Add a **Google sign-in button** at the top (calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/home' } })`) above the tabs, with a "or use email" divider.
   - Inputs get `rounded-xl`, larger left icon padding, focus ring `ring-2 ring-primary/30`.
   - Primary button: `bg-primary text-primary-foreground` with soft glow shadow `shadow-[0_10px_30px_-10px_hsl(217_91%_50%/0.55)]`.
   - Tab pill: switch to a sleeker underline-style toggle (still accessible buttons).
   - Keep all data-testids, OTP step, Forgot link, error handling exactly as-is.

4. **`src/index.css`** — add scoped block:
   - `.incline-auth { --primary: 217 91% 50%; --primary-foreground: 0 0% 100%; --ring: 217 91% 50%; ... }`
   - New keyframes: `authOrbDrift`, `authGridShift`, `authCardIn`.
   - `.incline-auth .glass-card { backdrop-filter: blur(18px); background: hsl(0 0% 100% / 0.78); }`
   - `@media (prefers-reduced-motion: reduce)` disables all auth animations.

---

## Technical details

- **No new dependencies** — all motion is CSS, all icons from lucide-react, all components from existing shadcn set. No three.js, no Framer Motion, no Rive (the Dribbble refs use heavy 3D/Rive; we get the *feel* with pure CSS to keep bundle and crash-free).
- **R3F-safe**: no `useFrame`/`useThree` anywhere — the visual panel is plain JSX/CSS.
- **Accessibility**:
  - Left panel marked `aria-hidden="true"` (decorative).
  - Form labels stay visible (no placeholder-only).
  - Focus rings preserved on all inputs/buttons (≥2px, primary color).
  - Color contrast verified: white on electric-blue ≥ 4.5:1; ink on white card ≥ 12:1.
  - Touch targets ≥ 44px (h-12 inputs/buttons stay).
  - `prefers-reduced-motion` disables drift animations.
- **Responsive breakpoints**: mobile <768 stacked, ≥`lg` (1024) split 50/50, `≥xl` (1280) split 55/45 with extra left-panel padding.
- **Performance**: orbs use `transform` + `opacity` only (GPU). Grid is a single inline SVG data-URL background — no extra image requests.
- **Auth logic**: zero behavioral change. All Supabase calls, OTP countdown, redirect logic, `getHomePath`, `mustSetPassword`, referral capture stay exactly as today.
- **Google sign-in**: uses managed Lovable Cloud Google OAuth (no extra config needed). If `signInWithOAuth` returns an error it's toasted; success redirects via Supabase.
- **Brand**: footer keeps "The Incline Life by Incline" per memory rule.
- **Memory rule compliance**: Vuexy aesthetic (rounded-2xl/3xl, soft colored shadows, no harsh borders), mobile-safe (`min-h-dvh`, `pb-safe` on stacked footer), no inline `hasAnyRole`, no dialogs introduced.

---

## Out of scope (explicit)

- No changes to `ForgotPassword`, `ResetPassword`, `SetPassword` pages (can be a follow-up if you want them themed too — happy to do in a second pass).
- No changes to `AuthContext`, RLS, or any backend.
- No new images/assets uploaded; everything is CSS/SVG.

After approval I'll implement all four file changes in one pass and screenshot the result at desktop + mobile to verify.
