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

# read .env variables
LOG_FILE="${LOG_FILE}"

# move to working directory
cd "/home/gort1975/snorkelology/"

. "/home/gort1975/.nvm/nvm.sh"
nvm use

# print working status
echo "$(date -Iseconds) Starting performance budget checks"  

if ! output="$(npm run test:ui:performance -- --config ./playwright.config.ts 2>&1)"; then
  if [[ -n "${output}" ]]; then
    echo "$(date -Iseconds) FAILURE playwright output:"  
    echo "${output}" | sed 's/^/    /'  
  fi
  exit 1
fi

if [[ -n "${output}" ]]; then
  echo "${output}" | sed 's/^/    /'  
fi

echo "$(date -Iseconds) Performance budget checks completed OK"  
