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

# import .env file
maintenance_load_env_file "${ENV_FILE}"

# read .env variables
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/scheduled-maintenance.log}"
HAS_FAILURE=0
ERROR_LINES=""
MAIL_TO="${MAIL_TO:-}"
REBOOT_FLAG_FILE="${REBOOT_FLAG_FILE:-${REPO_ROOT}/.scheduled-reboot.flag}"

mkdir -p "$(dirname -- "${LOG_FILE}")"

# move to working directory
cd "${REPO_ROOT}"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [[ -s "${NVM_SCRIPT}" ]]; then
  # shellcheck disable=SC1090
  . "${NVM_SCRIPT}"
  nvm use >/dev/null || true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

append_colored_log() {
  local color="$1"
  local message="$2"
  echo -e "${color}${message}${NC}" >> "${LOG_FILE}"
}

printError() {
  local msg="$(date -Iseconds) [FAIL] ${1}"
  echo -e "${RED}${msg}${NC}" >&2
  append_colored_log "${RED}" "${msg}"
  ERROR_LINES+="${msg}\n"
}

printSuccess() {
  local msg="$(date -Iseconds) [PASS] ${1}"
  echo -e "${GREEN}${msg}${NC}"
  append_colored_log "${GREEN}" "${msg}"
}

sendEmail() {
  if [[ -z "${MAIL_TO}" ]]; then
    echo "$(date -Iseconds) FAILURE MAIL_TO is not set, skipping failure email" | tee -a "${LOG_FILE}" >&2
    return 1
  fi
  if ! echo -e "Subject: Server Scheduled Maintenance Error\n\n${ERROR_LINES}" | msmtp -a default "${MAIL_TO}"; then
    echo "$(date -Iseconds) FAILURE Unable to send failure email via msmtp" | tee -a "${LOG_FILE}" >&2
  fi
}

run_check() {
  local name="${1}"
  local script="${SCRIPT_DIR}/${name}"

  if [[ ! -f "${script}" ]]; then
    local missing_msg="$(date -Iseconds) [FAIL] ${name} (script not found)"
    echo -e "${RED}${missing_msg}${NC}" >&2
    append_colored_log "${RED}" "${missing_msg}"
    ERROR_LINES+="$(date -Iseconds) [FAIL] ${name} (script not found)\n"
    return 1
  fi

  # Let each child script print verbose output to terminal; keep log summary-only.
  if MAINTENANCE_SILENT=0 bash "${script}"; then
    local pass_msg="$(date -Iseconds) [PASS] ${name}"
    echo -e "${GREEN}${pass_msg}${NC}"
    append_colored_log "${GREEN}" "${pass_msg}"
  else
    local fail_msg="$(date -Iseconds) [FAIL] ${name}"
    echo -e "${RED}${fail_msg}${NC}" >&2
    append_colored_log "${RED}" "${fail_msg}"
    ERROR_LINES+="${fail_msg}\n"
    return 1
  fi
}

run_check "run-mongo-connectivity.sh"  || HAS_FAILURE=1
run_check "run-paypal-test.sh"         || HAS_FAILURE=1
run_check "run-url-check.sh"           || HAS_FAILURE=1
run_check "run-seo-check.sh"           || HAS_FAILURE=1
run_check "run-og-checker.sh"          || HAS_FAILURE=1
# run_check "run-performance.sh"         || HAS_FAILURE=1
run_check "run-generate-sitemap.sh"    || HAS_FAILURE=1
run_check "run-mongo-backup.sh"        || HAS_FAILURE=1
run_check "run-certbot-renew.sh"       || HAS_FAILURE=1

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  summary_msg="$(date -Iseconds) [FAIL] scheduled maintenance ran with failures"
  echo -e "${RED}${summary_msg}${NC}" >&2
  append_colored_log "${RED}" "${summary_msg}"
  sendEmail
fi

# Create the flag file so startup-reboot-check.sh knows this reboot is intentional.
touch "${REBOOT_FLAG_FILE}"
printSuccess "Created reboot flag ${REBOOT_FLAG_FILE}"

# Reboot host  
printSuccess "Initiating reboot now ..."
sleep 1
sudo /sbin/reboot now