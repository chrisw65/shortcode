#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG — export/override as needed before running
# ─────────────────────────────────────────────────────────────────────────────
DROPLET_HOST="${DROPLET_HOST:-$(cat .droplet_ip 2>/dev/null || true)}"
DROPLET_SSH_USER="${DROPLET_SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-}"                                # optional: path to SSH key

# DO Container Registry (DOCR)
REGISTRY_URL="${REGISTRY_URL:-registry.digitalocean.com}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-oakleaf}"   # your namespace
IMAGE_NAME="${IMAGE_NAME:-shortlink-mvp}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_FQN="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"

# App runtime on droplet
REMOTE_ENV_DIR="/etc/shortlink"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-${REMOTE_ENV_DIR}/.env}"
DOCR_ENV_FILE="${DOCR_ENV_FILE:-${REMOTE_ENV_DIR}/docr.env}"
CONTAINER_NAME="${CONTAINER_NAME:-shortlink}"
HOST_PORT="${HOST_PORT:-80}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"

# DOCR auth (REQUIRED)
DOCR_USERNAME="${DOCR_USERNAME:-token}"
DOCR_PASSWORD="${DOCR_PASSWORD:-}"                    # export this before running

# Local .env to upload
LOCAL_ENV_PATH="${LOCAL_ENV_PATH:-.env}"

# ─────────────────────────────────────────────────────────────────────────────
# Checks
# ─────────────────────────────────────────────────────────────────────────────
if [[ -z "${DROPLET_HOST}" ]]; then
  echo "ERROR: DROPLET_HOST not set and .droplet_ip not found."; exit 1
fi
if [[ ! -f "${LOCAL_ENV_PATH}" ]]; then
  echo "ERROR: ${LOCAL_ENV_PATH} not found. Create it or set LOCAL_ENV_PATH."; exit 1
fi
if [[ -z "${DOCR_PASSWORD}" ]]; then
  echo "ERROR: DOCR_PASSWORD is required. Export it before running."; exit 1
fi

SSH_BASE=(-o StrictHostKeyChecking=accept-new)
if [[ -n "${SSH_KEY}" ]]; then SSH_BASE+=(-i "${SSH_KEY}"); fi
SCP_BASE=(-o StrictHostKeyChecking=accept-new)
if [[ -n "${SSH_KEY}" ]]; then SCP_BASE+=(-i "${SSH_KEY}"); fi

# ─────────────────────────────────────────────────────────────────────────────
# 0) Prepare local temp files for upload
# ─────────────────────────────────────────────────────────────────────────────
TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "${TMPDIR}"; }
trap cleanup EXIT

REMOTE_DEPLOY_LOCAL="${TMPDIR}/remote-deploy.sh"
SYSTEMD_UNIT_LOCAL="${TMPDIR}/shortlink.service"
DOCR_ENV_LOCAL="${TMPDIR}/docr.env"

cat > "${REMOTE_DEPLOY_LOCAL}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

REGISTRY_URL="${REGISTRY_URL}"
IMAGE_FQN="${IMAGE_FQN}"
CONTAINER_NAME="${CONTAINER_NAME}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE}"
DOCR_ENV_FILE="${DOCR_ENV_FILE}"
HOST_PORT="${HOST_PORT}"
CONTAINER_PORT="${CONTAINER_PORT}"
UPLOADS_DIR="${UPLOADS_DIR:-/etc/shortlink/uploads}"

# Load DOCR creds (works under systemd and manual runs)
if [[ -f "\${DOCR_ENV_FILE}" ]]; then
  set -a
  . "\${DOCR_ENV_FILE}"
  set +a
fi

if [[ -z "\${DOCR_PASSWORD:-}" ]]; then
  echo "ERROR: DOCR_PASSWORD not set (expected in \${DOCR_ENV_FILE})."; exit 1
fi

docker login "\${REGISTRY_URL}" -u "\${DOCR_USERNAME:-token}" -p "\${DOCR_PASSWORD}"

