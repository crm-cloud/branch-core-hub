# Fix 3 Issues + Redesign Public Registration

## 1. AI Template Generator returns HTTP 400

**Root cause:** The edge function `ai-generate-whatsapp-templates` hard-rejects payloads with more than **30 events** (`return json({ error: "Max 30 events per call" }, 400)`). The screenshot shows the user selected **35 events** ("35 selected") via "Select all missing", which triggers the 400 — silently shown only as "Edge Function returned a non-2xx status code".

**Fix:**
- **Edge function**: chunk internally instead of rejecting. Loop the AI call in batches of 20, concat `templates[]`, and return them all. Keep a hard cap of 60 to avoid runaway costs.
- **Drawer (`AIGenerateTemplatesDrawer.tsx`)**: surface the actual error message from `data.error` in the toast, and add a clear "≤ 60 events per run" hint near the counter.
- **Drafts workflow (already partially in place)**: confirm that when Meta rejects an AI-generated WhatsApp template, the local row still gets `meta_status='draft'` and is editable from WhatsApp → CRM Templates → Drafts tab. Add a small "Open Drafts" link in the success toast for the rejected ones so the workflow the user described (AI template OR manual create → both end in Pending or Draft) is visible.

## 2. Automation Brain — HTTP 401 "Conflicting API key" floods System Health is empty

**Root cause:** `automation-brain` invokes child workers (`process-scheduled-campaigns`, `process-comm-retry-queue`, `process-whatsapp-retry-queue`, `send-reminders`/booking reminders) with **both** `apikey: ANON_KEY` **and** `Authorization: Bearer SERVICE_KEY`. Supabase Edge Runtime treats that as a conflicting-key request and returns 401 before the function even runs — that's the "HTTP 401: Conflicting API key" string in the run history.

**Fix in `supabase/functions/automation-brain/index.ts`:**
- In `callEdge`, send only `Authorization: Bearer SERVICE_KEY` (drop the `apikey` header). Service role JWT is sufficient.
- When a worker fails (`!r.ok` or RPC error or builtin error), additionally insert into `error_logs` via `admin.rpc('log_error_event', …)` so System Health surfaces them. Use a fingerprint like `automation:{rule.key}` so repeats dedupe.
- Same `log_error_event` call inside `processRule`'s catch block.

This single change fixes the cascade: WhatsApp Retry Queue, Communication Retry Queue, Process Scheduled Campaigns, and Booking Reminders will all start returning 200, and any future failures appear in System Health.

## 3. /register page — complete redesign (new look, no patching)

Delete the old hero/stepper components and rebuild with the user-supplied liquid-glass / metal-button aesthetic — premium, dark, fitness-forward, no robotic 3D Spline. Mobile-first. Proper viewport (`100dvh`, safe-area), no overflow.

**New layout:**
```text
┌─────────────────────────────────────────────────┐
│  Full-bleed dark hero photo (gym, motion blur)  │
│  Gradient overlay → indigo/violet at bottom     │
│  ─ Logo top-left  ─  Step pill top-right        │
│                                                 │
│  ╭───────────── Glass card (centered) ───────╮  │
│  │  Stepper (4 dots, animated)               │  │
│  │  Step content (Details / PAR-Q / Sign /OTP│  │
│  │  Liquid CTA button — full width on mobile │  │
│  ╰───────────────────────────────────────────╯  │
│                                                 │
│  Trust strip: ShieldCheck • DPDP • 4 branches   │
└─────────────────────────────────────────────────┘
```

**Files to create:**
- `src/assets/registration-hero-v2.jpg` — gym athlete, dark cinematic (premium image gen).
- `src/components/ui/liquid-button.tsx` — `LiquidButton` from the supplied snippet, cleaned up & themed via design tokens (`hsl(var(--primary))`).
- `src/components/registration/GlassCard.tsx` — `rounded-3xl backdrop-blur-xl bg-white/8 border border-white/15 shadow-2xl`.
- `src/components/registration/StepDots.tsx` — minimal 4-dot stepper with active gradient.
- `src/pages/PublicRegistration.tsx` — fully rewritten using the above. Keep all existing logic (OTP, PAR-Q, signature, two-stage waiver, branch select fix, +91 phone fix). Use `min-h-[100dvh]` + `pb-[env(safe-area-inset-bottom)]`.

**Files to delete (unused after redesign):**
- `src/components/registration/RegistrationHero.tsx`
- `src/components/registration/RegistrationStepper.tsx`
- `src/components/registration/StepShell.tsx`
- old `src/assets/registration-hero.jpg`

**Style tokens used (no hard-coded hex outside the liquid filter):** `bg-background`, `text-foreground`, `from-primary to-violet-600`, etc.

## Technical Details

- Edge functions to deploy: `ai-generate-whatsapp-templates`, `automation-brain`.
- No DB migrations needed.
- No new dependencies (the supplied snippet uses `class-variance-authority` and `@radix-ui/react-slot`, already installed).
- After fixing automation-brain auth, expect the next 5-min tick to flip Communication Retry Queue / WhatsApp Retry Queue / Process Scheduled Campaigns from `error` to `success` (or `0 dispatched` with no error).

## Out of scope (will be tackled next round)

- AI email HTML hardening (separate fix to `ai-generate-whatsapp-templates` email branch).
- Lead Nurture human-handoff UX.
- The `invoice_drift` line-item repair (already explained, awaiting decision).
