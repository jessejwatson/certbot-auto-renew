# Certbot Auto Renew

## Setup Schedule
1. Run `sudo crontab -e`.
2. Paste the following at the bottom of the file. This example will run at 3:00AM every Sunday and save logs to /var/logs.
   - `0 3 * * 0 /usr/bin/node /srv/certbot-auto-renew/index.js >> /var/log/certbot-auto-renew/cron.log 2>&1`.
