
Goal: make the MIPS flow truly testable end-to-end and fix the broken sync path before marking anything complete.

What I found
- The current 500 error is real and reproducible from logs: `sync-to-mips` is getting HTML 404 pages from MIPS, not JSON.
- The main cause is architectural: both `mips-proxy` and `sync-to-mips` strip the `/MIPS` path from `MIPS_SERVER_URL` and call only `protocol//host`. Your uploaded manuals show the Smart Pass app is served under `/MIPS`, so the current code is likely hitting the wrong endpoint base.
- `sync-to-mips` is also guessing the add-person endpoint (`/admin/person/employees/save`, then `/api/person/add`) without a verified contract from the docs.
- The stack-overflow/base64 issue appears already addressed in code.
- The Dashboard source already polls every 15s and has heartbeat UI/offline notification logic. If you still see old “Local (Supabase)” UI, that is likely stale build/cache or another remaining renderer not yet found in current source.
- The Debug tab only tests raw reads through the proxy. It does not currently prove end-to-end personnel sync or webhook receipt, so “debug works” = only partially.

Plan
1. Audit and lock the correct MIPS API contract
- Read the uploaded manuals specifically for:
  - exact API base path (`/MIPS` vs root)
  - exact add-person endpoint
  - required request content type
  - required parameter names for face/base64 upload
  - expected success response fields
- Stop guessing endpoints in `sync-to-mips`.

2. Refactor MIPS URL handling
- Centralize URL construction in both `mips-proxy` and `sync-to-mips`.
- Preserve the configured path from `MIPS_SERVER_URL` instead of stripping to host-only.
- Only auth token generation should use the documented auth path; all business endpoints should use the verified application base path.

3. Fix `sync-to-mips` request payload
- Build the payload exactly to MIPS spec from the manuals.
- Match field names for:
  - person code/id
  - name
  - phone/department if required
  - expiry/access dates
  - face image base64 field
- Support the correct content type required by MIPS (`application/json` or form-urlencoded), based on docs rather than fallback guesses.
- Improve error logging so logs include:
  - final URL used
  - content type used
  - sanitized payload shape
  - parsed response/error body

4. Add real manual sync verification flow
- Add a dedicated “Manual Sync Test” path in Debug that:
  - selects one member/employee with photo
  - invokes `sync-to-mips`
  - immediately queries MIPS personnel list afterward
  - shows whether the synced person is actually present in MIPS
- This makes Debug useful for real E2E verification, not just raw endpoint reads.

5. Tighten Personnel Sync UX
- Show clearer statuses:
  - Pending
  - Syncing
  - Synced to MIPS
  - Failed: endpoint/path issue
  - Failed: missing photo
- Surface the last sync error inline so admins don’t need Cloud logs for every failure.
- Keep bulk sync, but make it skip clearly invalid records and summarize exact failures.

6. Validate Dashboard/Devices/Live Feed tabs
- Dashboard: keep MIPS as single source of truth; confirm only MIPS stats remain.
- Devices: verify online/offline comes only from MIPS status.
- Personnel Sync: verify sync button actually results in MIPS-side person creation.
- Live Feed: verify webhook records land in `access_logs` and member/staff matching works.
- Debug: extend it to true sync and webhook checks.

7. Offline monitoring cleanup
- Keep the 15s poll and heartbeat animation.
- Verify offline notification is only sent on status transition, not every poll.
- Expand recipients from only owner/admin if you want managers included too.

8. End-to-end completion criteria
I would only mark this complete after all of these pass:
- A manual sync of one member with photo succeeds
- The same person appears in MIPS personnel data immediately after sync
- Bulk sync processes remaining valid members/staff
- Dashboard device count/online count match MIPS
- A real or simulated face scan reaches `mips-webhook-receiver`
- Live Feed shows the event
- Member/staff attendance updates correctly
- Debug tab proves the above with visible results

Files I would update
- `supabase/functions/sync-to-mips/index.ts`
- `supabase/functions/mips-proxy/index.ts`
- `src/components/devices/PersonnelSyncTab.tsx`
- `src/pages/DeviceManagement.tsx`
- `src/components/devices/MIPSDashboard.tsx` (only if stale/local stats source is still found)

Expected outcome
- No more guessed MIPS endpoints
- No more host-only URL bug
- Real manual sync testing from inside the app
- Debug tab becomes genuinely useful
- Completion based on verified sync between members and device/MIPS, not just UI state
