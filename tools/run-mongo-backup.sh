#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

# import .env file
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# read .env variables
TIMESTAMP="$(date -Iseconds)"
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/mongo-backup.log}"
DB_NAMES="${DB_NAMES:-snorkelology}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MONGO_URI="${MONGO_URI:-}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/mongo_backups}"
WORK_DIR="${BACKUP_ROOT}/work-${TIMESTAMP}"
ARCHIVE_PATH="${BACKUP_ROOT}/dump-${TIMESTAMP}.tar.gz"
LOCK_FILE="${BACKUP_ROOT}/.backup.lock"

mkdir -p "$(dirname -- "${LOG_FILE}")"

# move to working directory
cd "${REPO_ROOT}"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [[ -s "${NVM_SCRIPT}" ]]; then
  # shellcheck disable=SC1090
  . "${NVM_SCRIPT}"
  nvm use >/dev/null || true
fi

MONGODUMP_BIN="${MONGODUMP_BIN:-$(command -v mongodump || true)}"

# print working status
echo "${TIMESTAMP} Starting mongo backup"

printErrorAndExit() {
  echo "${TIMESTAMP} FAILURE ${1}"
  exit 1
}

if [[ -z "${MONGO_URI}" ]]; then
  printErrorAndExit "FAILURE Error reading .env file"
fi

if [[ -z "${MONGODUMP_BIN}" ]]; then
  printErrorAndExit "FAILURE mongodump command not found"
fi

mkdir -p "${BACKUP_ROOT}"
mkdir -p "${WORK_DIR}"

# Prevent overlapping runs.
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  printErrorAndExit "FAILURE Backup already running"
fi

# Create backup
if [[ -n "${DB_NAMES}" ]]; then
  IFS=',' read -r -a DBS <<< "${DB_NAMES}"
  for db in "${DBS[@]}"; do
    db_trimmed="$(echo "${db}" | xargs)"
    [[ -z "${db_trimmed}" ]] && continue
    "${MONGODUMP_BIN}" --uri="${MONGO_URI}" --db="${db_trimmed}" --out="${WORK_DIR}"
  done
fi

# Create a compressed archive and remove uncompressed dump data.
tar -C "${WORK_DIR}" -czf "${ARCHIVE_PATH}" .
rm -rf "${WORK_DIR}"

# Delete old archives beyond retention period.
find "${BACKUP_ROOT}" -maxdepth 1 -type f \( -name 'dump-*.tar.gz' -o -name 'dump-*.tar.gz.enc' \) -mtime "+${RETENTION_DAYS}" -delete

# Finish
echo "${TIMESTAMP} Mongo backup completed OK"
