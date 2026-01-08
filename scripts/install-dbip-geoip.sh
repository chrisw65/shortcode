#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${TARGET_DIR:-/etc/shortlink/geoip}"
MONTH_TAG="${1:-$(date +%Y-%m)}"
URL="https://download.db-ip.com/free/dbip-city-lite-${MONTH_TAG}.mmdb.gz"
OUT_FILE="${TARGET_DIR}/DBIP-City.mmdb"

mkdir -p "${TARGET_DIR}"

echo "==> Downloading ${URL}"
curl -fL "${URL}" -o "${OUT_FILE}.gz"

echo "==> Extracting to ${OUT_FILE}"
gunzip -f "${OUT_FILE}.gz"

echo "==> Done"
