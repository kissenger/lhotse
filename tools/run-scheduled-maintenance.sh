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
REBOOT_FLAG_FILE="/home/gort1975/snorkelology/.reboot-required"

# move to working directory
cd "/gort1975/snorkelology/"

# print working status
echo "$(date -Iseconds) ** Starting scheduled maintenance" | tee -a "${LOG_FILE}" >&2

printError() {
  errorMessage="$(date -Iseconds) FAILURE  ${1}"
  echo "${errorMessage}" | tee -a "${LOG_FILE}" >&2
  ERROR_LINES+="${errorMessage}\n"
}

printSuccess() {
  echo "$(date -Iseconds) SUCCESS: ${1}" | tee -a "${LOG_FILE}" >&2
}

sendEmail() {
  if ! printf 'Subject: %s\n\n%s\n' Server Scheduled Maintenance Error "${ERROR_LINES}" | msmtp -a default "${MAIL_TO}"; then
    echo "$(date -Iseconds) FAILURE Unable to send failure email via msmtp" | tee -a "${LOG_FILE}" >&2
  fi
}

run_check() {
  local script="${SCRIPT_DIR}/${1}"
  local output=""

  if [[ ! -f "${script}" ]]; then
    printError "missing script ${script}"
    return 1
  fi

  if ! output="$(bash "${script}" 2>&1)"; then
    printError "${script} failed"
    return 1
  fi

  printSuccess "${script} completed OK"

  return 0
}

run_check "run-paypal-nightly.sh" || HAS_FAILURE=1
run_check "run-sitemap-nightly.sh" || HAS_FAILURE=1
run_check "run-mongo-backup-nightly.sh" || HAS_FAILURE=1

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  printError "Scheduled maintenance completed with failures"
  sendEmail
else
  printSuccess "Scheduled maintenance completed successfully"
fi

# Create the flag file so startup-reboot-check.sh knows this reboot is intentional.
touch "${REBOOT_FLAG_FILE}"
printSuccess "Created reboot flag ${REBOOT_FLAG_FILE}"

# Final sync to disk (highly recommended for Raspberry Pi SD cards)
sync
printSuccess "Filesystem sync completed"

# Reboot host  
printSuccess "Initiating reboot now ..."
sleep 1
sudo /sbin/reboot now