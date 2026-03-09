#!/usr/bin/env bash

# --- Ops repo snapshot notes ---
# This script copies selected server configuration files (nginx, systemd, fail2ban, logrotate, sudoers, certbot, etc.)
# into structured directories within the ops repo, creating a snapshot of the current server state.
# After copying, it typically adds and commits these files to git, ensuring versioned backups and auditability.
# The copied files are not linked to the live config; they are static snapshots.
# To capture future changes, re-run the script (or a similar update script) to refresh the snapshots, then commit.
# You can skip the git init step for subsequent runs—just update files and commit as usual.
# This approach requires manual or automated refreshes to keep the repo in sync with the server.
#
# Usage: bash tools/run-git.sh "Your commit message here"
# The commit message will be used for the git commit.
# If no message is provided, it defaults to "Snapshot update".

COMMIT_MSG="${1:-Snapshot update}"

# ...existing code from serverside-git-init.sh...
