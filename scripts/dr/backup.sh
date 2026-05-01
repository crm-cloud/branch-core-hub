#!/usr/bin/env bash
# scripts/dr/backup.sh — Logical backup of the primary Supabase project.
#
# Runs OUTSIDE Supabase Edge (CLI-based). Requires the Supabase CLI on PATH.
#
# Required env (provide via your CI/vault — never store in repo):
#   SUPABASE_ACCESS_TOKEN     Supabase personal access token
#   PRIMARY_PROJECT_REF       Primary project ref (e.g. iyqqpbvnszyrrgerniog)
#   DR_PROJECT_REF            DR project ref (used for storage mirror upload)
#   DR_BUCKET                 Bucket on DR project to receive dumps + objects
#   PRIMARY_DB_URL            Postgres connection string for primary (service role / direct)
#
# Output (to ./_dr-out/<timestamp>/):
#   - public.sql          public schema + data (excludes migration metadata)
#   - auth.sql            auth schema + data (users, identities, mfa, sessions metadata)
#   - storage.sql         storage schema + data (object metadata only)
#   - storage-objects/    actual object bytes mirrored from each bucket
#   - manifest.json       row counts, sha256 per file, started_at / finished_at

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?missing}"
: "${PRIMARY_PROJECT_REF:?missing}"
: "${DR_PROJECT_REF:?missing}"
: "${DR_BUCKET:?missing}"
: "${PRIMARY_DB_URL:?missing}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="./_dr-out/${TS}"
mkdir -p "${OUT}/storage-objects"

echo "==> [${TS}] Linking primary project ${PRIMARY_PROJECT_REF}"
supabase link --project-ref "${PRIMARY_PROJECT_REF}" >/dev/null

echo "==> Dumping public schema"
supabase db dump --db-url "${PRIMARY_DB_URL}" --schema public --data-only -f "${OUT}/public.sql"

echo "==> Dumping auth schema (schema + data)"
supabase db dump --db-url "${PRIMARY_DB_URL}" --schema auth -f "${OUT}/auth.sql"

echo "==> Dumping storage schema (object metadata)"
supabase db dump --db-url "${PRIMARY_DB_URL}" --schema storage -f "${OUT}/storage.sql"

echo "==> Mirroring storage object bytes"
# List buckets and copy contents of each to local then to DR project bucket.
BUCKETS=$(supabase storage ls --project-ref "${PRIMARY_PROJECT_REF}" --json | jq -r '.[].name')
for B in $BUCKETS; do
  echo "    bucket: ${B}"
  mkdir -p "${OUT}/storage-objects/${B}"
  supabase storage cp -r "ss:///${B}" "${OUT}/storage-objects/${B}" \
    --project-ref "${PRIMARY_PROJECT_REF}" || true
  # Push to DR project bucket under timestamped prefix.
  supabase storage cp -r "${OUT}/storage-objects/${B}" "ss:///${DR_BUCKET}/${TS}/${B}" \
    --project-ref "${DR_PROJECT_REF}" || true
done

echo "==> Computing checksums + row counts"
{
  echo "{"
  echo "  \"started_at\": \"${TS}\","
  echo "  \"primary_ref\": \"${PRIMARY_PROJECT_REF}\","
  echo "  \"files\": {"
  FIRST=1
  for F in public.sql auth.sql storage.sql; do
    SHA=$(sha256sum "${OUT}/${F}" | awk '{print $1}')
    SIZE=$(stat -c%s "${OUT}/${F}" 2>/dev/null || stat -f%z "${OUT}/${F}")
    [[ $FIRST -eq 1 ]] || echo ","
    printf '    "%s": { "sha256": "%s", "bytes": %s }' "$F" "$SHA" "$SIZE"
    FIRST=0
  done
  echo ""
  echo "  },"
  echo "  \"row_counts\": $(psql "${PRIMARY_DB_URL}" -At -c "
    SELECT json_object_agg(table_name, n)::text FROM (
      SELECT 'invoices' AS table_name, count(*) n FROM public.invoices UNION ALL
      SELECT 'payments', count(*) FROM public.payments UNION ALL
      SELECT 'memberships', count(*) FROM public.memberships UNION ALL
      SELECT 'member_attendance', count(*) FROM public.member_attendance UNION ALL
      SELECT 'staff_attendance', count(*) FROM public.staff_attendance UNION ALL
      SELECT 'rewards_ledger', count(*) FROM public.rewards_ledger UNION ALL
      SELECT 'wallet_transactions', count(*) FROM public.wallet_transactions UNION ALL
      SELECT 'benefit_bookings', count(*) FROM public.benefit_bookings UNION ALL
      SELECT 'lockers', count(*) FROM public.lockers UNION ALL
      SELECT 'auth_users_count', count(*) FROM auth.users
    ) q;"),
  echo "  \"finished_at\": \"$(date -u +%Y%m%dT%H%M%SZ)\""
  echo "}"
} > "${OUT}/manifest.json"

echo "==> Uploading manifest"
supabase storage cp "${OUT}/manifest.json" "ss:///${DR_BUCKET}/${TS}/manifest.json" \
  --project-ref "${DR_PROJECT_REF}"

echo "==> DONE: ${OUT}"
