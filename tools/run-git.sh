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

#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# --- Ops repo snapshot notes ---
# This script copies selected server configuration files (nginx, systemd, fail2ban, logrotate, sudoers, certbot, etc.)
# into structured directories within the ops repo, creating a snapshot of the current server state.
# After copying, it typically adds and commits these files to git, ensuring versioned backups and auditability.
# The copied files are not linked to the live config; they are static snapshots.
# To capture future changes, re-run the script (or a similar update script) to refresh the snapshots, then commit.
# You can skip the git init step for subsequent runs—just update files and commit as usual.
# This approach requires manual or automated refreshes to keep the repo in sync with the server.
#
# Summary:
# - Initial run: creates repo, copies config, git init, commit.
# - Subsequent runs: re-copy config, git add/commit (skip git init).
# - Snapshots are not live-linked; manual refresh is needed.
# - Never commit private keys or secrets.
# --- End notes ---

# 0) Edit these first
OPS_REPO_DIR=/home/gort1975/snorkelology/ops-config
OPS_REMOTE=git@github.com:kissenger/lhotse_server.git
APP_DIR=/home/gort1975/snorkelology
USER_NAME=$(whoami)
HOST_NAME=$(hostname)
SNAPSHOT_TS=$(date +%F-%H%M%S)

# 1) Create and initialize new ops repo
# mkdir -p "$OPS_REPO_DIR"
# cd "$OPS_REPO_DIR"
# git init

# 2) Create folders mirroring server config domains
mkdir -p etc/nginx/sites-available
mkdir -p etc/nginx/sites-enabled
mkdir -p etc/systemd/system
mkdir -p etc/ssh/sshd_config.d
mkdir -p etc/fail2ban/jail.d
mkdir -p etc/logrotate.d
mkdir -p etc/sudoers.d
mkdir -p etc/letsencrypt/renewal
mkdir -p var/spool/cron
mkdir -p home/gort1975/snorkelology
mkdir -p home/gort1975/.pm2
mkdir -p home/gort1975/.ssh
mkdir -p firewall
mkdir -p packages
mkdir -p docs
mkdir -p scripts

# 3) NGINX (live config)
sudo cp -a /etc/nginx/sites-available/default etc/nginx/sites-available/default
sudo cp -a /etc/nginx/sites-enabled/default etc/nginx/sites-enabled/default

# 4) CRON (current user crontab)
crontab -l > "var/spool/cron/${USER_NAME}.cron"

# 5) PM2 ecosystem + runtime snapshot
cp -a "$APP_DIR/ecosystem.config.cjs" home/gort1975/snorkelology/ecosystem.config.cjs
cp -a /home/gort1975/.pm2/dump.pm2 home/gort1975/.pm2/dump.pm2 2>/dev/null || true
pm2 status > "home/gort1975/.pm2/pm2-status-${SNAPSHOT_TS}.txt" || true
pm2 ls --json > "home/gort1975/.pm2/pm2-ls-${SNAPSHOT_TS}.json" || true

# 6) systemd units/timers/paths (custom)
sudo find /etc/systemd/system -maxdepth 1 -type f \( -name "*.service" -o -name "*.timer" -o -name "*.path" \) -exec cp -a {} etc/systemd/system/ \;

# 7) SSH server config + authorized_keys (NO private keys)
sudo cp -a /etc/ssh/sshd_config etc/ssh/sshd_config
sudo cp -a /etc/ssh/sshd_config.d/. etc/ssh/sshd_config.d/ 2>/dev/null || true
cp -a "/home/${USER_NAME}/.ssh/authorized_keys" "home/gort1975/.ssh/authorized_keys" 2>/dev/null || true

# 8) Firewall snapshots
sudo ufw status numbered > "firewall/ufw-status-${SNAPSHOT_TS}.txt" 2>/dev/null || true
sudo nft list ruleset > "firewall/nft-ruleset-${SNAPSHOT_TS}.txt" 2>/dev/null || true
sudo iptables-save > "firewall/iptables-${SNAPSHOT_TS}.rules" 2>/dev/null || true

# 9) Fail2ban config (if installed)
sudo cp -a /etc/fail2ban/jail.local etc/fail2ban/jail.local 2>/dev/null || true
sudo cp -a /etc/fail2ban/jail.d/. etc/fail2ban/jail.d/ 2>/dev/null || true

