#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# import .env file
set -a
# shellcheck disable=SC1090
source "/home/gort1975/snorkelology/.env"
set +a

LOG_FILE="${LOG_FILE}"

cd "/home/gort1975/snorkelology/"

. "/home/gort1975/.nvm/nvm.sh"
nvm use

echo "$(date -Iseconds) Starting dead-links URL check"

if ! output="$(node ./tests/test-dead-links.js 2>&1)"; then
  echo "${output}"
  echo "$(date -Iseconds) FAILURE Dead-links URL check failed"
  exit 1
fi

echo "${output}"
echo "$(date -Iseconds) Dead-links URL check completed OK"
