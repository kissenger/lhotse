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
DB_NAMES="snorkelology"
RETENTION_DAYS="30"
MONGO_URI="${MONGO_URI:-}"
BACKUP_ROOT="/home/gort1975/mongo_backups"
WORK_DIR="${BACKUP_ROOT}/work-${TIMESTAMP}"
ARCHIVE_PATH="${BACKUP_ROOT}/dump-${TIMESTAMP}.tar.gz"
LOCK_FILE="${BACKUP_ROOT}/.backup.lock"

# move to working directory
cd "/home/gort1975/snorkelology/"

# print working status
echo "$(date -Iseconds) Starting mongo backup" | tee -a "${LOG_FILE}" >&2

printErrorAndExit() {
  echo "$(date -Iseconds) FAILURE ${1}" | tee -a "${LOG_FILE}" >&2
  exit 1
}

if [[ -z "${MONGO_URI}" ]]; then
  printErrorAndExit "FAILURE Error reading .env file"
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
    /usr/local/bin/mongodump --uri="${MONGO_URI}" --db="${db_trimmed}" --out="${WORK_DIR}"
  done
fi

# Create a compressed archive and remove uncompressed dump data.
tar -C "${WORK_DIR}" -czf "${ARCHIVE_PATH}" .

# Delete old archives beyond retention period.
find "${BACKUP_ROOT}" -maxdepth 1 -type f \( -name 'dump-*.tar.gz' -o -name 'dump-*.tar.gz.enc' \) -mtime "+${RETENTION_DAYS}" -delete

# Finish
echo "$(date -Iseconds) Mongo backup completed OK" | tee -a "${LOG_FILE}" >&2
