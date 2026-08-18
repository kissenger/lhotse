#!/usr/bin/env bash

# Shared helpers for maintenance scripts.
# Keep this file at tools/ because the maintenance scripts source it directly.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1090
source "${SCRIPT_DIR}/migration/maintenance-common.sh"