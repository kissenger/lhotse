# Tools Folder

This folder contains maintenance scripts and utility scripts used by the Snorkelology app.

## Logging And Alerting Standard

Nightly maintenance scripts now use a shared helper: `tools/maintenance-common.sh`.

Message formats are:

- Failure: `<timestamp> FAILURE <scriptname> <error message>`
- Success: `<timestamp> SUCCESS <scriptname> <success message>`

Behavior:

- Failures are written to the configured log file.
- A maximum of one failure email is sent per script run.
- `run-nightly-maintenance.sh` suppresses child-script emails and sends one consolidated failure email for the full nightly run.
- Log files are capped to the newest 1000 lines by default.

## File Purposes

- `maintenance-common.sh`
  - Shared logging/email utilities for maintenance shell scripts.

- `run-nightly-maintenance.sh`
  - Orchestrates nightly checks in order:
  - `run-paypal-nightly.sh`
  - `run-sitemap-nightly.sh`
  - `run-mongo-backup-nightly.sh`
  - If all pass, sets reboot flag, syncs disk, then reboots.

- `startup-reboot-check.sh`
  - Boot-time guard script to verify reboots are expected.
  - If reboot flag exists, clears it and logs success.
  - If reboot flag is missing, logs failure and sends one alert email.

- `run-paypal-nightly.sh`
  - Runs the nightly PayPal sandbox UI test command.

- `run-sitemap-nightly.sh`
  - Generates sitemap output using `generate-sitemap.mjs`.

- `run-mongo-backup-nightly.sh`
  - Creates MongoDB backup archives with retention cleanup.
  - Supports optional encryption and mirror sync.

- `run-hourly-url-check.sh`
  - Checks availability of `https://snorkelology.co.uk` and `https://beta.snorkelology.co.uk`.
  - Logs success/failure in standard format and sends one failure email per run when any URL is down.

- `deploy.sh`
  - Server deploy workflow for `beta`/`master`.
  - Syncs branch via hard reset to `origin/<branch>`, builds, restarts PM2, and performs mandatory health checks.

- `pull.sh`
  - Git-only sync workflow for `beta`/`master`.
  - Performs fetch + checkout + hard reset to `origin/<branch>` by default, with no build/restart.

- `serverside-git-init.sh`
  - Captures live server config into a new ops git repo (nginx, cron, PM2 ecosystem/state, systemd, SSH config snapshots).
  - Generates an ops `README.md` that includes recovery steps.


- `restore-mongo.sh`
  - Restores a backup into a safe target database (`--target-db`) to avoid destructive overwrite.

- `generate-sitemap.mjs`
  - Generates XML sitemap for the built site.

- `backfill-blog-og-images.mjs`
  - Utility to backfill Open Graph image fields for blog content.

- `dump-jsonld-home.js`
  - Utility to inspect or dump generated JSON-LD data for home page SEO.

## Environment Variables

Typical values are sourced from `.env` (project root) or reboot-specific env file:

- `MAIL_TO` (or `EMAIL` fallback): recipient address for failure alerts
- `LOG_FILE`: optional log path override
- `LOG_MAX_LINES`: optional max log lines to keep (default: `1000`)
- `REBOOT_FLAG_FILE`: path to scheduled reboot flag file
- `MONGO_URI`: required for Mongo backup/restore
- `BACKUP_PASSPHRASE`: optional backup encryption/decryption passphrase

## Manual Run Examples

From repository root:

```bash
bash tools/run-paypal-nightly.sh
bash tools/run-sitemap-nightly.sh
bash tools/run-mongo-backup-nightly.sh
bash tools/run-nightly-maintenance.sh
```

Startup reboot check (for boot-time service/cron):

```bash
bash tools/startup-reboot-check.sh
bash tools/deploy.sh beta
```

Deploy via npm scripts:

```bash
npm run pull
npm run pull:beta
npm run pull:master
npm run deploy:beta
npm run deploy:master
```

## Cron Examples For Nightly Maintenance

### Example 1: Run nightly maintenance at 02:15 every day

```cron
15 2 * * * cd /home/gort1975/snorkelology && /usr/bin/env bash tools/run-nightly-maintenance.sh
```

### Example 2: Run nightly maintenance weekdays only at 03:00

```cron
0 3 * * 1-5 cd /home/gort1975/snorkelology && /usr/bin/env bash tools/run-nightly-maintenance.sh
```

### Example 3: Run startup reboot check once on reboot

```cron
@reboot cd /home/gort1975/snorkelology && /usr/bin/env bash tools/startup-reboot-check.sh
```

### Example 4: Run URL availability check hourly

```cron
0 * * * * cd /home/gort1975/snorkelology && /usr/bin/env bash tools/run-hourly-url-check.sh
```

## Notes

- Ensure `msmtp` is installed and configured with account `default` for alert emails.
- Ensure `REBOOT_FLAG_FILE` points to a writable location.
- Ensure scripts are executable when deployed on Linux:

```bash
chmod +x tools/*.sh
```
