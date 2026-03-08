#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SITEMAP_SCRIPT="/home/gort1975/snorkelology/tools/generate-sitemap.mjs"
SITEMAP_OUTPUT_DIR="/home/gort1975/snorkelology/dist/prod/browser"

echo "[$(date -Iseconds)] Starting nightly sitemap generation"

if [[ ! -f "${SITEMAP_SCRIPT}" ]]; then
  echo "[$(date -Iseconds)] FAILURE: sitemap generator not found at ${SITEMAP_SCRIPT}" >&2
  exit 1
fi

mkdir -p "${SITEMAP_OUTPUT_DIR}"

if ! SITEMAP_PATH="${SITEMAP_OUTPUT_DIR}/sitemap.xml" node "${SITEMAP_SCRIPT}"; then
  echo "[$(date -Iseconds)] FAILURE: nightly sitemap generation failed" >&2
  exit 1
fi

echo "[$(date -Iseconds)] Nightly sitemap generation complete"