# 10) Logrotate and sudoers custom snippets
sudo cp -a /etc/logrotate.d/. etc/logrotate.d/ 2>/dev/null || true
sudo cp -a /etc/sudoers.d/. etc/sudoers.d/ 2>/dev/null || true

# 11) TLS renewal config (NO private keys/certs)
sudo cp -a /etc/letsencrypt/renewal/. etc/letsencrypt/renewal/ 2>/dev/null || true

# 12) Package baseline snapshots
dpkg --get-selections > "packages/dpkg-selections-${SNAPSHOT_TS}.txt" 2>/dev/null || true
apt-mark showmanual > "packages/apt-manual-${SNAPSHOT_TS}.txt" 2>/dev/null || true
systemctl list-unit-files --type=service > "packages/systemd-services-${SNAPSHOT_TS}.txt" 2>/dev/null || true

cat > docs/RUNBOOK.md <<'EOF'
# Server Runbook

## Host
- Hostname:
- IP:
- OS:

## Services
- Nginx
- PM2 apps
- MongoDB dependency

## Recovery Checklist
1. Restore nginx config and validate: nginx -t
2. Restore systemd units and daemon-reload
3. Restore crontab
4. Restore ecosystem file and pm2 start/save
5. Verify health URLs
EOF

# 14) Add a top-level README in ops repo
cat > README.md <<EOF
# Ops Config Repository

Server: ${HOST_NAME}
Snapshot: ${SNAPSHOT_TS}

Contains versioned server operational config from live locations:
- nginx site config
- systemd units/timers/paths
- cron
- PM2 ecosystem + state snapshots
- sshd config (no private keys)
- firewall snapshots
- fail2ban/logrotate/sudoers snippets
- certbot renewal config (no private keys)

DO NOT COMMIT:
- private keys
- plaintext secrets
- certificate private material

## Recovery Steps

Run these steps on a rebuilt/recovered server after cloning this repo.

1. Restore nginx config and reload:
  - sudo install -m 644 etc/nginx/sites-available/snorkelology.conf /etc/nginx/sites-available/snorkelology.conf
  - sudo ln -sfn /etc/nginx/sites-available/snorkelology.conf /etc/nginx/sites-enabled/snorkelology.conf
  - sudo nginx -t
  - sudo systemctl reload nginx

2. Restore systemd custom units:
  - sudo install -m 644 etc/systemd/system/*.service /etc/systemd/system/ 2>/dev/null || true
  - sudo install -m 644 etc/systemd/system/*.timer /etc/systemd/system/ 2>/dev/null || true
  - sudo install -m 644 etc/systemd/system/*.path /etc/systemd/system/ 2>/dev/null || true
  - sudo systemctl daemon-reload

3. Restore crontab:
  - crontab var/spool/cron/${USER_NAME}.cron
  - crontab -l

4. Restore PM2 ecosystem and processes:
  - cp -f home/gort1975/snorkelology/ecosystem.config.cjs /home/gort1975/snorkelology/ecosystem.config.cjs
  - cd /home/gort1975/snorkelology
  - pm2 start ecosystem.config.cjs
  - pm2 save
  - pm2 status

5. Restore SSH daemon config (no private keys):
  - sudo cp -a etc/ssh/sshd_config /etc/ssh/sshd_config
  - sudo cp -a etc/ssh/sshd_config.d/. /etc/ssh/sshd_config.d/ 2>/dev/null || true
  - sudo sshd -t
  - sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd

6. Post-recovery validation:
  - curl -I https://snorkelology.co.uk
  - curl -I https://beta.snorkelology.co.uk
  - pm2 logs --lines 100 snorkelology_master
  - pm2 logs --lines 100 snorkelology_beta
EOF

# 15) Protect against accidental secret/key commits
cat > .gitignore <<'EOF'
# Never commit private key material
**/id_rsa
**/id_ed25519
**/ssh_host_*_key
**/privkey.pem
**/*.key
**/*.p12
**/*.pfx
**/.env

# Never commit app project files from live server snapshots
home/gort1975/snorkelology/**
!home/gort1975/snorkelology/
!home/gort1975/snorkelology/ecosystem.config.cjs
EOF

# 16) Commit
git add .
git commit -m "$COMMIT_MSG"

# 17) Optional: connect remote and push
git remote add origin "$OPS_REMOTE"
git branch -M master
git push -u origin master

# 18) Quick validations after backup capture
sudo nginx -t
pm2 status
crontab -l
