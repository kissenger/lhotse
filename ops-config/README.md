# Ops Config Repository

Server: rpi
Snapshot: 2026-03-09-162927

Contains versioned server operational config from live locations:
- nginx site config
- systemd units/timers/paths
- cron
- PM2 ecosystem + state snapshots
- sshd config (no private keys)
- firewall snapshots
- fail2ban/logrotate custom snippets
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
  - crontab var/spool/cron/gort1975.cron
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
