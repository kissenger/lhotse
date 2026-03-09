#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/maintenance-common.sh"

DEFAULT_LOG_FILE="${REPO_ROOT}/logs/restore-mongo.log"

# MongoDB restore script for backups created by tools/run-mongo-backup-nightly.sh.
# Requires: mongorestore, tar, gzip. Optional: openssl (for .enc backups).
#
# RUN AS:
# sh ./tools/restore-mongo.sh --yes --file /home/gort1975/mongo_backups/dump-20260307-112203.tar.gz --db snorkelology
# 

ENV_FILE="/home/gort1975/snorkelology/.env"
BACKUP_ROOT="/home/gort1975/mongo_backups"

maintenance_init "restore-mongo.sh" "${ENV_FILE}" "${DEFAULT_LOG_FILE}"
WORK_DIR=""

SHOW_HELP=0
USE_LATEST=0
FILE_PATH=""
DROP_FLAG=0
DB_NAME=""
TARGET_DB_NAME=""
CONFIRMED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --latest)
      USE_LATEST=1
      shift
      ;;
    --file)
      FILE_PATH="${2:-}"
      shift 2
      ;;
    --drop)
      DROP_FLAG=1
      shift
      ;;
    --db)
      DB_NAME="${2:-}"
      shift 2
      ;;
    --target-db)
      TARGET_DB_NAME="${2:-}"
      shift 2
      ;;
    --yes)
      CONFIRMED=1
      shift
      ;;
    -h|--help)
      SHOW_HELP=1
      shift
      ;;
    *)
      maintenance_log_failure "unknown argument: $1"
      SHOW_HELP=1
      break
      ;;
  esac
done

if [[ ${SHOW_HELP} -eq 1 ]]; then
  cat <<'EOF'
Usage:
  restore-mongo.sh --latest --yes --db SOURCE_DB [--target-db TARGET_DB] [--drop]
  restore-mongo.sh --file /path/to/dump-YYYYMMDD-HHMMSS.tar.gz --yes --db SOURCE_DB [--target-db TARGET_DB] [--drop]

Options:
  --latest        Restore the newest backup in BACKUP_ROOT.
  --file PATH     Restore from a specific backup file (.tar.gz or .tar.gz.enc).
  --db SOURCE_DB  Source database folder in the backup archive.
  --target-db DB  Target database name to create/use for restore.
                  Default: <SOURCE_DB>_restore_<YYYYMMDDHHMMSS>
  --drop          Optional: drop collections in target DB before restore.
  --yes           Required safety flag to execute restore.
  -h, --help      Show this help.
EOF
  exit 0
fi

if [[ ${CONFIRMED} -ne 1 ]]; then
  maintenance_fail "refusing to run without --yes (safety check)"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  maintenance_fail "environment file not found: ${ENV_FILE}"
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

MONGO_URI="${MONGO_URI:-}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if [[ -z "${MONGO_URI}" ]]; then
  maintenance_fail "MONGO_URI is required in ${ENV_FILE}. If your .env has values with spaces, wrap them in quotes."
fi

if [[ -n "${FILE_PATH}" && ${USE_LATEST} -eq 1 ]]; then
  maintenance_fail "use either --latest or --file, not both"
fi

if [[ -z "${FILE_PATH}" && ${USE_LATEST} -ne 1 ]]; then
  maintenance_fail "provide one restore source: --latest or --file PATH"
fi

if [[ -z "${DB_NAME}" ]]; then
  maintenance_fail "--db SOURCE_DB is required to ensure safe restore into a new target database"
fi

if [[ -z "${TARGET_DB_NAME}" ]]; then
  TARGET_DB_NAME="${DB_NAME}_restore_$(date +%Y%m%d%H%M%S)"
fi

if [[ "${DB_NAME}" == "${TARGET_DB_NAME}" ]]; then
  maintenance_fail "target DB must differ from source DB to avoid overwriting existing collections"
fi

if [[ ${USE_LATEST} -eq 1 ]]; then
  FILE_PATH="$(find "${BACKUP_ROOT}" -maxdepth 1 -type f \( -name 'dump-*.tar.gz' -o -name 'dump-*.tar.gz.enc' \) -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
  if [[ -z "${FILE_PATH}" ]]; then
    maintenance_fail "no backup archives found in ${BACKUP_ROOT}"
  fi
fi

if [[ ! -f "${FILE_PATH}" ]]; then
  maintenance_fail "backup file not found: ${FILE_PATH}"
fi

WORK_DIR="$(mktemp -d)"
cleanup() {
  if [[ -n "${WORK_DIR}" ]]; then
    rm -rf "${WORK_DIR}" || true
  fi
}

finalize() {
  local exit_code="$?"
  cleanup
  maintenance_finalize "${exit_code}"
}
trap finalize EXIT

ARCHIVE_TO_EXTRACT="${FILE_PATH}"
if [[ "${FILE_PATH}" == *.enc ]]; then
  if [[ -z "${BACKUP_PASSPHRASE}" ]]; then
    maintenance_fail "BACKUP_PASSPHRASE is required to decrypt .enc backups"
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    maintenance_fail "openssl not found but encrypted backup provided"
  fi

  ARCHIVE_TO_EXTRACT="${WORK_DIR}/decrypted.tar.gz"
  openssl enc -d -aes-256-cbc -pbkdf2 -in "${FILE_PATH}" -out "${ARCHIVE_TO_EXTRACT}" -pass "pass:${BACKUP_PASSPHRASE}"
fi

EXTRACT_DIR="${WORK_DIR}/dump"
mkdir -p "${EXTRACT_DIR}"
tar -C "${EXTRACT_DIR}" -xzf "${ARCHIVE_TO_EXTRACT}"

RESTORE_ARGS=(--uri="${MONGO_URI}")
if [[ ${DROP_FLAG} -eq 1 ]]; then
  RESTORE_ARGS+=(--drop)
fi

if [[ ! -d "${EXTRACT_DIR}/${DB_NAME}" ]]; then
  maintenance_fail "database '${DB_NAME}' not found in backup archive"
fi

# Non-destructive restore: map source namespace to a separate target DB.
RESTORE_ARGS+=(--nsFrom="${DB_NAME}.*" --nsTo="${TARGET_DB_NAME}.*" "${EXTRACT_DIR}/${DB_NAME}")

maintenance_log_success "restoring from ${FILE_PATH}"
maintenance_log_success "source DB ${DB_NAME} -> target DB ${TARGET_DB_NAME}"

if ! output="$(mongorestore "${RESTORE_ARGS[@]}" 2>&1)"; then
  maintenance_log_failure "mongorestore failed"
  if [[ -n "${output}" ]]; then
    while IFS= read -r line; do
      [[ -n "${line}" ]] && maintenance_log_failure "mongorestore output: ${line}"
    done <<< "${output}"
  fi
  exit 1
fi

maintenance_log_success "restore completed successfully"
