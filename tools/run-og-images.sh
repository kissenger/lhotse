#!/bin/bash

# Regenerate OG images for all published article posts
# This script should be run periodically (e.g., via cron)
#
# Usage:
#   ./tools/run-og-images.sh
#
# Environment variables:
#   MONGO_URI: Connection string to MongoDB (required)
#   OG_ARTICLES_DIR: Path to articles directory (optional)
#   OG_LOGO_PATH: Path to logo file (optional)
#   OG_LOGO_WIDTH_RATIO: Logo width ratio (default: 0.16)
#   OG_LOGO_MARGIN_X: Logo margin X (default: 60)
#   OG_LOGO_MARGIN_Y: Logo margin Y (default: 30)

set -euo pipefail

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
REPO_ROOT="$PROJECT_ROOT"

# Log file
LOG_FILE="$PROJECT_ROOT/logs/regenerate-og-images.log"
LOG_DIR="$( dirname "$LOG_FILE" )"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

log() {
  local level=$1
  shift
  local message="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "${timestamp} [${level}] ${message}" >> "$LOG_FILE"
}

error_exit() {
  local message="$*"
  log "ERROR" "$message"
  echo "run-og-images.sh: ERROR: $message" >&2
  echo "See log: $LOG_FILE" >&2
  exit 1
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  error_exit "Node.js is not installed"
fi

# Change to project root
cd "$PROJECT_ROOT"

# Load environment file. Match existing run-* scripts by default,
# while allowing ENV_FILE override and project-local fallback.
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
if [ ! -f "$ENV_FILE" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  ENV_FILE="$PROJECT_ROOT/.env"
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Check if MongoDB URI is set
if [ -z "${MONGO_URI:-}" ]; then
  error_exit "MONGO_URI environment variable is not set"
fi

# Export variables for the script
export MONGO_URI
export OG_ARTICLES_DIR="${OG_ARTICLES_DIR:-}"
export OG_LOGO_PATH="${OG_LOGO_PATH:-}"
export OG_LOGO_WIDTH_RATIO="${OG_LOGO_WIDTH_RATIO:-0.16}"
export OG_LOGO_MARGIN_X="${OG_LOGO_MARGIN_X:-60}"
export OG_LOGO_MARGIN_Y="${OG_LOGO_MARGIN_Y:-30}"
export OG_LOGO_LEFT="${OG_LOGO_LEFT:-}"
export OG_LOGO_TOP="${OG_LOGO_TOP:-}"

log "INFO" "Starting OG image regeneration"

TMP_OUTPUT="$(mktemp)"
trap 'rm -f "$TMP_OUTPUT"' EXIT

if node "$SCRIPT_DIR/regenerate-og-images.mjs" > "$TMP_OUTPUT" 2>&1; then
  cat "$TMP_OUTPUT" >> "$LOG_FILE"
  log "INFO" "OG image regeneration completed successfully"
  exit 0
fi

EXIT_CODE=$?
cat "$TMP_OUTPUT" >> "$LOG_FILE"
log "ERROR" "OG image regeneration failed with exit code $EXIT_CODE"
echo "run-og-images.sh: ERROR: OG image regeneration failed (exit $EXIT_CODE)" >&2
cat "$TMP_OUTPUT" >&2
echo "See log: $LOG_FILE" >&2
exit "$EXIT_CODE"
