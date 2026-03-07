#!/usr/bin/env bash
set -euo pipefail

# Cron-friendly wrapper for nightly PayPal sandbox UI test.
# Prints a clear FAILURE message on error so external mail logic (msmtp) can alert.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${REPO_ROOT}/logs/paypal-nightly.log"

mkdir -p "$(dirname -- "${LOG_FILE}")"

cd "${REPO_ROOT}"

{
  echo "[$(date -Iseconds)] Starting nightly PayPal sandbox UI test"
  npm run test:ui:paypal:sandbox
  echo "[$(date -Iseconds)] SUCCESS: PayPal sandbox UI test passed"
} >> "${LOG_FILE}" 2>&1 || {
  echo "[$(date -Iseconds)] FAILURE: PayPal sandbox UI test failed. See ${LOG_FILE}" | tee -a "${LOG_FILE}" >&2
  exit 1
}
