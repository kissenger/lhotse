#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
source "${SCRIPT_DIR}/maintenance-common.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "$(date -Iseconds) ERROR .env file not found at ${ENV_FILE}" >&2
  exit 1
fi

maintenance_load_env_file "${ENV_FILE}"

PYTHON_BIN="${PYTHON_BIN:-${REPO_ROOT}/tools/python/.venv/bin/python}"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="$(command -v python3 || true)"
fi

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "$(date -Iseconds) ERROR python3 not found" >&2
  exit 1
fi

cd "${REPO_ROOT}"

echo "$(date -Iseconds) Starting Copernicus SST pipeline"
"${PYTHON_BIN}" tools/python/copernicus/run_update_and_publish.py
echo "$(date -Iseconds) Copernicus SST pipeline completed OK"