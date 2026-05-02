# RLS persona test suite

These pgTAP-style scripts assert that Row-Level Security policies behave
correctly under different personas. They are designed to run against a
**non-production** database (DR Project B, a local Supabase, or a
disposable preview branch).

## Running

```bash
psql "$DR_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/cross_branch_isolation.sql
```

Each file wraps its assertions in `BEGIN; ... ROLLBACK;` so it leaves no
residue. A `RAISE EXCEPTION` aborts the transaction and exits non-zero,
which CI treats as a failure.

## What's covered

- `cross_branch_isolation.sql` — verifies that:
  - `current_branch()` resolves the JWT `branch_id` claim
  - `enforce_branch_match()` denies access to a foreign branch
  - A random authenticated user cannot read invoices belonging to other
    branches via direct table access

## What to add next (P0 wave 3)

- `payments_isolation.sql` — same pattern for `payments`, `wallet_transactions`
- `attendance_isolation.sql` — `attendance`, `staff_attendance`
- `member_self_service.sql` — member can read own invoices/benefits, not others'
- `gender_locked_facilities.sql` — assert booking on a gender-locked
  facility from a non-matching member raises
- `dr_freeze.sql` — assert `dr_block_writes` blocks `service_role` writes
  unless `app.dr_restore = true`

These should be added as separate scripts and wired into `.github/workflows/ci.yml`
to run only against `DR_DB_URL` (the standby), never the primary.
