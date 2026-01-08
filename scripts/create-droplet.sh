#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG — change these only if you want different defaults
# ─────────────────────────────────────────────────────────────────────────────
DROPLET_NAME="${DROPLET_NAME:-shortlink-ams3}"       # droplet name
REGION="${REGION:-ams3}"                             # target region
SIZE="${SIZE:-s-1vcpu-1gb}"                          # droplet size
IMAGE_SLUG="${IMAGE_SLUG:-ubuntu-22-04-x64}"         # base image
TAGS="${TAGS:-shortlink,prod}"                       # comma-separated DO tags

# Local SSH key to use/create
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"        # private key path
SSH_PUB_PATH="${SSH_PUB_PATH:-${SSH_KEY_PATH}.pub}"          # public key path
SSH_KEY_LABEL="${SSH_KEY_LABEL:-$(whoami)@$(hostname)-shortlink}"  # label on DO

# Optional: VPC UUID in ams3 (leave empty to use default public network)
VPC_UUID="${VPC_UUID:-}"

# ─────────────────────────────────────────────────────────────────────────────
# Requirements
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v doctl >/dev/null 2>&1; then
  echo "ERROR: doctl not installed. Install and run: doctl auth init"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Ensure a local SSH key exists (generate if missing)
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -f "${SSH_PUB_PATH}" ]]; then
  echo "==> No SSH key found at ${SSH_PUB_PATH}. Generating a new ed25519 key..."
  mkdir -p "$(dirname "${SSH_KEY_PATH}")"
  ssh-keygen -t ed25519 -a 100 -f "${SSH_KEY_PATH}" -N "" -C "${SSH_KEY_LABEL}"
  echo "==> Generated ${SSH_KEY_PATH} and ${SSH_PUB_PATH}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Ensure the key is registered in DigitalOcean; import if missing
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Checking SSH keys in DigitalOcean..."
EXISTING_KEY_ID="$(doctl compute ssh-key list --format ID,Name,PublicKey --no-header 2>/dev/null \
  | awk -v label="${SSH_KEY_LABEL}" '$2==label {print $1}' | head -n1 || true)"

if [[ -z "${EXISTING_KEY_ID}" ]]; then
  echo "==> Importing local public key to DigitalOcean with name: ${SSH_KEY_LABEL}"
  doctl compute ssh-key import "${SSH_KEY_LABEL}" --public-key-file "${SSH_PUB_PATH}"
  # Fetch the ID we just created
  EXISTING_KEY_ID="$(doctl compute ssh-key list --format ID,Name --no-header | awk -v label="${SSH_KEY_LABEL}" '$2==label {print $1}' | head -n1)"
fi

if [[ -z "${EXISTING_KEY_ID}" ]]; then
  echo "ERROR: Failed to import or find SSH key in DigitalOcean."
  exit 1
fi

echo "==> Using DO SSH key ID: ${EXISTING_KEY_ID}"

# ─────────────────────────────────────────────────────────────────────────────
# Create droplet
# ─────────────────────────────────────────────────────────────────────────────
CREATE_ARGS=(
  compute droplet create "${DROPLET_NAME}"
  --region "${REGION}"
  --size "${SIZE}"
  --image "${IMAGE_SLUG}"
  --ssh-keys "${EXISTING_KEY_ID}"
  --tag-names "${TAGS}"
  --enable-monitoring
  --wait
)

if [[ -n "${VPC_UUID}" ]]; then
  CREATE_ARGS+=(--vpc-uuid "${VPC_UUID}")
fi

echo "==> Creating droplet ${DROPLET_NAME} in ${REGION} ..."
doctl "${CREATE_ARGS[@]}"

# ─────────────────────────────────────────────────────────────────────────────
# Output public IP and store it for later scripts
# ─────────────────────────────────────────────────────────────────────────────
IP="$(doctl compute droplet list --format Name,PublicIPv4 --no-header \
  | awk -v n="${DROPLET_NAME}" '$1==n {print $2}' | head -n1)"

if [[ -z "${IP}" ]]; then
  echo "ERROR: Could not find public IP for ${DROPLET_NAME}"
  exit 1
fi

echo "==> Droplet created: ${DROPLET_NAME} @ ${IP}"
echo "${IP}" > .droplet_ip
echo "==> Saved IP to .droplet_ip"
echo
echo "Next:"
echo "  1) Provision it:   DOCR_PASSWORD=<token> scripts/provision-droplet.sh"
echo "  2) Deploy image:   scripts/deploy-to-droplet.sh"

