

# Audit: Staff & Trainer Workflows + Auth Page Redesign

## Part 1: Staff & Trainer Workflow Audit

### Issues Found

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | `pt_sessions` query uses `member:members(...)` but `pt_sessions` has no `member_id` FK — only `member_pt_package_id`. This breaks the Trainer Dashboard's "Today's Sessions" widget. | `src/hooks/useMemberData.ts` line 333 | High |
| 2 | `ScheduleSession.tsx` uses `clients` (alias for `ptClients`) — trainers can only schedule sessions for PT clients, not general clients. Missing ability to schedule for general training clients. | `src/pages/ScheduleSession.tsx` | Low (by design) |
| 3 | `OtpLoginForm` navigates to `/dashboard` on success instead of going through the role-based redirect (`/home`). Staff/Trainer logging in via Email OTP will always land on admin dashboard. | `src/components/auth/OtpLoginForm.tsx` line 63 | High |
| 4 | `PhoneOtpLoginForm` has no redirect at all after successful OTP — relies on `onAuthStateChange` to trigger re-render, but the Auth page redirect logic checks `roles` which may not be populated yet. | `src/components/auth/PhoneOtpLoginForm.tsx` | Medium |
| 5 | Trainer quick-action cards missing `rounded-2xl` class (Vuexy design standard). | `src/pages/TrainerDashboard.tsx` lines 105-127 | Low |
| 6 | Staff menu includes "Follow-Up Center" but there's no "Benefit Tracking" link for facilities usage — staff can view it but have to navigate manually. Already present in menu config. | Menu config | None (already there) |

### Fixes

**Fix 1 — pt_sessions query**: Change the today's sessions query to join through `member_pt_packages` instead of direct `member:members`:
```
pt_sessions → member_pt_packages → members → profiles
```

**Fix 3 — OTP redirect**: Change `navigate('/dashboard')` to `navigate('/home')` to use the DashboardRedirect/Gatekeeper flow for proper role-based routing.

**Fix 4 — Phone OTP redirect**: Add `navigate('/home')` after successful phone OTP verification.

**Fix 5 — Card rounding**: Add `rounded-2xl` to trainer quick-action cards.

## Part 2: Auth Page Redesign

### Current Problems
- Three tabs (Password, Email OTP, Phone OTP) create a cramped, confusing layout
- Each tab is a separate component with its own card/header styling creating visual noise
- OTP forms navigate to wrong dashboards
- The page uses `glass-card` styling that feels dated

### New Design: Single-Page Login

Replace the tabbed login card with a clean, single-page layout:

```text
┌──────────────────────────────────────────────────┐
│                                                  │
│     ┌──────────────────────────────────────┐     │
│     │                                      │     │
│     │          [Incline Logo]               │     │
│     │     "Welcome back to Incline"         │     │
│     │     "Sign in to manage your gym"      │     │
│     │                                      │     │
│     │  ┌──────────────────────────────────┐ │     │
│     │  │  📧 Email                        │ │     │
│     │  └──────────────────────────────────┘ │     │
│     │  ┌──────────────────────────────────┐ │     │
│     │  │  🔒 Password                  👁  │ │     │
│     │  └──────────────────────────────────┘ │     │
│     │                                      │     │
│     │  [ ━━━━━ Sign In ━━━━━━━━━━━━━━━━ ] │     │
│     │                                      │     │
│     │  ─────── or continue with ────────  │     │
│     │                                      │     │
│     │  [ 📧 Email OTP ]  [ 📱 Phone OTP ] │     │
│     │                                      │     │
│     │       Forgot password? Reset here     │     │
│     └──────────────────────────────────────┘     │
│                                                  │
│              Powered by Incline                  │
└──────────────────────────────────────────────────┘
```

Key design decisions:
- Password login is the primary (default) form — always visible
- Email OTP and Phone OTP are secondary methods shown as outlined buttons below a divider
- Clicking "Email OTP" or "Phone OTP" transitions the card to that flow (replaces password form)
- A back arrow returns to the default password form
- Premium Vuexy styling: `rounded-2xl`, soft shadow, gradient background, vibrant accent button
- Single Card component, no nested tabs
- Forgot password link stays at bottom

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Redesign layout with premium styling, better spacing |
| `src/components/auth/LoginForm.tsx` | Complete rewrite — single-page with mode switcher instead of tabs |
| `src/components/auth/OtpLoginForm.tsx` | Fix redirect: `/dashboard` → `/home`. Remove outer Card wrapper (now inline). |
| `src/components/auth/PhoneOtpLoginForm.tsx` | Add `navigate('/home')` on successful verify |
| `src/hooks/useMemberData.ts` | Fix pt_sessions query to join via `member_pt_packages` |
| `src/pages/TrainerDashboard.tsx` | Add `rounded-2xl` to quick-action cards |

