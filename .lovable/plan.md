## Goal
Stop the recurring “Oops! Something went wrong” screen after inactivity, make recovery send authenticated users back to their dashboard instead of the public homepage, and replace the current route-revealing 404 page with a polished cosmic-style page.

## Findings
- The global `ErrorBoundary` currently uses `window.location.href = '/'`, so “Go Home” always opens the public landing page. If the session has expired, the user must manually go back to `/auth`.
- The app has an inactivity sign-out timer in `AuthContext`. After timeout it calls `supabase.auth.signOut()` directly, which can leave parts of the UI reacting to a suddenly removed session.
- The recently added presence heartbeat is mounted inside `AppLayout`. It tracks online state and calls `touch_presence()` every 60 seconds. This should be made defensive so failed/expired auth during inactivity cannot crash the app.
- The current 404 page prints the invalid route (`/incline`) and shows admin quick links. That is not ideal for a public-facing error page.
- `@radix-ui/react-slot` and `class-variance-authority` already exist. `cobe` and `framer-motion` are not installed yet, so they must be added if we implement the supplied cosmic 404 style.

## Implementation Plan

### 1. Make the inactivity flow safe
- Update `AuthContext` so the inactivity timeout uses the existing `signOut()` cleanup path rather than calling `supabase.auth.signOut()` directly.
- Add a small “session expired / signed out” redirect state where appropriate so users land on `/auth` cleanly instead of triggering the generic error page.
- Ensure query/cache cleanup happens consistently when the auth session becomes null.

### 2. Harden presence tracking after inactivity
- Update `usePresenceHeartbeat()` to:
  - avoid reconnecting repeatedly when `roles` object identity changes,
  - catch and ignore `touch_presence()` failures caused by expired sessions,
  - only track presence when the auth user is valid,
  - cleanly remove the realtime channel on logout/session expiry.
- Update `useOnlineUsers()` to fail gracefully if realtime presence is unavailable.

### 3. Improve ErrorBoundary recovery UX
- Replace the current “Go Home” behavior with role/session-aware navigation:
  - authenticated users: reset error and navigate to `/home` so `DashboardRedirect` chooses the correct dashboard,
  - unauthenticated users: go to `/auth`,
  - public-only errors: optionally go to `/` only when already on a public path.
- Keep “Try Again” but make it reset the boundary without changing route.
- Add a less alarming message for session-expired/auth-related crashes if detected.

### 4. Redesign the 404 page
- Add `src/components/ui/cosmic-404.tsx` based on the supplied `cobe` globe component, corrected for TypeScript (`Record<string, unknown>` / COBE render state typing) and proper JSX.
- Add the required dependencies: `cobe` and `framer-motion`.
- Replace `src/pages/NotFound.tsx` with a robust page that:
  - does not display the invalid route path,
  - uses the animated cosmic globe design,
  - has “Go Back” and “Go to dashboard/home” actions,
  - sends authenticated users to `/home` and unauthenticated users to `/`,
  - avoids admin quick links on public 404s.

### 5. Validate
- Verify `/audit-logs` loads without console errors.
- Verify logging out/inactivity-style unauthenticated access to `/audit-logs` redirects to `/auth` rather than crashing.
- Verify unknown routes like `/incline` show the redesigned 404 and do not reveal the typed route.
- Verify “Home” from error/404 sends logged-in users to their role dashboard and public visitors to the public homepage.