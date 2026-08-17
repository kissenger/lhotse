#!/usr/bin/env bash
# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
source "${SCRIPT_DIR}/maintenance-common.sh"

maintenance_load_env_file "${ENV_FILE}"

cd "${REPO_ROOT}"

# Let's Encrypt certificate status and dry-run renewal
ERROR_MSG=$(sudo certbot renew --cert-name snorkelology.co.uk --dry-run 2>&1)
if [ $? -ne 0 ]; then
    echo "Certbot dry-run failed with error: ${ERROR_MSG}" >&2
    exit 1
else
    echo "[OK] Certbot dry-run"
fi