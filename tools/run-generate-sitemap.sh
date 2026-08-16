#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

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

load_env_file "${ENV_FILE}"

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

if [[ -n "${output}" ]]; then
  echo "${output}" | sed 's/^/    /'
fi

echo "$(date -Iseconds) Sitemap generation completed OK"  
