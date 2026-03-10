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
REBOOT_FLAG_FILE="${REBOOT_FLAG_FILE}"

sendEmail() {
  if ! echo -e "Subject: Unscheduled reboot alert\n\n$(date -Iseconds) Unscheduled server reboot" | msmtp -a default "${MAIL_TO}"; then
    echo "$(date -Iseconds) FAILURE Unable to send failure email via msmtp" | tee -a "${LOG_FILE}" >&2
  fi
}

if [[ -f "${REBOOT_FLAG_FILE}" ]]; then
  rm -f "${REBOOT_FLAG_FILE}"
  echo "$(date -Iseconds) Scheduled reboot detected and flag cleared" | tee -a "${LOG_FILE}" >&2
else
  echo "$(date -Iseconds) Unscheduled reboot detected, sending email alert" | tee -a "${LOG_FILE}" >&2
  sendEmail
fi