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
DEFAULT_LOG_FILE="${REPO_ROOT}/logs/paypal-nightly.log"

maintenance_init "run-paypal-nightly.sh" "${ENV_FILE}" "${DEFAULT_LOG_FILE}"
trap 'maintenance_finalize "$?"' EXIT

maintenance_log_success "starting PayPal sandbox UI test"

cd "${REPO_ROOT}"

if ! output="$(npm run test:ui:paypal:sandbox 2>&1)"; then
  maintenance_log_failure "PayPal sandbox UI test failed"
  if [[ -n "${output}" ]]; then
    while IFS= read -r line; do
      [[ -n "${line}" ]] && maintenance_log_failure "npm output: ${line}"
    done <<< "${output}"
  fi
  exit 1
fi

maintenance_log_success "PayPal sandbox UI test passed"
