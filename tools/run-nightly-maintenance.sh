#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail
# shellcheck disable=SC1090

SCRIPT_PATH="home/gort1975/snorkelology/tools/run-nightly-maintenance.sh"
SCRIPT_DIR="home/gort1975/snorkelology/tools"
REPO_ROOT="home/gort1975/snorkelology"
source "${SCRIPT_DIR}/maintenance-common.sh"

cd "${REPO_ROOT}"

. "/home/gort1975/.nvm/nvm.sh"
nvm use

ENV_FILE="${REPO_ROOT}/.env"
DEFAULT_LOG_FILE="${REPO_ROOT}/logs/nightly-maintenance.log"

maintenance_init "run-nightly-maintenance.sh" "${ENV_FILE}" "${DEFAULT_LOG_FILE}"
trap 'maintenance_finalize "$?"' EXIT

if [[ -z "${REBOOT_FLAG_FILE:-}" ]]; then
  maintenance_fail "REBOOT_FLAG_FILE variable missing from ${ENV_FILE}"
fi

HAS_FAILURE=0

run_check() {
  local script_name="$1"
  local script_path="${SCRIPT_DIR}/${script_name}"
  local output=""

  if [[ ! -f "${script_path}" ]]; then
    maintenance_log_failure "missing script ${script_path}"
    return 1
  fi

  if ! output="$(NOTIFY_ON_FAILURE=0 LOG_FILE="${MAINT_LOG_FILE}" MAIL_TO="${MAINT_MAIL_TO}" REBOOT_FLAG_FILE="${REBOOT_FLAG_FILE}" bash "${script_path}" 2>&1)"; then
    maintenance_log_failure "${script_name} failed"
    if [[ -n "${output}" ]]; then
      echo "${script_name}" | tee -a "${MAINT_LOG_FILE}" >&2
    fi
    return 1
  fi

  maintenance_log_success "${script_name} completed OK"

  return 0
}

run_check "run-paypal-nightly.sh" || HAS_FAILURE=1
run_check "run-sitemap-nightly.sh" || HAS_FAILURE=1
run_check "run-mongo-backup-nightly.sh" || HAS_FAILURE=1

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  maintenance_log_failure "nightly maintenance run failed"
  exit 1
fi

maintenance_log_success "all nightly checks passed"

# Create the flag file so startup-reboot-check.sh knows this reboot is intentional.
touch "${REBOOT_FLAG_FILE}"
maintenance_log_success "created reboot flag ${REBOOT_FLAG_FILE}"

# Final sync to disk (highly recommended for Raspberry Pi SD cards)
sync
maintenance_log_success "filesystem sync completed"

# Reboot host to keep scheduled maintenance cycle predictable.
maintenance_log_success "initiating reboot"
sudo /sbin/reboot now