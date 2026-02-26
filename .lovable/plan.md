

# Global Error Boundary + AI Prompt Generator

## 1. Database: `error_logs` Table

Create a new table with the following schema:

```sql
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  error_message text NOT NULL,
  stack_trace text,
  component_name text,
  route text,
  browser_info text,
  status text NOT NULL DEFAULT 'open',  -- 'open' or 'resolved'
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);
```

RLS: Admin/owner read+update access only. Insert allowed for all authenticated users (so the error boundary can log). A validation trigger enforces status values.

## 2. Frontend: Enhanced Error Boundary

**Current state:** `ErrorBoundary` exists at `src/components/common/ErrorBoundary.tsx` and wraps the entire app in `App.tsx` (line 111). It catches errors and shows a fallback UI but does NOT log to the database.

**Changes to `ErrorBoundary.tsx`:**
- In `componentDidCatch`, add a silent `supabase.from('error_logs').insert(...)` call that captures:
  - `error.message`
  - `error.stack`
  - `errorInfo.componentStack` as `component_name`
  - `window.location.pathname` as `route`
  - `navigator.userAgent` as `browser_info`
  - Current user ID from a passed prop or `supabase.auth.getUser()`
- The insert is fire-and-forget (wrapped in try/catch to never cause a secondary crash)
- The fallback UI text changes to: "Oops! Something went wrong. Our team has been notified."

## 3. Admin UI: System Health Page

**New file:** `src/pages/SystemHealth.tsx`

**Layout:**
- Stat cards at top: Total Errors, Open Errors, Resolved, Errors Today
- Data table listing all errors with columns: Time, Route, Error Message, Status, Actions
- Filter tabs: All | Open | Resolved
- Each row has a "View" button

**Detail Drawer** (right-side sheet, per project standards):
- Error message, route, component stack, browser info, timestamp
- Full stack trace in a scrollable `<pre>` block
- "Mark Resolved" button (updates status to `'resolved'`)
- **"Generate AI Fix Prompt" button:**
  - Populates a `<Textarea>` with the template:
    ```
    I have an error in my React application. The component crashed at route: [Route]. The error message is: [Error Message]. Here is the stack trace: [Stack Trace]. Please audit the relevant components and provide the code to fix this issue.
    ```
  - "Copy to Clipboard" button next to the textarea

**Route:** `/system-health` accessible to `owner` and `admin` roles only.

**Sidebar:** Add "System Health" item under "Admin & HR" section in `adminMenuConfig` with the `Activity` icon.

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Migration | SQL | Create `error_logs` table + RLS policies |
| Edit | `src/components/common/ErrorBoundary.tsx` | Add silent DB logging in `componentDidCatch` |
| New | `src/pages/SystemHealth.tsx` | Admin error dashboard with detail drawer + prompt generator |
| Edit | `src/App.tsx` | Add `/system-health` route |
| Edit | `src/config/menu.ts` | Add "System Health" to admin sidebar |

