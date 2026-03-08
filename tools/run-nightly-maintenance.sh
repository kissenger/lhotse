#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${REPO_ROOT}/logs"
LOG_FILE="${LOG_DIR}/nightly-maintenance.log"
MAIL_TO="gordon.taylor@hotmail.co.uk"
ALL_OUTPUT=""
HAS_FAILURE=0

append_output() {
  local text="$1"

  if [[ -z "${text}" ]]; then
    return 0
  fi

  if [[ -n "${ALL_OUTPUT}" ]]; then
    ALL_OUTPUT+=$'\n'
  fi
  ALL_OUTPUT+="${text}"
}

run_check() {
  local script_name="$1"
  local script_path="${SCRIPT_DIR}/${script_name}"
  local output=""

  if [[ ! -f "${script_path}" ]]; then
    append_output "FAILURE: Missing script ${script_path}"
    return 1
  fi

  if ! output="$(bash "${script_path}" 2>&1)"; then
    if [[ "${output}" == *"FAILURE:"* ]]; then
      append_output "${output}"
    else
      append_output "FAILURE: ${script_name} failed"
      if [[ -n "${output}" ]]; then
        append_output "${output}"
      fi
    fi
    return 1
  fi

  append_output "${output}"

  if [[ "${output}" == *"FAILURE:"* ]]; then
    return 1
  fi

  append_output "[$(date -Iseconds)] ${script_name} ran ok"

  return 0
}

run_check "run-paypal-nightly.sh" || HAS_FAILURE=1
run_check "run-sitemap-nightly.sh" || HAS_FAILURE=1
run_check "run-mongo-backup-nightly.sh" || HAS_FAILURE=1

mkdir -p "${LOG_DIR}"

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  if [[ -n "${ALL_OUTPUT}" ]]; then
    echo -e "Subject: Error from nightly maintenance\n\n${ALL_OUTPUT}" | msmtp -a default "${MAIL_TO}"
  fi
  exit 1
fi

if [[ -n "${ALL_OUTPUT}" ]]; then
  {
    echo "[$(date -Iseconds)] Nightly maintenance succeeded"
    echo "${ALL_OUTPUT}"
  } >> "${LOG_FILE}"
fi
