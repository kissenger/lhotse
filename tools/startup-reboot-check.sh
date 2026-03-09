#!/bin/bash

# 1. Bash Auto-Switcher
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

# 2. Strict Mode
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
maintenance_init "startup-reboot-check.sh" "${ENV_FILE}" "${MAINT_LOG_FILE}"
trap 'maintenance_finalize "$?"' EXIT

if [[ -z "${REBOOT_FLAG_FILE:-}" ]]; then
    maintenance_fail "REBOOT_FLAG_FILE variable missing from ${ENV_FILE}"
fi

if [[ -f "${REBOOT_FLAG_FILE}" ]]; then
    rm -f "${REBOOT_FLAG_FILE}"
    maintenance_log_success "scheduled reboot detected and flag cleared"
else
    maintenance_fail "unscheduled reboot detected"
fi