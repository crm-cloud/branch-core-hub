#!/usr/bin/env bash
# scripts/dr/smoke-login.sh — Prove auth restore worked on Supabase B.
# Creates a throwaway test user via the admin API, then attempts a sign-in
# using the anon key. Cleans up the user afterwards.
#
# Required env:
#   DR_SUPABASE_URL
#   DR_SUPABASE_ANON_KEY
#   DR_SERVICE_ROLE_KEY

set -euo pipefail

: "${DR_SUPABASE_URL:?}"
: "${DR_SUPABASE_ANON_KEY:?}"
: "${DR_SERVICE_ROLE_KEY:?}"

EMAIL="dr-smoke-$(date -u +%Y%m%d%H%M%S)@incline.test"
PASS="DrSmoke!$(openssl rand -hex 8)"

echo "==> Creating test user ${EMAIL}"
USER_JSON=$(curl -fsS -X POST "${DR_SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${DR_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${DR_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"email_confirm\":true}")

USER_ID=$(echo "$USER_JSON" | jq -r .id)
[[ -n "$USER_ID" && "$USER_ID" != "null" ]] || { echo "user create failed"; exit 1; }

echo "==> Signing in as ${EMAIL}"
LOGIN=$(curl -fsS -X POST "${DR_SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${DR_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")
TOKEN=$(echo "$LOGIN" | jq -r .access_token)
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || { echo "login failed"; exit 1; }

echo "==> Login OK. Cleaning up."
curl -fsS -X DELETE "${DR_SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: ${DR_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${DR_SERVICE_ROLE_KEY}" >/dev/null

echo "AUTH RESTORE SMOKE TEST: PASSED"
