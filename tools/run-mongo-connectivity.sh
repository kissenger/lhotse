#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# import .env file
set -a
# shellcheck disable=SC1090
source "/home/gort1975/snorkelology/.env"
set +a

# read .env variables
LOG_FILE="${LOG_FILE}"
MONGO_CONNECTIVITY_BASE_URL="${MONGO_CONNECTIVITY_BASE_URL:-${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:4001}}"

# move to working directory
cd "/home/gort1975/snorkelology/"

. "/home/gort1975/.nvm/nvm.sh"
nvm use

# print working status
echo "$(date -Iseconds) Starting MongoDB connectivity checks"  

if ! output="$(BASE_URL="${MONGO_CONNECTIVITY_BASE_URL}" node <<'NODE' 2>&1
const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  throw new Error('BASE_URL is required');
}

const UA = 'Mozilla/5.0 (compatible; MongoConnectivityCheck/1.0)';
const TIMEOUT_MS = 15000;

async function fetchJson(path, expectedStatus) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    const text = await response.text();

    if (response.status !== expectedStatus) {
      throw new Error(`Unexpected status for ${path}: ${response.status} (expected ${expectedStatus}). Body: ${text.slice(0, 400)}`);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON for ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const blogPayload = await fetchJson('/api/blog/get-published-posts/', 201);
  if (!Array.isArray(blogPayload)) {
    throw new Error('Blog endpoint payload is not an array');
  }

  const mapPayload = await fetchJson('/api/sites/get-sites/Production', 201);
  if (!mapPayload || mapPayload.type !== 'FeatureCollection' || !Array.isArray(mapPayload.features)) {
    throw new Error('Map endpoint payload is not a valid GeoJSON FeatureCollection');
  }

  console.log(`Checked ${baseUrl}`);
  console.log(`Blog endpoint OK (${blogPayload.length} records)`);
  console.log(`Map endpoint OK (${mapPayload.features.length} features)`);
})();
NODE
)"; then
  if [[ -n "${output}" ]]; then
    echo "$(date -Iseconds) FAILURE connectivity output:"  
    echo "${output}" | sed 's/^/    /'  
  fi
  exit 1
fi

if [[ -n "${output}" ]]; then
  echo "${output}" | sed 's/^/    /'  
fi

echo "$(date -Iseconds) MongoDB connectivity checks completed OK"  
