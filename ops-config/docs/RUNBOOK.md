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
