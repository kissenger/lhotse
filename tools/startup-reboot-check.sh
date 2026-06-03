#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

# import .env file
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# read .env variables
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/startup-reboot-check.log}"
REBOOT_FLAG_FILE="${REBOOT_FLAG_FILE:-${REPO_ROOT}/.scheduled-reboot.flag}"
MAIL_TO="${MAIL_TO:-}"

mkdir -p "$(dirname -- "${LOG_FILE}")"

waitForNetwork() {
  local retries=12
  local delay=5
  for ((i = 1; i <= retries; i++)); do
    if getent hosts smtp.gmail.com >/dev/null 2>&1; then
      return 0
    fi
    echo "$(date -Iseconds) Waiting for network (attempt ${i}/${retries})..." | tee -a "${LOG_FILE}" >&2
    sleep "${delay}"
  done
  return 1
}

sendEmail() {
  if ! waitForNetwork; then
    echo "$(date -Iseconds) FAILURE Network not available after 60s, skipping email" | tee -a "${LOG_FILE}" >&2
    return 1
  fi
  if [[ -z "${MAIL_TO}" ]]; then
    echo "$(date -Iseconds) FAILURE MAIL_TO is not set, skipping email alert" | tee -a "${LOG_FILE}" >&2
    return 1
  fi
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