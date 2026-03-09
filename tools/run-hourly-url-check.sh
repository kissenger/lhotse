#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/maintenance-common.sh"

ENV_FILE="${REPO_ROOT}/.env"
DEFAULT_LOG_FILE="${REPO_ROOT}/logs/hourly-url-check.log"

maintenance_init "run-hourly-url-check.sh" "${ENV_FILE}" "${DEFAULT_LOG_FILE}"
trap 'maintenance_finalize "$?"' EXIT

URL_MASTER="${URL_CHECK_MASTER:-https://snorkelology.co.uk}"
URL_BETA="${URL_CHECK_BETA:-https://beta.snorkelology.co.uk}"

HAS_FAILURE=0

check_url() {
  local url="$1"
  local output=""

  if ! output="$(curl --silent --show-error --location --max-time 15 --output /dev/null --write-out '%{http_code}' "${url}" 2>&1)"; then
    maintenance_log_failure "url check failed for ${url}. curl error: ${output}"
    HAS_FAILURE=1
    return
  fi

  if [[ ! "${output}" =~ ^[0-9]{3}$ ]]; then
    maintenance_log_failure "url check failed for ${url}. invalid HTTP status output: ${output}"
    HAS_FAILURE=1
    return
  fi

  if [[ "${output}" -lt 200 || "${output}" -ge 400 ]]; then
    maintenance_log_failure "url check failed for ${url}. HTTP status ${output}"
    HAS_FAILURE=1
    return
  fi

  maintenance_log_success "url check passed for ${url}. HTTP status ${output}"
}

check_url "${URL_MASTER}"
check_url "${URL_BETA}"

if [[ "${HAS_FAILURE}" -ne 0 ]]; then
  exit 1
fi

maintenance_log_success "all hourly URL checks passed"
