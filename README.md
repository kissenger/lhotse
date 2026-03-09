# Snorkelology Web App

Snorkelology is an Angular SSR web application for content, shop flows, map features, authentication, and PayPal-based checkout/testing.

This repository includes:

- frontend Angular app (`src/app`)
- server routes/services (`src/server*.ts`)
- test suites (unit, integration, Playwright)
- operational scripts for deploy, backup, sitemap, and nightly maintenance (`tools/`)

## Prerequisites

- Node.js and npm
- Bash (for `tools/*.sh` scripts)
- PM2 (for server process management)
- MongoDB access (`MONGO_URI` in `.env`)

## Environment Setup

Create and maintain a root `.env` file with required values.

Core variables used by app and scripts include:

- `MONGO_URI`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- `MAIL_TO`/`EMAIL`
- `REBOOT_FLAG_FILE`
- `HEALTHCHECK_URL_BETA`, `HEALTHCHECK_URL_MASTER`

See `.env` comments for script-specific variable ownership.

## Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run start
```

Default URL: `http://localhost:4200`

## Build Commands

Build beta configuration:

```bash
npm run build:beta
```

Build master/prod configuration:

```bash
npm run build:master
```

## Testing

Run unit tests:

```bash
npm test
```

Run integration/feature checks:

```bash
npm run test:seo
npm run test:paypal
npm run test:shop-backend
```

Run Playwright UI tests:

```bash
npm run test:ui
npm run test:ui:paypal
```

Run standard full test suite:

```bash
npm run test:all
```

## Deployment

Deployment scripts are in `tools/deploy.sh` and are launched via npm scripts.

Git-only sync (no build/restart):

```bash
npm run pull
npm run pull:beta
npm run pull:master
```

These pull commands now default to hard reset behavior (`git reset --hard origin/<branch>`).

Deploy beta:

```bash
npm run deploy:beta
```

Deploy master:

```bash
npm run deploy:master
```

Deploy commands now default to hard reset behavior (`git reset --hard origin/<branch>`).

Deployment flow includes:

- branch sync (`beta` or `master`)
- environment file copy (`env/environment.*` -> `src/environments/`)
- build (`build:beta` or `build:master`)
- PM2 restart (`snorkelology_beta` or `snorkelology_master`)
- automated health checks (PM2 online + HTTP health endpoint)

## PM2 Process Management

PM2 apps are defined in `ecosystem.config.cjs`.

Initial process start:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Useful operations:

```bash
pm2 status
pm2 logs snorkelology_master
pm2 logs snorkelology_beta
```

## Nightly Maintenance

Nightly operational scripts live in `tools/` and are documented in `tools/README.md`.

Primary orchestrator:

```bash
bash tools/run-nightly-maintenance.sh
```

Boot-time reboot check:

```bash
bash tools/startup-reboot-check.sh
```

## Repository Layout

- `src/`: Angular app and server code
- `schema/`: MongoDB schema models
- `tests/`: integration and Playwright tests
- `tools/`: deploy and maintenance scripts
- `config/`: environment-specific static config artifacts

## Operational Notes

- Keep `tools/*.sh` executable in Linux environments.
- Ensure `msmtp` is configured when using maintenance failure emails.
- Ensure health endpoints in `.env` match actual app routes/ports used by PM2.
- For server-only config management (nginx/systemd/cron), use a separate ops repo workflow and version live server config files there.

## Server Config Snapshot & Ops Repo Workflow

For versioned server config management (nginx, systemd, cron, etc.), use the ops repo snapshot script:

### Usage

Run the script to capture a snapshot of live server config files and commit them to the ops repo:

```bash
bash tools/run-git.sh "Your commit message here"
```

- Replace the quoted text with your desired git commit message.
- If no message is provided, it defaults to "Snapshot update".

### Workflow

- Initial run: creates repo, copies config, git init, commit.
- Subsequent runs: re-copy config, git add/commit (skip git init).
- Snapshots are not live-linked; manual refresh is needed.
- Never commit private keys or secrets.

### Notes

- The script copies selected server configuration files (nginx, systemd, fail2ban, logrotate, sudoers, certbot, etc.) into structured directories within the ops repo, creating a snapshot of the current server state.
- After copying, it adds and commits these files to git, ensuring versioned backups and auditability.
- The copied files are not linked to the live config; they are static snapshots.
- To capture future changes, re-run the script to refresh the snapshots, then commit.
- You can skip the git init step for subsequent runs—just update files and commit as usual.
- This approach requires manual or automated refreshes to keep the repo in sync with the server.
