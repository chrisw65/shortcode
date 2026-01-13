#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT_DIR}/extension/manifest.json"
OUT_DIR="${ROOT_DIR}/public/extension"

VERSION="$(node -p "require('${MANIFEST}').version")"
ZIP_NAME="okleaf-extension-${VERSION}.zip"
LATEST_NAME="okleaf-extension.zip"

mkdir -p "${OUT_DIR}"
TMP_DIR="$(mktemp -d)"

cp -R "${ROOT_DIR}/extension"/* "${TMP_DIR}/"
rm -f "${TMP_DIR}/README.md"

(cd "${TMP_DIR}" && zip -qr "${ZIP_NAME}" .)

cp "${TMP_DIR}/${ZIP_NAME}" "${OUT_DIR}/${ZIP_NAME}"
cp "${TMP_DIR}/${ZIP_NAME}" "${OUT_DIR}/${LATEST_NAME}"

cat > "${OUT_DIR}/updates.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="okleaf-extension">
    <updatecheck codebase="https://okleaf.link/extension/${ZIP_NAME}" version="${VERSION}" />
  </app>
</gupdate>
EOF

echo "Built ${OUT_DIR}/${ZIP_NAME} and updated ${OUT_DIR}/${LATEST_NAME}"
