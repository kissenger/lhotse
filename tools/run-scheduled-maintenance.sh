#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# import .env file
set -a
# shellcheck disable=SC1090
source "/home/gort1975/snorkelology/.env"
set +a

# read .env variables
LOG_FILE="${LOG_FILE}"
SCRIPT_PATH="/home/gort1975/snorkelology/tools/run-nightly-maintenance.sh"
SCRIPT_DIR="/home/gort1975/snorkelology/tools"
HAS_FAILURE=0
ERROR_LINES=""
MAIL_TO="${MAIL_TO}"
REBOOT_FLAG_FILE="${REBOOT_FLAG_FILE}"

# move to working directory
cd "/home/gort1975/snorkelology/"

. "/home/gort1975/.nvm/nvm.sh"
nvm use

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

printError() {
  local msg="$(date -Iseconds) FAILURE  ${1}"
  echo -e "${RED}${msg}${NC}" | tee -a "${LOG_FILE}" >&2
  ERROR_LINES+="${msg}\n"
}

printSuccess() {
  echo -e "$(date -Iseconds) ${1}" | tee -a "${LOG_FILE}"
}

sendEmail() {
  if ! echo -e "Subject: Server Scheduled Maintenance Error\n\n${ERROR_LINES}" | msmtp -a default "${MAIL_TO}"; then
    echo "$(date -Iseconds) FAILURE Unable to send failure email via msmtp" | tee -a "${LOG_FILE}" >&2
  fi
}

run_check() {
  local name="${1}"
  local script="${SCRIPT_DIR}/${name}"

  if [[ ! -f "${script}" ]]; then
    echo -e "${RED}$(date -Iseconds) [FAIL] ${name} (script not found)${NC}" | tee -a "${LOG_FILE}" >&2
    ERROR_LINES+="$(date -Iseconds) [FAIL] ${name} (script not found)\n"
    return 1
  fi

  # Sub-script output goes to terminal only — not to the log file
  if bash "${script}"; then
    echo -e "${GREEN}$(date -Iseconds) [PASS] ${name}${NC}" | tee -a "${LOG_FILE}"
  else
    echo -e "${RED}$(date -Iseconds) [FAIL] ${name}${NC}" | tee -a "${LOG_FILE}" >&2
    ERROR_LINES+="$(date -Iseconds) [FAIL] ${name}\n"
    return 1
  fi
}

run_check "run-mongo-connectivity.sh"  || HAS_FAILURE=1
run_check "run-paypal-test.sh"         || HAS_FAILURE=1
run_check "run-url-check.sh"           || HAS_FAILURE=1
run_check "run-seo-check.sh"           || HAS_FAILURE=1
run_check "run-performance.sh"         || HAS_FAILURE=1
run_check "run-generate-sitemap.sh"    || HAS_FAILURE=1
run_check "run-mongo-backup.sh"        || HAS_FAILURE=1
run_check "run-certbot-renew.sh"       || HAS_FAILURE=1

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  echo -e "${RED}$(date -Iseconds) [FAIL] scheduled maintenance ran with failures${NC}" | tee -a "${LOG_FILE}" >&2
  sendEmail
fi

# Create the flag file so startup-reboot-check.sh knows this reboot is intentional.
touch "${REBOOT_FLAG_FILE}"
printSuccess "Created reboot flag ${REBOOT_FLAG_FILE}"

# Reboot host  
printSuccess "Initiating reboot now ..."
sleep 1
sudo /sbin/reboot now