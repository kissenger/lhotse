# Tools Folder

This folder contains maintenance and utility scripts for the Snorkelology app.

## File Purposes

- `backfill-blog-og-images.mjs`: Backfills Open Graph image fields for blog content.
- `deploy.sh`: Server deploy workflow for beta/master branches, including build, restart, and health checks.
- `dump-jsonld-home.js`: Dumps generated JSON-LD data for home page SEO.
- `generate-sitemap.mjs`: Generates XML sitemap for the built site.
- `pull.sh`: Git-only sync workflow for beta/master branches.
- `README.md`: This documentation file.
- `restore-mongo.sh`: Safely restores MongoDB backups to a target database.
- `run-config-backup.sh`: Backs up configuration files.
- `run-generate-sitemap.sh`: Runs sitemap generation using generate-sitemap.mjs.
- `run-hourly-url-check.sh`: Checks site availability hourly and logs results.
- `run-mongo-backup.sh`: Creates MongoDB backup archives with retention cleanup, optional encryption, and mirror sync.
- `run-paypal-test.sh`: Runs PayPal sandbox UI test.
- `run-scheduled-maintenance.sh`: Orchestrates scheduled maintenance tasks, sets reboot flag, syncs disk, and reboots.
- `startup-reboot-check.sh`: Boot-time guard script to verify reboots are expected, clears flag, logs success, or sends alert.

## Environment Variables

Scripts use values from `.env` (project root), including:
- `MAIL_TO`: recipient address for failure alerts
- `LOG_FILE`: log path
- `REBOOT_FLAG_FILE`: scheduled reboot flag file
- `MONGO_URI`: MongoDB connection string
- `BACKUP_PASSPHRASE`: optional backup encryption passphrase

## Manual Run Examples

From repository root:
```bash
bash tools/run-paypal-test.sh
bash tools/run-generate-sitemap.sh
bash tools/run-mongo-backup.sh
bash tools/run-scheduled-maintenance.sh
bash tools/startup-reboot-check.sh
```

## Cron Examples

- Nightly maintenance:  
  `15 2 * * * cd /home/gort1975/snorkelology && bash tools/run-scheduled-maintenance.sh`
- Startup reboot check:  
  `@reboot cd /home/gort1975/snorkelology && bash tools/startup-reboot-check.sh`
- Hourly URL check:  
  `0 * * * * cd /home/gort1975/snorkelology && bash tools/run-hourly-url-check.sh`

## Notes

- Ensure `msmtp` is installed and configured for alert emails.
- Scripts must be executable:  
  `chmod +x tools/*.sh`
