#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# Script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

fail() {
  local message="$*"
  echo "$(date -Iseconds) FAILURE run-url-check.sh ${message}" >&2
  exit 1
}

# Load environment file with fallback to project-local .env
ENV_FILE="${ENV_FILE:-/home/gort1975/snorkelology/.env}"
if [ ! -f "$ENV_FILE" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  ENV_FILE="$PROJECT_ROOT/.env"
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/logs/app.log}"

cd "$PROJECT_ROOT"

if [ -f "/home/gort1975/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "/home/gort1975/.nvm/nvm.sh"
  nvm use || fail "nvm use failed"
fi

echo "$(date -Iseconds) Starting dead-links URL check"

if ! output="$(node ./tests/test-dead-links.js 2>&1)"; then
  echo "${output}"
  fail "Dead-links URL check failed"
fi

echo "${output}"
echo "$(date -Iseconds) Dead-links URL check completed OK"
