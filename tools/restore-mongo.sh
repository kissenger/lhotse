#!/usr/bin/env bash
set -euo pipefail

# MongoDB restore script for backups created by tools/backup-mongo.sh.
# Requires: mongorestore, tar, gzip. Optional: openssl (for .enc backups).
#
# Environment variables:
# - ENV_FILE (default: <repo_root>/.env)
# - MONGO_URI (required)
# - BACKUP_PASSPHRASE (required only for .enc backups)
#
# Script settings (edit in this file):
# - BACKUP_ROOT
#
# Usage:
#   ./restore-mongo.sh --latest --yes --db SOURCE_DB [--target-db TARGET_DB] [--drop]
#   ./restore-mongo.sh --file /var/backups/mongodb/dump-20260307-021500.tar.gz --yes --db SOURCE_DB [--target-db TARGET_DB] [--drop]
#   ENV_FILE=/etc/lhotse.env ./restore-mongo.sh --latest --yes --db snorkelology --target-db snorkelology_restore_test


ENV_FILE="/home/gort1975/.env"
BACKUP_ROOT="/home/gort1975/mongo_backups"

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
      echo "Unknown argument: $1" >&2
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
  echo "Refusing to run without --yes (safety check)." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Environment file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

MONGO_URI="${MONGO_URI:-}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if [[ -z "${MONGO_URI}" ]]; then
  echo "MONGO_URI is required in ${ENV_FILE}." >&2
  exit 1
fi

if [[ -n "${FILE_PATH}" && ${USE_LATEST} -eq 1 ]]; then
  echo "Use either --latest or --file, not both." >&2
  exit 1
fi

if [[ -z "${FILE_PATH}" && ${USE_LATEST} -ne 1 ]]; then
  echo "Provide one restore source: --latest or --file PATH." >&2
  exit 1
fi

if [[ -z "${DB_NAME}" ]]; then
  echo "--db SOURCE_DB is required to ensure safe restore into a new target database." >&2
  exit 1
fi

if [[ -z "${TARGET_DB_NAME}" ]]; then
  TARGET_DB_NAME="${DB_NAME}_restore_$(date +%Y%m%d%H%M%S)"
fi

if [[ "${DB_NAME}" == "${TARGET_DB_NAME}" ]]; then
  echo "Target DB must differ from source DB to avoid overwriting existing collections." >&2
  exit 1
fi

if [[ ${USE_LATEST} -eq 1 ]]; then
  FILE_PATH="$(find "${BACKUP_ROOT}" -maxdepth 1 -type f \( -name 'dump-*.tar.gz' -o -name 'dump-*.tar.gz.enc' \) -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
  if [[ -z "${FILE_PATH}" ]]; then
    echo "No backup archives found in ${BACKUP_ROOT}." >&2
    exit 1
  fi
fi

if [[ ! -f "${FILE_PATH}" ]]; then
  echo "Backup file not found: ${FILE_PATH}" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${WORK_DIR}" || true
}
trap cleanup EXIT

ARCHIVE_TO_EXTRACT="${FILE_PATH}"
if [[ "${FILE_PATH}" == *.enc ]]; then
  if [[ -z "${BACKUP_PASSPHRASE}" ]]; then
    echo "BACKUP_PASSPHRASE is required to decrypt .enc backups." >&2
    exit 1
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl not found but encrypted backup provided." >&2
    exit 1
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
  echo "Database '${DB_NAME}' not found in backup archive." >&2
  exit 1
fi

# Non-destructive restore: map source namespace to a separate target DB.
RESTORE_ARGS+=(--nsFrom="${DB_NAME}.*" --nsTo="${TARGET_DB_NAME}.*" "${EXTRACT_DIR}/${DB_NAME}")

echo "[$(date -Iseconds)] Restoring from: ${FILE_PATH}"
echo "[$(date -Iseconds)] Source DB: ${DB_NAME} -> Target DB: ${TARGET_DB_NAME}"
mongorestore "${RESTORE_ARGS[@]}"
echo "[$(date -Iseconds)] Restore completed successfully"
