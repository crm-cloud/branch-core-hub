

# Fix: Auth Page Stuck on Spinner + Gym-Themed Loading Animation

## Root Cause

The `/auth` page shows a spinner while **two conditions** are both true: `isLoading` (from AuthContext) and `checkingSetup` (from the `check-setup` backend function call). The backend function call at line 27 of `Auth.tsx` has **no timeout**. If the backend function is slow (cold start) or the backend service is restarting (confirmed from logs -- the auth service had just restarted at 11:51:00Z), the call hangs indefinitely and the spinner never resolves.

Additionally, the `AuthContext` `isLoading` starts as `true` and only becomes `false` after `getSession()` resolves. If the backend is temporarily unavailable, this also hangs.

## Fix 1: Add Timeout to `check-setup` Call

In `src/pages/Auth.tsx`, wrap the edge function invocation with a timeout (5 seconds). If the call takes longer, default to `needsSetup = false` (assume setup is done) and let the user proceed to the login form.

```typescript
const checkSetup = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const { data, error } = await supabase.functions.invoke('check-setup', {
      signal: controller.signal as any,
    });
    clearTimeout(timeout);
    
    if (error) throw error;
    if (data?.needsSetup) setNeedsSetup(true);
  } catch (error) {
    console.error('Setup check failed:', error);
    // On timeout/error, assume setup is done -- show login form
  } finally {
    setCheckingSetup(false);
  }
};
```

## Fix 2: Add Timeout to Auth Loading State

In `src/contexts/AuthContext.tsx`, add a safety timeout (8 seconds) so `isLoading` never stays `true` forever:

```typescript
// After the getSession call, add a fallback timeout
useEffect(() => {
  const timeout = setTimeout(() => {
    if (isLoading) setIsLoading(false);
  }, 8000);
  return () => clearTimeout(timeout);
}, [isLoading]);
```

## Fix 3: Replace Spinner with Gym-Themed Dumbbell Animation

Replace all `Loader2 animate-spin` loading indicators across the auth flow with a custom animated dumbbell SVG component.

**Create `src/components/ui/gym-loader.tsx`** -- a reusable component featuring:
- An SVG dumbbell that bounces up and down with a subtle rotation
- "Loading..." text with a pulsing opacity animation
- Uses CSS `@keyframes` for smooth animation (bounce + slight tilt)

**Visual:**
```text
     ╔═══╗━━━━━╔═══╗
     ║   ║     ║   ║    ← bouncing dumbbell
     ╚═══╝━━━━━╚═══╝
       Loading...        ← pulsing text
```

**Animation keyframes (added to `src/index.css`):**
- `dumbbell-bounce`: translateY(0) → translateY(-12px) → translateY(0) over 1s ease-in-out infinite
- `dumbbell-tilt`: subtle rotate(-5deg) → rotate(5deg) synced with bounce

**Files to update:**
- `src/pages/Auth.tsx` (lines 54-58) -- replace `Loader2` with `GymLoader`
- `src/pages/SetPassword.tsx` (lines 8-11) -- replace loading spinner
- `src/components/auth/ProtectedRoute.tsx` -- replace loading spinner
- `src/components/auth/DashboardRedirect.tsx` -- replace loading spinner

## Execution Summary

| File | Change |
|------|--------|
| `src/components/ui/gym-loader.tsx` | **New** -- Animated dumbbell SVG loader component |
| `src/index.css` | Add `@keyframes dumbbell-bounce` and `dumbbell-tilt` |
| `src/pages/Auth.tsx` | Add 5s timeout to `check-setup`, use `GymLoader` |
| `src/contexts/AuthContext.tsx` | Add 8s safety timeout for `isLoading` |
| `src/pages/SetPassword.tsx` | Replace `Loader2` with `GymLoader` |
| `src/components/auth/ProtectedRoute.tsx` | Replace `Loader2` with `GymLoader` |
| `src/components/auth/DashboardRedirect.tsx` | Replace `Loader2` with `GymLoader` |

