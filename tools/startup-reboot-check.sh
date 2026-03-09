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

# Reboot monitor can use a dedicated environment file when deployed as a startup check.
ENV_FILE="${REBOOT_ENV_FILE:-/usr/local/bin/.reboot_env}"
if [[ ! -f "${ENV_FILE}" ]]; then
    ENV_FILE="${REPO_ROOT}/.env"
fi

DEFAULT_LOG_FILE="${REBOOT_LOG_FILE:-/var/log/reboot_monitor.log}"
maintenance_init "startup-reboot-check.sh" "${ENV_FILE}" "${DEFAULT_LOG_FILE}"
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