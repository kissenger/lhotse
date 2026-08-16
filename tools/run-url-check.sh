#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# Script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
REPO_ROOT="$PROJECT_ROOT"

fail() {
  local message="$*"
  echo "$(date -Iseconds) FAILURE run-url-check.sh ${message}" >&2
  exit 1
}

# Load environment file with fallback to project-local .env
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"
if [ ! -f "$ENV_FILE" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  ENV_FILE="$PROJECT_ROOT/.env"
fi

load_env_file() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    if [[ "${line}" == *=* ]]; then
      local key="${line%%=*}"
      local value="${line#*=}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"
      if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then
        value="${value:1:${#value}-2}"
      fi
      export "${key}=${value}"
    fi
  done < "${env_file}"
}

load_env_file "$ENV_FILE"

LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/logs/app.log}"

cd "$PROJECT_ROOT"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ -s "${NVM_SCRIPT}" ]; then
  # shellcheck disable=SC1091
  . "${NVM_SCRIPT}"
  nvm use || fail "nvm use failed"
fi

echo "$(date -Iseconds) Starting dead-links URL check"

if ! output="$(node ./tests/test-dead-links.js 2>&1)"; then
  echo "${output}"
  fail "Dead-links URL check failed"
fi

echo "${output}"
echo "$(date -Iseconds) Dead-links URL check completed OK"
