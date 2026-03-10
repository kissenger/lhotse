#!/usr/bin/env bash
# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

# --- Ops repo snapshot notes ---
# Summary:
# - Copies config, git add/commit (skip git init).
# - Snapshots are not live-linked; manual refresh is needed.
# - Never commit private keys or secrets.
# --- End notes ---

COMMIT_MSG="${1:-Snapshot update}"

# 0) Edit these first
OPS_REPO_DIR=/home/gort1975/snorkelology/config-backup
OPS_REMOTE=git@github.com:kissenger/lhotse.git
OPS_BRANCH="config-backup"
APP_DIR=/home/gort1975/snorkelology
USER_NAME=$(whoami)
HOST_NAME=$(hostname)
SNAPSHOT_TS=$(date +%F-%H%M%S)

# 1) Switch to target branch
git checkout "$OPS_BRANCH"
echo "Checked out branch: $OPS_BRANCH"

# 2) Create folder structure
if [ -d "$OPS_REPO_DIR" ]; then
  echo "Deleting existing ops repo directory: $OPS_REPO_DIR"
  sudo rm -rf "$OPS_REPO_DIR"
fi
echo "Creating ops repo directory: $OPS_REPO_DIR"
mkdir -p "$OPS_REPO_DIR"
cd "$OPS_REPO_DIR"
echo "Created and entered ops repo directory: $OPS_REPO_DIR"

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
echo "Copying nginx config..."
sudo cp -a /etc/nginx/sites-available/default etc/nginx/sites-available/default
sudo cp -a /etc/nginx/sites-enabled/default etc/nginx/sites-enabled/default

echo "Exporting crontab..."
crontab -l > "var/spool/cron/${USER_NAME}.cron"

echo "Copying PM2 ecosystem and state..."
cp -a "$APP_DIR/ecosystem.config.cjs" home/gort1975/snorkelology/ecosystem.config.cjs
cp -a /home/gort1975/.pm2/dump.pm2 home/gort1975/.pm2/dump.pm2 2>/dev/null || true
pm2 status > "home/gort1975/.pm2/pm2-status-${SNAPSHOT_TS}.txt" || true
pm2 ls > "home/gort1975/.pm2/pm2-ls-${SNAPSHOT_TS}.txt" || true

echo "Copying systemd units/timers/paths..."
sudo find /etc/systemd/system -maxdepth 1 -type f \( -name "*.service" -o -name "*.timer" -o -name "*.path" \) -exec cp -a {} etc/systemd/system/ \;

echo "Copying SSH config and authorized_keys..."
sudo cp -a /etc/ssh/sshd_config etc/ssh/sshd_config
sudo cp -a /etc/ssh/sshd_config.d/. etc/ssh/sshd_config.d/ 2>/dev/null || true
cp -a "/home/${USER_NAME}/.ssh/authorized_keys" "home/gort1975/.ssh/authorized_keys" 2>/dev/null || true

echo "Capturing firewall snapshots..."
sudo ufw status numbered > "firewall/ufw-status-${SNAPSHOT_TS}.txt" 2>/dev/null || true
sudo nft list ruleset > "firewall/nft-ruleset-${SNAPSHOT_TS}.txt" 2>/dev/null || true
sudo iptables-save > "firewall/iptables-${SNAPSHOT_TS}.rules" 2>/dev/null || true

echo "Copying fail2ban config..."
sudo cp -a /etc/fail2ban/jail.local etc/fail2ban/jail.local 2>/dev/null || true
sudo cp -a /etc/fail2ban/jail.d/. etc/fail2ban/jail.d/ 2>/dev/null || true

echo "Copying logrotate config..."
sudo cp -a /etc/logrotate.d/. etc/logrotate.d/ 2>/dev/null || true

echo "Copying certbot renewal config..."
sudo cp -a /etc/letsencrypt/renewal/. etc/letsencrypt/renewal/ 2>/dev/null || true

echo "Capturing package baselines..."
dpkg --get-selections > "packages/dpkg-selections-${SNAPSHOT_TS}.txt" 2>/dev/null || true
apt-mark showmanual > "packages/apt-manual-${SNAPSHOT_TS}.txt" 2>/dev/null || true
systemctl list-unit-files --type=service > "packages/systemd-services-${SNAPSHOT_TS}.txt" 2>/dev/null || true

echo "Setting directory ownership..."
sudo chown -R $(whoami):$(id -gn) .

# 4) Commit
echo "Adding files to git..."
git add .
echo "Committing changes..."
git commit -m "$COMMIT_MSG"
echo "Pushing to remote..."
git push origin "$OPS_BRANCH"
echo "Returning to parent directory and master branch..."
cd ..
git checkout master

