#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# Backup behavior config lives in-script by request.
ENV_FILE="/home//gort1975/snorkelology/.env"
BACKUP_ROOT="/home/gort1975/mongo_backups"
MIRROR_DIR=""
DB_NAMES="snorkelology"
RETENTION_DAYS="30"


# MongoDB backup script for Linux cron.
# Requires: mongodump, tar, gzip. Optional: openssl, rsync.
#
# Environment variables:
# - ENV_FILE (default: <repo_root>/.env)
# - MONGO_URI (required)
# - BACKUP_PASSPHRASE (optional; enables AES-256 encryption with openssl)
#
# Script settings (edit in this file):
# - BACKUP_ROOT
# - DB_NAMES
# - RETENTION_DAYS
# - MIRROR_DIR


if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Environment file not found: ${ENV_FILE}" >&2
  exit 1
fi

# Export everything loaded from .env so child commands can use it.
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

MONGO_URI="${MONGO_URI:-}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if [[ -z "${MONGO_URI}" ]]; then
  echo "MONGO_URI is required in ${ENV_FILE}." >&2
  echo "If your .env has values with spaces, wrap them in quotes." >&2
  exit 1
fi

# Log the URI source for troubleshooting without exposing credentials.
MONGO_URI_MASKED="$(echo "${MONGO_URI}" | sed -E 's#(mongodb(\+srv)?://)[^@]+@#\1***@#')"
echo "Using MONGO_URI from ${ENV_FILE}: ${MONGO_URI_MASKED}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="${BACKUP_ROOT}/work-${TIMESTAMP}"
ARCHIVE_BASENAME="dump-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${BACKUP_ROOT}/${ARCHIVE_BASENAME}"
LOCK_FILE="${BACKUP_ROOT}/.backup.lock"

mkdir -p "${BACKUP_ROOT}"

# Prevent overlapping runs.
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Backup already running; exiting." >&2
  exit 1
fi

cleanup() {
  rm -rf "${WORK_DIR}" || true
}
trap cleanup EXIT

mkdir -p "${WORK_DIR}"

echo "[$(date -Iseconds)] Starting MongoDB backup"

if [[ -n "${DB_NAMES}" ]]; then
  IFS=',' read -r -a DBS <<< "${DB_NAMES}"
  for db in "${DBS[@]}"; do
    db_trimmed="$(echo "${db}" | xargs)"
    [[ -z "${db_trimmed}" ]] && continue
    mongodump --uri="${MONGO_URI}" --db="${db_trimmed}" --out="${WORK_DIR}"
  done
else
  mongodump --uri="${MONGO_URI}" --out="${WORK_DIR}"
fi

# Create a compressed archive and remove uncompressed dump data.
tar -C "${WORK_DIR}" -czf "${ARCHIVE_PATH}" .

if [[ -n "${BACKUP_PASSPHRASE}" ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl not found but BACKUP_PASSPHRASE is set." >&2
    exit 1
  fi

  ENC_PATH="${ARCHIVE_PATH}.enc"
  openssl enc -aes-256-cbc -salt -pbkdf2 -in "${ARCHIVE_PATH}" -out "${ENC_PATH}" -pass "pass:${BACKUP_PASSPHRASE}"
  rm -f "${ARCHIVE_PATH}"
  ARCHIVE_PATH="${ENC_PATH}"
fi

if [[ -n "${MIRROR_DIR}" ]]; then
  mkdir -p "${MIRROR_DIR}"
  if ! command -v rsync >/dev/null 2>&1; then
    echo "rsync not found but MIRROR_DIR is set." >&2
    exit 1
  fi
  rsync -a --delete "${BACKUP_ROOT}/" "${MIRROR_DIR}/"
fi

# Delete old archives beyond retention period.
find "${BACKUP_ROOT}" -maxdepth 1 -type f \( -name 'dump-*.tar.gz' -o -name 'dump-*.tar.gz.enc' \) -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup completed: ${ARCHIVE_PATH}"
