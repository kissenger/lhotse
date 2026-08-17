#!/usr/bin/env bash

# Shared helpers for maintenance scripts.

SCRIPT_NAME=""
MAINTENANCE_LOG_FILE=""
MAINTENANCE_ERROR_LINES=""

maintenance_load_env_file() {
  local env_file="$1"
  local line
  local key
  local value
  local quote=""
  local variable_name
  local variable_token
  local variable_value

  [[ -f "${env_file}" ]] || return 0

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" == *=* ]] || continue

    key="${line%%=*}"
    key="${key#export }"
    key="${key//[[:space:]]/}"
    [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "${value}" =~ ^\".*\"$ ]]; then
      quote='"'
      value="${value:1:${#value}-2}"
    elif [[ "${value}" =~ ^\'.*\'$ ]]; then
      quote="'"
      value="${value:1:${#value}-2}"
    else
      quote=""
    fi

    if [[ "${quote}" != "'" ]]; then
      while [[ "${value}" =~ \$\{([A-Za-z_][A-Za-z0-9_]*)\} ]]; do
        variable_name="${BASH_REMATCH[1]}"
        variable_token="${BASH_REMATCH[0]}"
        if [[ -v "${variable_name}" ]]; then
          variable_value="${!variable_name}"
        else
          variable_value=""
        fi
        value="${value//"${variable_token}"/"${variable_value}"}"
      done
    fi

    export "${key}=${value}"
  done < "${env_file}"
}

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

  maintenance_load_env_file "${env_file}"

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