docker pull "\${IMAGE_FQN}"

docker stop "\${CONTAINER_NAME}" 2>/dev/null || true
docker rm "\${CONTAINER_NAME}" 2>/dev/null || true

mkdir -p "\${UPLOADS_DIR}"

docker run -d --name "\${CONTAINER_NAME}" \\
  --restart=always \\
  --env-file "\${REMOTE_ENV_FILE}" \\
  -v "\${UPLOADS_DIR}:/app/public/uploads" \\
  -p "\${HOST_PORT}:\${CONTAINER_PORT}" \\
  "\${IMAGE_FQN}"

docker image prune -f >/dev/null 2>&1 || true
echo "Deploy OK"
EOF
chmod +x "${REMOTE_DEPLOY_LOCAL}"

cat > "${SYSTEMD_UNIT_LOCAL}" <<EOF
[Unit]
Description=Shortlink API (Docker)
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=true
Environment=REGISTRY_URL=${REGISTRY_URL}
Environment=IMAGE_FQN=${IMAGE_FQN}
Environment=CONTAINER_NAME=${CONTAINER_NAME}
Environment=REMOTE_ENV_FILE=${REMOTE_ENV_FILE}
Environment=HOST_PORT=${HOST_PORT}
Environment=CONTAINER_PORT=${CONTAINER_PORT}
EnvironmentFile=${DOCR_ENV_FILE}
ExecStart=/root/remote-deploy.sh
ExecStop=/usr/bin/docker stop ${CONTAINER_NAME}
ExecStop=/usr/bin/docker rm ${CONTAINER_NAME}
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
EOF

cat > "${DOCR_ENV_LOCAL}" <<EOF
DOCR_USERNAME=${DOCR_USERNAME}
DOCR_PASSWORD=${DOCR_PASSWORD}
EOF

# ─────────────────────────────────────────────────────────────────────────────
# 1) Install Docker on droplet if missing
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Installing Docker on ${DROPLET_HOST}"
ssh "${SSH_BASE[@]}" "${DROPLET_SSH_USER}@${DROPLET_HOST}" bash -s <<'EOF'
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable docker
systemctl start docker
EOF

# ─────────────────────────────────────────────────────────────────────────────
# 2) Upload env files and deploy artifacts
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Creating ${REMOTE_ENV_DIR} and uploading env files"
ssh "${SSH_BASE[@]}" "${DROPLET_SSH_USER}@${DROPLET_HOST}" "mkdir -p ${REMOTE_ENV_DIR} && chmod 700 ${REMOTE_ENV_DIR}"
scp "${SCP_BASE[@]}" "${LOCAL_ENV_PATH}" "${DROPLET_SSH_USER}@${DROPLET_HOST}:${REMOTE_ENV_FILE}"
scp "${SCP_BASE[@]}" "${DOCR_ENV_LOCAL}" "${DROPLET_SSH_USER}@${DROPLET_HOST}:${DOCR_ENV_FILE}"
ssh "${SSH_BASE[@]}" "${DROPLET_SSH_USER}@${DROPLET_HOST}" "chmod 600 ${REMOTE_ENV_FILE} ${DOCR_ENV_FILE}"

echo "==> Uploading /root/remote-deploy.sh and systemd unit"
scp "${SCP_BASE[@]}" "${REMOTE_DEPLOY_LOCAL}" "${DROPLET_SSH_USER}@${DROPLET_HOST}:/root/remote-deploy.sh"
scp "${SCP_BASE[@]}" "${SYSTEMD_UNIT_LOCAL}" "${DROPLET_SSH_USER}@${DROPLET_HOST}:/etc/systemd/system/shortlink.service"
ssh "${SSH_BASE[@]}" "${DROPLET_SSH_USER}@${DROPLET_HOST}" "chmod +x /root/remote-deploy.sh && systemctl daemon-reload && systemctl enable shortlink.service"

echo "==> Provisioning complete on ${DROPLET_HOST}"
