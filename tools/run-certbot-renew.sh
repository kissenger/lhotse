#!/usr/bin/env bash
# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

# Let's Encrypt certificate status and dry-run renewal
ERROR_MSG=$(sudo certbot renew --cert-name snorkelology.co.uk --dry-run 2>&1)
if [ $? -ne 0 ]; then
    printError "Certbot dry-run failed with error: ${ERROR_MSG}"
    HAS_FAILURE=1
else
    printSuccess "[OK] Certbot dry-run"
fi