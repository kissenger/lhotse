#!/usr/bin/env bash

# Script to run all nightly maintenance tasks from cron.
# Success messages are echoed to stdout.
# Failure messages are echoed immediately, then collated into one email at end.

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MAIL_TO="gordon.taylor@hotmail.co.uk"
FAILURE_OUTPUT=""
HAS_FAILURE=0

check_email_setup() {
  local ts=""
  local output=""
  ts="$(date -Iseconds)"

  if ! command -v msmtp >/dev/null 2>&1; then
    echo "FAILURE: msmtp command not found" >&2
    return 1
  fi

  if ! output="$(printf 'Subject: nightly-maintenance-health-check\n\nhealth-check only (no send)\n' | msmtp --pretend -a default "${MAIL_TO}" 2>&1)"; then
    echo "FAILURE: email health-check failed (msmtp --pretend -a default)" >&2
    append_failure "FAILURE: email health-check failed (msmtp --pretend -a default)"
    if [[ -n "${output}" ]]; then
      echo "${output}" >&2
      append_failure "${output}"
    fi
    return 1
  fi

  echo "[${ts}] Email health-check passed (no email sent)" >&2

  return 0
}

append_failure() {
  local text="$1"

  if [[ -z "${text}" ]]; then
    return 0
  fi

  if [[ -n "${FAILURE_OUTPUT}" ]]; then
    FAILURE_OUTPUT+=$'\n'
  fi
  FAILURE_OUTPUT+="${text}"
}

run_check() {
  local script_name="$1"
  local script_path="${SCRIPT_DIR}/${script_name}"
  local output=""
  local ts=""

  ts="$(date -Iseconds)"
  if [[ ! -f "${script_path}" ]]; then
    echo "[${ts}] FAILURE: Missing script ${script_path}" >&2
    append_failure "[${ts}] FAILURE: Missing script ${script_path}"
    return 1
  fi

  if ! output="$(bash "${script_path}" 2>&1)"; then
    if [[ "${output}" == *"FAILURE:"* ]]; then
      echo "${output}" >&2
      append_failure "${output}"
    else
      echo "[${ts}] FAILURE: ${script_name} failed" >&2
      append_failure "[${ts}] FAILURE: ${script_name} failed"
      if [[ -n "${output}" ]]; then
        echo "${output}" >&2
        append_failure "${output}"
      fi
    fi
    return 1
  fi

  if [[ "${output}" == *"FAILURE:"* ]]; then
    echo "${output}" >&2
    append_failure "${output}"
    return 1
  fi

  echo "[${ts}] ${script_name} ran ok"

  return 0
}

check_email_setup || HAS_FAILURE=1
run_check "run-paypal-nightly.sh" || HAS_FAILURE=1
run_check "run-sitemap-nightly.sh" || HAS_FAILURE=1
run_check "run-mongo-backup-nightly.sh" || HAS_FAILURE=1

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  if [[ -n "${FAILURE_OUTPUT}" ]]; then
    if command -v msmtp >/dev/null 2>&1; then
      if ! echo -e "Subject: Error from nightly maintenance\n\n${FAILURE_OUTPUT}" | msmtp -a default "${MAIL_TO}"; then
        echo "[$(date -Iseconds)] FAILURE: Could not send failure email via msmtp" >&2
      fi
    else
      echo "[$(date -Iseconds)] FAILURE: msmtp command not found; cannot send failure email" >&2
    fi
  fi
  exit 1
fi
