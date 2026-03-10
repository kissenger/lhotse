#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# import .env file
set -a
# shellcheck disable=SC1090
source "/gort1975/snorkelology/.env"
set +a

# read .env variables
LOG_FILE="${LOG_FILE}"
SITEMAP_OUTPUT_DIR="${SITEMAP_OUTPUT_DIR}"

# move to working directory
cd "/gort1975/snorkelology/"

# print working status
echo "$(date -Iseconds) Starting sitemap generation" | tee -a "${LOG_FILE}" >&2

mkdir -p "${SITEMAP_OUTPUT_DIR}"

if ! output="$(SITEMAP_PATH="${SITEMAP_OUTPUT_DIR}/sitemap.xml" node ./tools/generate-sitemap.mjs 2>&1)"; then
  if [[ -n "${output}" ]]; then
    echo "$(date -Iseconds) FAILURE node output:" | tee -a "${LOG_FILE}" >&2
    echo "${output}" | sed 's/^/    /' | tee -a "${LOG_FILE}" >&2
  fi
  exit 1
fi

echo "$(date -Iseconds) Sitemap generation completed OK" | tee -a "${LOG_FILE}" >&2
