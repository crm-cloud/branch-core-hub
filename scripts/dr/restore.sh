#!/usr/bin/env bash
# scripts/dr/restore.sh — Restore a backup into the DR Supabase project.
#
# Order matters: auth → storage metadata → public data.
# Sets app.dr_restore=true within each transaction so the dr_block_writes
# trigger lets these writes through even if dr_mode is enabled on B.
#
# Required env:
#   DR_DB_URL                Postgres URL for DR project
#   DUMP_DIR                 Local directory containing public.sql, auth.sql, storage.sql, storage-objects/
#   DR_PROJECT_REF           DR project ref (for storage cp)
#
# Safety: requires --i-understand-this-overwrites to run.

set -euo pipefail

if [[ "${1:-}" != "--i-understand-this-overwrites" ]]; then
  echo "Refusing to run without --i-understand-this-overwrites flag." >&2
  exit 2
fi

: "${DR_DB_URL:?missing}"
: "${DUMP_DIR:?missing}"
: "${DR_PROJECT_REF:?missing}"

run_sql_file() {
  local file="$1"
  echo "==> Restoring ${file}"
  # Wrap the dump in a transaction that opts in to dr_restore.
  {
    echo "BEGIN;"
    echo "SET LOCAL app.dr_restore = 'true';"
    cat "${file}"
    echo "COMMIT;"
  } | psql "${DR_DB_URL}" -v ON_ERROR_STOP=1 --single-transaction=false
}

echo "==> Step 1/3: auth schema"
run_sql_file "${DUMP_DIR}/auth.sql"

echo "==> Step 2/3: storage metadata"
run_sql_file "${DUMP_DIR}/storage.sql"

echo "==> Step 3/3: public data"
run_sql_file "${DUMP_DIR}/public.sql"

echo "==> Mirroring storage object bytes back into DR project buckets"
for BUCKET_DIR in "${DUMP_DIR}/storage-objects"/*/; do
  B=$(basename "${BUCKET_DIR}")
  echo "    bucket: ${B}"
  supabase storage cp -r "${BUCKET_DIR}" "ss:///${B}" --project-ref "${DR_PROJECT_REF}" || true
done

echo "==> Restore complete. Now run scripts/dr/verify.sh."
