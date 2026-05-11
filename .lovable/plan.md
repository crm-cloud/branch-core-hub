## Goals

1. Make the global loader feel premium and on-brand (no static blue dumbbell look).
2. Redesign the Set Password screen so it matches the rest of the app theme (right now it's a generic white card on a dark navy gradient that doesn't feel like Incline).
3. Let **staff and trainers** open a Settings/Preferences area — today only owner/admin/manager see it, so they have no way to change theme, density, notifications, or update their own password.

---

## 1. Loader redesign (`src/components/ui/gym-loader.tsx`)

Replace the flat SVG dumbbell with a more polished, theme-aware loader:

- Soft circular orbit: a faint primary-tinted ring + a smaller arc spinning on top using `border-t-primary border-transparent` and `animate-spin`.
- Inside the ring: a small dumbbell glyph that gently bounces (keep the dumbbell identity, but smaller and centered).
- Use semantic tokens only (`primary`, `accent`, `muted-foreground`, `card`) — no hardcoded blue/orange.
- Add a subtle pulsing glow behind the ring using `bg-primary/10 blur-2xl`.
- Text: keep `animate-pulse`, but switch to `text-foreground/70`, tighter letter spacing.
- Sizes (`sm`/`md`/`lg`) and the existing `text` prop stay backwards compatible.

Side effect: every full-page loader (`DashboardRedirect`, `SetPassword`, `ProtectedRoute`, etc.) automatically picks up the new look.

## 2. Set Password screen redesign

`src/pages/SetPassword.tsx`:
- Drop the dark navy `--gradient-hero` background. Use the same soft, themed background pattern as `Auth.tsx` (split layout or subtle ambient gradient using `from-background via-background to-primary/5`) with a couple of blurred primary/accent blobs for depth.
- Two-column layout on desktop (`lg:grid-cols-2`): left side = Incline brand panel with gradient, tagline ("Welcome to Incline. Let's secure your account."), and a small marketing illustration; right side = the form card. On mobile: single column, brand collapses to a header.
- Replace the standalone `<h1>Incline</h1>` above the card with the brand panel.

`src/components/auth/SetPasswordForm.tsx`:
- Card: `rounded-2xl border-0 shadow-xl shadow-primary/5 bg-card` (kill the green lock badge).
- Lock badge: `bg-primary/10 text-primary` (theme token), not raw green.
- Password requirements block: switch from green `text-success` ticks to a checklist where unmet items use `text-muted-foreground` + outline circle, met items use `text-primary` + filled `CheckCircle2`. Reorganize into a 2-col grid on `sm+` so it doesn't feel tall.
- Password strength meter: add a 4-segment bar above the requirements that fills based on how many rules pass (uses `bg-primary` / `bg-emerald-500` / `bg-amber-500` semantic mapping but driven by tokens).
- Inputs: keep shadcn defaults, add show/hide toggle to confirm field too.
- Submit button: `bg-primary` (not green), with the existing loader.

Verification: open `/set-password` route in the preview after the change to confirm parity with `/auth`.

## 3. Settings access for staff & trainer

Today, the only entry point for Settings is the admin nav item that points to `/settings` (owner/admin only). Staff/trainer have no way to change theme or notification preferences.

**Approach:** keep the full Settings page admin-only, but expose a **scoped personal preferences subset** to staff/trainer/manager.

Changes:

- **`src/config/menu.ts`**
  - Add a "Preferences" item to `staffMenuConfig`, `trainerMenuConfig`, and `managerMenuConfig` (under a "Account" / "Work" section): `{ label: 'Preferences', href: '/settings?tab=appearance', icon: Settings, roles: [...] }`.
  - Adjust admin "Settings" entry to keep current behaviour.

- **`src/pages/Settings.tsx`**
  - Read current user roles via `useAuth()`.
  - Define a `PERSONAL_TABS` whitelist: `appearance`, `notifications`, plus a new `profile` tab pointing to a lightweight "My Profile & Password" component (reuse existing `Profile.tsx` building blocks or a minimal change-password card).
  - If the user is NOT owner/admin/manager, filter `SETTINGS_MENU` down to `PERSONAL_TABS` and force the default tab to `appearance` when an out-of-scope tab is requested.
  - Update the page header copy: show "Preferences" instead of "Settings" for non-admin roles.

- **`src/components/auth/ProtectedRoute.tsx` (or wherever `/settings` is gated)**
  - Allow `staff` and `trainer` (in addition to admin/owner/manager) to reach `/settings`. Server-side data is already RLS-scoped, and the page-level filter above prevents them from seeing admin tabs.

- **`src/components/settings/ThemePicker.tsx` & `NotificationSettings.tsx`** — quick audit only: confirm they don't make any admin-only API calls. If they do, add a role guard and hide the offending controls (e.g., notification rules) for non-admins, leaving only personal preferences (own email/sms/whatsapp toggles).

## 4. Verification

After implementation:
- Load `/set-password` (when `mustSetPassword=true`) and `/auth` side-by-side — visual language should match.
- Trigger `isLoading` (e.g., reload `/dashboard`) — confirm new loader animates smoothly in light + dark themes.
- Log in as a staff user → sidebar shows "Preferences" → `/settings?tab=appearance` opens with Appearance / Notifications / Profile only, no admin tabs leaked.
- Log in as a trainer → same scoped Preferences experience.
- Log in as owner → full Settings menu unchanged.

## Files touched

- `src/components/ui/gym-loader.tsx` (rewrite visuals)
- `src/pages/SetPassword.tsx` (layout + background)
- `src/components/auth/SetPasswordForm.tsx` (card, badge, checklist, strength meter, confirm toggle)
- `src/config/menu.ts` (add Preferences to staff/trainer/manager menus)
- `src/pages/Settings.tsx` (role-based tab filtering + header copy + Profile tab)
- `src/components/auth/ProtectedRoute.tsx` (allow staff/trainer on `/settings`)
- `src/components/settings/NotificationSettings.tsx` (role-aware hide of admin-only sections, only if needed)

No DB migrations, no business-logic changes.
