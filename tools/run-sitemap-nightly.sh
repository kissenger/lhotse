#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SITEMAP_SCRIPT="/home/gort1975/snorkelology/tools/generate-sitemap.mjs"
SITEMAP_OUTPUT_DIR="/home/gort1975/snorkelology/dist/prod/browser"

fail() {
  echo "[$(date -Iseconds)] FAILURE: $1" >&2
  exit 1
}

if [[ ! -f "${SITEMAP_SCRIPT}" ]]; then
  fail "sitemap generator not found at ${SITEMAP_SCRIPT}"
fi

mkdir -p "${SITEMAP_OUTPUT_DIR}"

if ! SITEMAP_PATH="${SITEMAP_OUTPUT_DIR}/sitemap.xml" node "${SITEMAP_SCRIPT}" >/dev/null 2>&1; then
  fail "nightly sitemap generation failed"
fi
