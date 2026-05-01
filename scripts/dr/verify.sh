#!/usr/bin/env bash
# scripts/dr/verify.sh — Compare primary vs DR after a restore.
# Validates: critical-table row counts AND SHA-256 of every storage object.
#
# Required env:
#   PRIMARY_DB_URL, DR_DB_URL
#   PRIMARY_PROJECT_REF, DR_PROJECT_REF
#   DR_BUCKET           DR mirror bucket containing the manifest + objects to compare

set -euo pipefail

: "${PRIMARY_DB_URL:?}"
: "${DR_DB_URL:?}"
: "${PRIMARY_PROJECT_REF:?}"
: "${DR_PROJECT_REF:?}"
: "${DR_BUCKET:?}"

TABLES=(
  invoices payments memberships member_attendance staff_attendance
  rewards_ledger wallet_transactions benefit_bookings benefit_usage
  referrals lockers approval_requests ecommerce_orders
)

FAIL=0

echo "==> Row-count diff"
for T in "${TABLES[@]}"; do
  P=$(psql "${PRIMARY_DB_URL}" -At -c "SELECT count(*) FROM public.${T};")
  D=$(psql "${DR_DB_URL}" -At -c "SELECT count(*) FROM public.${T};")
  if [[ "$P" != "$D" ]]; then
    echo "MISMATCH ${T}: primary=${P} dr=${D}" ; FAIL=1
  else
    echo "ok ${T} (${P})"
  fi
done

echo "==> auth.users count"
P=$(psql "${PRIMARY_DB_URL}" -At -c "SELECT count(*) FROM auth.users;")
D=$(psql "${DR_DB_URL}" -At -c "SELECT count(*) FROM auth.users;")
if [[ "$P" != "$D" ]]; then echo "MISMATCH auth.users: primary=${P} dr=${D}"; FAIL=1; else echo "ok auth.users (${P})"; fi

echo "==> Storage object SHA-256 diff"
WORK=$(mktemp -d)
mkdir -p "${WORK}/p" "${WORK}/d"
BUCKETS=$(supabase storage ls --project-ref "${PRIMARY_PROJECT_REF}" --json | jq -r '.[].name')
for B in $BUCKETS; do
  supabase storage cp -r "ss:///${B}" "${WORK}/p/${B}" --project-ref "${PRIMARY_PROJECT_REF}" >/dev/null 2>&1 || true
  supabase storage cp -r "ss:///${B}" "${WORK}/d/${B}" --project-ref "${DR_PROJECT_REF}"      >/dev/null 2>&1 || true

  ( cd "${WORK}/p/${B}" 2>/dev/null && find . -type f -print0 | xargs -0 sha256sum 2>/dev/null | sort -k 2 ) > "${WORK}/p-${B}.sums" || true
  ( cd "${WORK}/d/${B}" 2>/dev/null && find . -type f -print0 | xargs -0 sha256sum 2>/dev/null | sort -k 2 ) > "${WORK}/d-${B}.sums" || true

  if ! diff -q "${WORK}/p-${B}.sums" "${WORK}/d-${B}.sums" >/dev/null; then
    echo "MISMATCH bucket ${B}:"
    diff "${WORK}/p-${B}.sums" "${WORK}/d-${B}.sums" | head -20
    FAIL=1
  else
    echo "ok bucket ${B}"
  fi
done

rm -rf "${WORK}"
if [[ "${FAIL}" -ne 0 ]]; then
  echo "VERIFY FAILED" >&2
  exit 1
fi
echo "VERIFY PASSED"
