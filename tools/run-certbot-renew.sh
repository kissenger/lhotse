#!/usr/bin/env bash
# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

cd "${REPO_ROOT}"

# Let's Encrypt certificate status and dry-run renewal
ERROR_MSG=$(sudo certbot renew --cert-name snorkelology.co.uk --dry-run 2>&1)
if [ $? -ne 0 ]; then
    echo "Certbot dry-run failed with error: ${ERROR_MSG}" >&2
    exit 1
else
    echo "[OK] Certbot dry-run"
fi