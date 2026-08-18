#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE_OVERRIDE:-${ENV_FILE:-${REPO_ROOT}/.env}}"
source "${SCRIPT_DIR}/maintenance-common.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "${TIMESTAMP:-$(date -Iseconds)} ERROR .env file not found at ${ENV_FILE}" >&2
  exit 1
fi

maintenance_load_env_file "${ENV_FILE}"

# read .env variables
TIMESTAMP="$(date -Iseconds)"
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/mongo-backup.log}"
DB_NAMES="${DB_NAMES:-snorkelology}"
DAILY_RETENTION_DAYS="${DAILY_RETENTION_DAYS:-30}"
YEARLY_RETENTION_DAYS="${YEARLY_RETENTION_DAYS:-365}"
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

retention_period_days() {
  local file_path="$1"
  local file_epoch current_epoch age_days

  file_epoch="$(stat -c %Y "${file_path}")"
  current_epoch="$(date +%s)"
  age_days=$(( (current_epoch - file_epoch) / 86400 ))
  echo "${age_days}"
}

prune_mongo_backups() {
  local -a backup_files=()
  local -A keep_daily=()
  local -A keep_monthly=()
  local -A keep_yearly=()
  local file_path file_epoch age_days day_key month_key year_key bucket_key

  while IFS= read -r -d '' file_path; do
    backup_files+=("${file_path}")
  done < <(find "${BACKUP_ROOT}" -maxdepth 1 -type f \( -name 'dump-*.tar.gz' -o -name 'dump-*.tar.gz.enc' \) -print0)

  if [[ "${#backup_files[@]}" -eq 0 ]]; then
    return 0
  fi

  mapfile -t backup_files < <(
    for file_path in "${backup_files[@]}"; do
      printf '%s\t%s\n' "$(stat -c %Y "${file_path}")" "${file_path}"
    done | sort -rn | cut -f2-
  )

  for file_path in "${backup_files[@]}"; do
    file_epoch="$(stat -c %Y "${file_path}")"
    age_days=$(( ( $(date +%s) - file_epoch ) / 86400 ))

    if [[ "${age_days}" -le "${DAILY_RETENTION_DAYS}" ]]; then
      day_key="$(date -u -d "@${file_epoch}" +%F)"
      if [[ -z "${keep_daily[${day_key}]:-}" ]]; then
        keep_daily["${day_key}"]="${file_path}"
      fi
      continue
    fi

    if [[ "${age_days}" -le "${YEARLY_RETENTION_DAYS}" ]]; then
      month_key="$(date -u -d "@${file_epoch}" +%Y-%m)"
      if [[ -z "${keep_monthly[${month_key}]:-}" ]]; then
        keep_monthly["${month_key}"]="${file_path}"
      fi
      continue
    fi

    year_key="$(date -u -d "@${file_epoch}" +%Y)"
    if [[ -z "${keep_yearly[${year_key}]:-}" ]]; then
      keep_yearly["${year_key}"]="${file_path}"
    fi
  done

  declare -A keep_set=()
  for bucket_key in "${!keep_daily[@]}"; do
    keep_set["${keep_daily[${bucket_key}]}"]=1
  done
  for bucket_key in "${!keep_monthly[@]}"; do
    keep_set["${keep_monthly[${bucket_key}]}"]=1
  done
  for bucket_key in "${!keep_yearly[@]}"; do
    keep_set["${keep_yearly[${bucket_key}]}"]=1
  done

  for file_path in "${backup_files[@]}"; do
    if [[ -z "${keep_set[${file_path}]:-}" ]]; then
      rm -f "${file_path}"
    fi
  done
}

if [[ -z "${MONGO_URI}" ]]; then
  printErrorAndExit "MONGO_URI is empty or missing in ${ENV_FILE}"
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

# Delete old archives using tiered retention: daily for ${DAILY_RETENTION_DAYS} days,
# monthly for the next period, and yearly thereafter.
prune_mongo_backups

# Finish
echo "${TIMESTAMP} Mongo backup completed OK"
