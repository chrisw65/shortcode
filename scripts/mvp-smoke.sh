#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${EMAIL:-smoke+$(date +%s)@example.com}"
PASSWORD="${PASSWORD:-pass1234}"

echo "==> Smoke test against ${BASE_URL}"

echo "==> Healthcheck"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT
curl -fsS -c "${COOKIE_JAR}" "${BASE_URL}/health" >/dev/null
CSRF_TOKEN="$(awk '/csrf_token/ {print $NF}' "${COOKIE_JAR}" | tail -n1)"
if [[ -z "${CSRF_TOKEN}" ]]; then
  echo "Missing CSRF token cookie."
  exit 1
fi

echo "==> Register user"
REGISTER_JSON=$(curl -fsS -X POST "${BASE_URL}/api/auth/register" \
  -b "${COOKIE_JAR}" \
  ${RATE_LIMIT_BYPASS_TOKEN:+-H "x-rate-bypass: ${RATE_LIMIT_BYPASS_TOKEN}"} \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

if command -v jq >/dev/null 2>&1; then
  TOKEN="$(printf '%s' "${REGISTER_JSON}" | jq -r '.data.token // .token // empty')"
else
  TOKEN="$(printf '%s' "${REGISTER_JSON}" | sed -n 's/.*"token":"\\([^"]*\\)".*/\\1/p')"
fi
if [[ -z "${TOKEN}" ]]; then
  echo "Register did not return token. Response:"
  echo "${REGISTER_JSON}"
  exit 1
fi

echo "==> Create link"
CREATE_JSON=$(curl -fsS -X POST "${BASE_URL}/api/links" \
  -H "Authorization: Bearer ${TOKEN}" \
  ${RATE_LIMIT_BYPASS_TOKEN:+-H "x-rate-bypass: ${RATE_LIMIT_BYPASS_TOKEN}"} \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","title":"Smoke Test"}')

if command -v jq >/dev/null 2>&1; then
  SHORT_CODE="$(printf '%s' "${CREATE_JSON}" | jq -r '.data.short_code // empty')"
else
  SHORT_CODE="$(printf '%s' "${CREATE_JSON}" | sed -n 's/.*"short_code":"\\([^"]*\\)".*/\\1/p')"
fi
if [[ -z "${SHORT_CODE}" ]]; then
  echo "Create link did not return short_code. Response:"
  echo "${CREATE_JSON}"
  exit 1
fi

echo "==> Redirect check"
curl -fsS -I "${BASE_URL}/${SHORT_CODE}" \
  ${RATE_LIMIT_BYPASS_TOKEN:+-H "x-rate-bypass: ${RATE_LIMIT_BYPASS_TOKEN}"} >/dev/null

echo "==> QR check"
curl -fsS "${BASE_URL}/api/qr/${SHORT_CODE}.png" >/dev/null
curl -fsS "${BASE_URL}/api/qr/${SHORT_CODE}.svg" >/dev/null

echo "==> Analytics summary"
curl -fsS "${BASE_URL}/api/analytics/summary" \
  -H "Authorization: Bearer ${TOKEN}" \
  ${RATE_LIMIT_BYPASS_TOKEN:+-H "x-rate-bypass: ${RATE_LIMIT_BYPASS_TOKEN}"} >/dev/null

echo "==> OK"
