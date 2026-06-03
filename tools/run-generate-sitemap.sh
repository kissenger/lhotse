#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

# import .env file
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# read .env variables
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/sitemap-generation.log}"
SITEMAP_OUTPUT_DIR="${SITEMAP_OUTPUT_DIR:-${REPO_ROOT}/dist/browser}"

mkdir -p "$(dirname -- "${LOG_FILE}")"

# move to working directory
cd "${REPO_ROOT}"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [[ -s "${NVM_SCRIPT}" ]]; then
  # shellcheck disable=SC1090
  . "${NVM_SCRIPT}"
  nvm use >/dev/null || true
fi

# print working status
echo "$(date -Iseconds) Starting sitemap generation"  

mkdir -p "${SITEMAP_OUTPUT_DIR}"

if ! output="$(SITEMAP_PATH="${SITEMAP_OUTPUT_DIR}/sitemap.xml" node ./tools/generate-sitemap.mjs 2>&1)"; then
  if [[ -n "${output}" ]]; then
    echo "$(date -Iseconds) FAILURE node output:"  
    echo "${output}" | sed 's/^/    /'  
  fi
  exit 1
fi

echo "$(date -Iseconds) Sitemap generation completed OK"  
