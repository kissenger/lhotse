#!/usr/bin/env bash
# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

# --- Ops repo snapshot notes ---
# Summary:
# - Initial run: creates repo, copies config, git init, commit.
# - Subsequent runs: re-copy config, git add/commit (skip git init).
# - Snapshots are not live-linked; manual refresh is needed.
# - Never commit private keys or secrets.
# --- End notes ---

COMMIT_MSG="${1:-Snapshot update}"

# 0) Edit these first
OPS_REPO_DIR=/home/gort1975/snorkelology/ops-config
OPS_REMOTE=git@github.com:kissenger/lhotse.git
OPS_BRANCH="server-config"
APP_DIR=/home/gort1975/snorkelology
USER_NAME=$(whoami)
HOST_NAME=$(hostname)
SNAPSHOT_TS=$(date +%F-%H%M%S)

# 2) Create folder structure
if [ -d "$OPS_REPO_DIR" ]; then
  cd "$OPS_REPO_DIR"
else
  mkdir -p "$OPS_REPO_DIR"
  cd "$OPS_REPO_DIR"
fi

git checkout "$OPS_BRANCH" 2>/dev/null || git checkout -b "$OPS_BRANCH"

mkdir -p etc/nginx/sites-available
mkdir -p etc/nginx/sites-enabled
mkdir -p etc/systemd/system
mkdir -p etc/ssh/sshd_config.d
mkdir -p etc/fail2ban/jail.d
mkdir -p etc/logrotate.d
mkdir -p etc/letsencrypt/renewal
mkdir -p var/spool/cron
mkdir -p home/gort1975/snorkelology
mkdir -p home/gort1975/.pm2
mkdir -p home/gort1975/.ssh
mkdir -p firewall
mkdir -p packages
mkdir -p docs
mkdir -p scripts

# 3) copy snapshot of config files of interest
sudo cp -a /etc/nginx/sites-available/default etc/nginx/sites-available/default
sudo cp -a /etc/nginx/sites-enabled/default etc/nginx/sites-enabled/default

crontab -l > "var/spool/cron/${USER_NAME}.cron"

cp -a "$APP_DIR/ecosystem.config.cjs" home/gort1975/snorkelology/ecosystem.config.cjs
cp -a /home/gort1975/.pm2/dump.pm2 home/gort1975/.pm2/dump.pm2 2>/dev/null || true
pm2 status > "home/gort1975/.pm2/pm2-status-${SNAPSHOT_TS}.txt" || true
pm2 ls > "home/gort1975/.pm2/pm2-ls-${SNAPSHOT_TS}.txt" || true

sudo find /etc/systemd/system -maxdepth 1 -type f \( -name "*.service" -o -name "*.timer" -o -name "*.path" \) -exec cp -a {} etc/systemd/system/ \;

sudo cp -a /etc/ssh/sshd_config etc/ssh/sshd_config
sudo cp -a /etc/ssh/sshd_config.d/. etc/ssh/sshd_config.d/ 2>/dev/null || true
cp -a "/home/${USER_NAME}/.ssh/authorized_keys" "home/gort1975/.ssh/authorized_keys" 2>/dev/null || true

sudo ufw status numbered > "firewall/ufw-status-${SNAPSHOT_TS}.txt" 2>/dev/null || true
sudo nft list ruleset > "firewall/nft-ruleset-${SNAPSHOT_TS}.txt" 2>/dev/null || true
sudo iptables-save > "firewall/iptables-${SNAPSHOT_TS}.rules" 2>/dev/null || true

sudo cp -a /etc/fail2ban/jail.local etc/fail2ban/jail.local 2>/dev/null || true
sudo cp -a /etc/fail2ban/jail.d/. etc/fail2ban/jail.d/ 2>/dev/null || true

sudo cp -a /etc/logrotate.d/. etc/logrotate.d/ 2>/dev/null || true

sudo cp -a /etc/letsencrypt/renewal/. etc/letsencrypt/renewal/ 2>/dev/null || true

dpkg --get-selections > "packages/dpkg-selections-${SNAPSHOT_TS}.txt" 2>/dev/null || true
apt-mark showmanual > "packages/apt-manual-${SNAPSHOT_TS}.txt" 2>/dev/null || true
systemctl list-unit-files --type=service > "packages/systemd-services-${SNAPSHOT_TS}.txt" 2>/dev/null || true


# 4) Commit
git add .
git commit -m "$COMMIT_MSG"
git push origin "$OPS_BRANCH"
cd ..
git checkout master

