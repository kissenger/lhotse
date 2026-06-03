#!/usr/bin/env bash

# Shared helpers for maintenance scripts.

SCRIPT_NAME=""
MAINTENANCE_LOG_FILE=""
MAINTENANCE_ERROR_LINES=""

maintenance_now() {
  date -Iseconds
}

maintenance_log_info() {
  local msg="$(maintenance_now) INFO ${SCRIPT_NAME} $*"
  echo "${msg}"
  if [[ -n "${MAINTENANCE_LOG_FILE}" ]]; then
    echo "${msg}" >> "${MAINTENANCE_LOG_FILE}"
  fi
}

maintenance_log_success() {
  local msg="$(maintenance_now) OK ${SCRIPT_NAME} $*"
  echo "${msg}"
  if [[ -n "${MAINTENANCE_LOG_FILE}" ]]; then
    echo "${msg}" >> "${MAINTENANCE_LOG_FILE}"
  fi
}

maintenance_log_failure() {
  local msg="$(maintenance_now) FAILURE ${SCRIPT_NAME} $*"
  echo "${msg}" >&2
  if [[ -n "${MAINTENANCE_LOG_FILE}" ]]; then
    echo "${msg}" >> "${MAINTENANCE_LOG_FILE}"
  fi
  MAINTENANCE_ERROR_LINES+="${msg}\n"
}

maintenance_fail() {
  maintenance_log_failure "$*"
  exit 1
}

maintenance_init() {
  local script_name="$1"
  local env_file="$2"
  local default_log_file="$3"

  SCRIPT_NAME="${script_name}"

  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi

  MAINTENANCE_LOG_FILE="${LOG_FILE:-${default_log_file}}"
  mkdir -p "$(dirname -- "${MAINTENANCE_LOG_FILE}")"
  maintenance_log_info "started"
}

maintenance_finalize() {
  local exit_code="$1"
  if [[ "${exit_code}" -eq 0 ]]; then
    maintenance_log_success "completed"
  else
    maintenance_log_failure "exited with code ${exit_code}"
  fi
}
