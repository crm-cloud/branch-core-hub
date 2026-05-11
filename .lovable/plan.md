# Fix Audit Logs Showing "Staff" Instead of Real Names

## Root Cause (confirmed in DB)

The trigger function `public.audit_log_trigger_function()` has **three bugs**:

1. **`actor_name` is never resolved.** The variable `actor_name_val` is declared but never assigned — it's inserted as `NULL` on every row. The frontend (`AuditLogs.tsx` line 264) then falls back to the literal string `"Staff"` whenever `user_id` is present but `actor_name` is null. Every recent log has `actor_name = NULL` even though `user_id` correctly points to Rajat Lekhari's profile.
2. **`action_description` is never generated.**
3. **`new_data` is never captured.** The INSERT writes `to_jsonb(OLD)` to `old_data` only — so on `INSERT`, `OLD` is null and `new_data` stays null; on `UPDATE`, the post-change snapshot is lost; the trigger also always `RETURN OLD`, which is wrong for `INSERT`.

Additionally, system/service-role writes (e.g. `register-member`, edge functions using service key) have `auth.uid() = NULL`, so they correctly show "System" — but ones routed through the user's JWT will now show the proper name.

## Fix

Replace `public.audit_log_trigger_function()` with a corrected version that:

- Resolves `actor_name` via:
  1. Optional GUC `current_setting('app.actor_name', true)` (lets edge functions running as service role pass the real actor)
  2. Else `profiles.full_name` joined on `auth.uid()`
  3. Else `auth.users.email` as final fallback
  4. Else leaves NULL (UI then shows "System")
- Captures `new_data = to_jsonb(NEW)` on INSERT/UPDATE and `old_data = to_jsonb(OLD)` on UPDATE/DELETE.
- Generates a short `action_description` like `Updated trainers row` / `Created employees row` / `Deleted members row` when none is supplied.
- Returns `NEW` on INSERT/UPDATE and `OLD` on DELETE.
- Keeps `SECURITY DEFINER` + pinned `search_path = public` and stays no-op safe (never throws — wraps name lookup in BEGIN/EXCEPTION).

No table schema change, no RLS change, no frontend change required — `AuditLogs.tsx` already reads `actor_name` correctly. Existing rows with NULL actor_name will keep showing "Staff" (historical data); all new audit rows will show the real name.

## Optional follow-up (not in this change)

A small UI tweak in `AuditLogs.tsx` line 264 to display "Unknown user" instead of "Staff" when `user_id` exists but `actor_name` is null — but with the trigger fixed this case stops happening for new rows, so we'll skip it unless you want it.

## Technical detail

Single migration: `CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()` with the corrected body. No trigger re-attachment needed (existing triggers continue to call the same function name).
