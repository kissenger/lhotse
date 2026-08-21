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
source "${SCRIPT_DIR}/maintenance-common.sh"

fail() {
  local message="$*"
  echo "$(date -Iseconds) FAILURE run-og-checker.sh ${message}" >&2
  exit 1
}

# Load the repo-root .env explicitly. No fallback search.
ENV_FILE="${ENV_FILE_OVERRIDE:-${PROJECT_ROOT}/.env}"

if [ ! -f "$ENV_FILE" ]; then
  fail ".env file not found at $ENV_FILE"
fi

maintenance_load_env_file "$ENV_FILE"

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
  maintenance_log_failure_block "OG image checker failed" "${output}"
  exit 1
fi

if [[ -n "${output}" ]]; then
  echo "${output}"
fi

echo "$(date -Iseconds) OG image checker completed OK"
