#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/maintenance-common.sh"

ENV_FILE="${REPO_ROOT}/.env"
# Source .env and set unified log file
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  echo "Environment file not found: ${ENV_FILE}" >&2
  exit 1
fi

MAINT_LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/maintenance.log}"
maintenance_init "run-paypal-nightly.sh" "${ENV_FILE}" "${MAINT_LOG_FILE}"
trap 'maintenance_finalize "$?"' EXIT

maintenance_log_success "starting PayPal sandbox UI test"

cd "${REPO_ROOT}"

if ! output="$(npm run test:ui:paypal:sandbox 2>&1)"; then
  maintenance_log_failure "PayPal sandbox UI test failed"
  if [[ -n "${output}" ]]; then
    echo "$(date -Iseconds) FAILURE ${MAINT_SCRIPT_NAME} npm output:" | tee -a "${MAINT_LOG_FILE}" >&2
    echo "${output}" | sed 's/^/    /' | tee -a "${MAINT_LOG_FILE}" >&2
  fi
  exit 1
fi

maintenance_log_success "PayPal sandbox UI test passed"
