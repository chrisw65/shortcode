#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-oakleaf}"
IMAGE_NAME="${IMAGE_NAME:-shortlink-mvp}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY_URL="${REGISTRY_URL:-registry.digitalocean.com}"
IMAGE_FQN="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"

DROPLET_HOST="${DROPLET_HOST:-$(cat .droplet_ip 2>/dev/null || true)}"
DROPLET_SSH_USER="${DROPLET_SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-}"

# ─────────────────────────────────────────────────────────────────────────────
# Checks
# ─────────────────────────────────────────────────────────────────────────────
if [[ -z "${DROPLET_HOST}" ]]; then
  echo "ERROR: DROPLET_HOST not set and .droplet_ip not found."; exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 1) Build locally
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Building image: ${IMAGE_NAME}:${IMAGE_TAG}"
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

# ─────────────────────────────────────────────────────────────────────────────
# 2) Login & push to DOCR
# ─────────────────────────────────────────────────────────────────────────────
echo "==> doctl registry login"
doctl registry login

echo "==> Tagging: ${IMAGE_FQN}"
docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${IMAGE_FQN}"

echo "==> Pushing: ${IMAGE_FQN}"
docker push "${IMAGE_FQN}"

# ─────────────────────────────────────────────────────────────────────────────
# 3) Trigger deploy on droplet (systemd service runs /root/remote-deploy.sh)
# ─────────────────────────────────────────────────────────────────────────────
SSH_BASE=(-o StrictHostKeyChecking=accept-new)
[[ -n "${SSH_KEY}" ]] && SSH_BASE+=(-i "${SSH_KEY}")

echo "==> Triggering systemd redeploy on ${DROPLET_HOST}"
ssh "${SSH_BASE[@]}" "${DROPLET_SSH_USER}@${DROPLET_HOST}" bash -s <<'EOF'
set -euo pipefail
systemctl restart shortlink.service
systemctl status shortlink.service --no-pager -l || true
EOF

echo "==> Deploy complete."

