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
  echo "$(date -Iseconds) FAILURE run-og-checker.sh ${message}" >&2
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

cd "$PROJECT_ROOT"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ -s "${NVM_SCRIPT}" ]; then
  # shellcheck disable=SC1091
  . "${NVM_SCRIPT}"
  nvm use || fail "nvm use failed"
fi

if [ -z "${MONGO_URI:-}" ]; then
  fail "MONGO_URI environment variable is not set"
fi

export MONGO_URI
export OG_ARTICLES_DIR="${OG_ARTICLES_DIR:-}"
export OG_LOGO_PATH="${OG_LOGO_PATH:-}"
export OG_LOGO_WIDTH_RATIO="${OG_LOGO_WIDTH_RATIO:-0.16}"
export OG_LOGO_MARGIN_X="${OG_LOGO_MARGIN_X:-60}"
export OG_LOGO_MARGIN_Y="${OG_LOGO_MARGIN_Y:-30}"
export OG_LOGO_LEFT="${OG_LOGO_LEFT:-}"
export OG_LOGO_TOP="${OG_LOGO_TOP:-}"

echo "$(date -Iseconds) Starting OG image checker"

if ! output="$(node ./tools/regenerate-og-images.mjs 2>&1)"; then
  if [[ -n "${output}" ]]; then
    echo "${output}" >&2
  fi
  fail "OG image checker failed"
fi

if [[ -n "${output}" ]]; then
  echo "${output}"
fi

echo "$(date -Iseconds) OG image checker completed OK"
