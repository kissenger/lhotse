#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

# Optional env file for server-specific overrides.
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"
LOG_FILE="${LOG_FILE:-${PROJECT_ROOT}/logs/sitemap-nightly.log}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

mkdir -p "$(dirname -- "${LOG_FILE}")"

echo "[$(date -Iseconds)] Starting nightly sitemap generation" | tee -a "${LOG_FILE}"

if ! node "${PROJECT_ROOT}/tools/generate-sitemap.mjs" >>"${LOG_FILE}" 2>&1; then
  echo "[$(date -Iseconds)] FAILURE: nightly sitemap generation failed" | tee -a "${LOG_FILE}"
  exit 1
fi

echo "[$(date -Iseconds)] Nightly sitemap generation complete" | tee -a "${LOG_FILE}"
