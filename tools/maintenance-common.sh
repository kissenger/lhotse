#!/usr/bin/env bash

# Shared helpers for maintenance scripts: consistent logging and one failure email per run.

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

MAINT_SCRIPT_NAME=""
MAINT_LOG_FILE=""
MAINT_MAIL_TO=""
MAINT_NOTIFY_ON_FAILURE="${NOTIFY_ON_FAILURE:-1}"
MAINT_LOG_MAX_LINES="${LOG_MAX_LINES:-1000}"
MAINT_FAILURE_LINES=""

maintenance_trim_log() {
  local line_count=""
  local max_lines="${MAINT_LOG_MAX_LINES}"

  if ! [[ "${max_lines}" =~ ^[0-9]+$ ]]; then
    return 0
  fi

  if [[ "${max_lines}" -le 0 ]]; then
    return 0
  fi

  line_count="$(wc -l < "${MAINT_LOG_FILE}" 2>/dev/null || echo 0)"
  if [[ "${line_count}" -le "${max_lines}" ]]; then
    return 0
  fi

  # Keep only the newest N lines to bound file growth.
  tail -n "${max_lines}" "${MAINT_LOG_FILE}" > "${MAINT_LOG_FILE}.tmp" && mv "${MAINT_LOG_FILE}.tmp" "${MAINT_LOG_FILE}"
}

maintenance_init() {
  local script_name="$1"
  local env_file="$2"
  local default_log_file="$3"

  MAINT_SCRIPT_NAME="${script_name}"

  if [[ -n "${env_file}" && -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi

  MAINT_LOG_FILE="${LOG_FILE:-${default_log_file}}"
  MAINT_MAIL_TO="${MAIL_TO:-${EMAIL:-}}"

  mkdir -p "$(dirname -- "${MAINT_LOG_FILE}")"
  touch "${MAINT_LOG_FILE}"
  maintenance_trim_log
}

maintenance_log_failure() {
  local message="$1"
  local line=""

  line="$(date -Iseconds) FAILURE ${MAINT_SCRIPT_NAME} ${message}"
  echo "${line}" | tee -a "${MAINT_LOG_FILE}" >&2
  maintenance_trim_log

  if [[ -n "${MAINT_FAILURE_LINES}" ]]; then
    MAINT_FAILURE_LINES+=$'\n'
  fi
  MAINT_FAILURE_LINES+="${line}"
}

maintenance_log_success() {
  local message="$1"
  local line=""

  line="$(date -Iseconds) ${MAINT_SCRIPT_NAME} ${message}"
  echo "${line}" | tee -a "${MAINT_LOG_FILE}"
  maintenance_trim_log
}

maintenance_fail() {
  local message="$1"
  maintenance_log_failure "${message}"
  exit 1
}

maintenance_send_failure_email() {
  local subject=""

  if [[ "${MAINT_NOTIFY_ON_FAILURE}" != "1" ]]; then
    return 0
  fi

  if [[ -z "${MAINT_FAILURE_LINES}" ]]; then
    return 0
  fi

  if [[ -z "${MAINT_MAIL_TO}" ]]; then
    echo "$(date -Iseconds) FAILURE ${MAINT_SCRIPT_NAME} MAIL_TO/EMAIL is not set; cannot send failure email" | tee -a "${MAINT_LOG_FILE}" >&2
    return 0
  fi

  if ! command -v msmtp >/dev/null 2>&1; then
    echo "$(date -Iseconds) FAILURE ${MAINT_SCRIPT_NAME} msmtp command not found; cannot send failure email" | tee -a "${MAINT_LOG_FILE}" >&2
    return 0
  fi

  subject="FAILURE ${MAINT_SCRIPT_NAME}"
  if ! printf 'Subject: %s\n\n%s\n' "${subject}" "${MAINT_FAILURE_LINES}" | msmtp -a default "${MAINT_MAIL_TO}"; then
    echo "$(date -Iseconds) FAILURE ${MAINT_SCRIPT_NAME} could not send failure email via msmtp" | tee -a "${MAINT_LOG_FILE}" >&2
  fi
}

maintenance_finalize() {
  local exit_code="$1"

  if [[ "${exit_code}" -ne 0 && -z "${MAINT_FAILURE_LINES}" ]]; then
    maintenance_log_failure "script exited with status ${exit_code}"
  fi

  maintenance_send_failure_email
  return "${exit_code}"
}
