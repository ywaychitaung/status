# Deployment Guide (Droplet, No Docker)

This guide deploys the app directly on an Ubuntu Droplet using `systemd`.
All sensitive values are shown as placeholders.

## 1) Connect to server

```bash
ssh -i /path/to/private_key <SERVER_USER>@<SERVER_PUBLIC_IP>
```

Examples:

- `<SERVER_USER>`: `root`
- `<SERVER_PUBLIC_IP>`: `xxx.xxx.xxx.xxx`

## 2) Install dependencies

```bash
apt update && apt upgrade -y
apt install -y curl unzip git
curl -fsSL https://deno.land/install.sh | sh
ln -sf /root/.deno/bin/deno /usr/local/bin/deno
deno --version
```

If you are not using `root`, adjust the Deno binary path accordingly.

## 3) Clone project

```bash
cd /opt
git clone <REPO_URL>
cd <REPO_NAME>
```

Examples:

- `<REPO_URL>`: `git@github.com:<ORG_OR_USER>/<REPO_NAME>.git`
- `<REPO_NAME>`: `status`

## 4) Create production env file

Create `/opt/<REPO_NAME>/.env`:

```env
APP_NAME=<APP_NAME>
DASHBOARD_TIMEZONE=<IANA_TIMEZONE>
DASHBOARD_TIMEZONE_SHORT=<TIMEZONE_SHORT>
DASHBOARD_TIMEZONE_NAME=<TIMEZONE_FULL_NAME>
DASHBOARD_TIMEZONE_UTC_LABEL=<UTC_LABEL>

ALERT_DISCORD_WEBHOOK_URL=<DISCORD_WEBHOOK_URL>
ALERT_TELEGRAM_BOT_TOKEN=<TELEGRAM_BOT_TOKEN>
ALERT_TELEGRAM_CHAT_ID=<TELEGRAM_CHAT_ID>

ALERT_ON_DOWN=true
ALERT_ON_RECOVERY=true
ALERT_DOWN_INTERVAL_MINUTES=60
```

Example timezone values:

- `DASHBOARD_TIMEZONE=Asia/Singapore`
- `DASHBOARD_TIMEZONE_SHORT=SGT`
- `DASHBOARD_TIMEZONE_NAME=Singapore Time`
- `DASHBOARD_TIMEZONE_UTC_LABEL=UTC/GMT +8`

## 5) Build app

```bash
cd /opt/<REPO_NAME>
deno install
deno task build
```

## 6) Create systemd service

Create `/etc/systemd/system/<SERVICE_NAME>.service`:

```ini
[Unit]
Description=<SERVICE_NAME> (Deno Fresh)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/<REPO_NAME>
ExecStart=/usr/local/bin/deno serve -A --unstable-kv --unstable-cron --env-file=.env --port=8000 _fresh/server.js
Restart=always
RestartSec=3
User=root
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
```

Examples:

- `<SERVICE_NAME>`: `status`

## 7) Start service

```bash
systemctl daemon-reload
systemctl enable --now <SERVICE_NAME>
systemctl status <SERVICE_NAME> --no-pager
```

View logs:

```bash
journalctl -u <SERVICE_NAME> -f
```

## 8) Open port and test

If UFW is enabled:

```bash
ufw allow 8000/tcp
ufw status
```

If you want to enable firewall later (recommended), do (Optional):

```bash
ufw allow OpenSSH
ufw allow 8000/tcp
ufw enable
ufw status
```

Test locally on server:

```bash
curl -I http://127.0.0.1:8000
```

Access in browser:

```text
http://<SERVER_PUBLIC_IP>:8000
```

## 9) Verify Deno cron runs every minute in background

Run these on `root@server` to confirm cron is running every minute in
background via your `systemd` service.

1. Confirm service is active:

```bash
systemctl status status --no-pager
```

Expected:

- `Active: active (running)`

2. Follow logs live:

```bash
journalctl -u status -f
```

Leave this open for 2-3 minutes and confirm monitor/check activity repeats every
minute.

## 10) Nginx reverse proxy + SSL (HTTPS)

Use this if you want a clean URL like:

- `https://<APP_DOMAIN>`

### 10.1 Point DNS to droplet

At your DNS provider, create/update:

- `A` record for `<APP_DOMAIN>` -> `<SERVER_PUBLIC_IP>`

Wait until DNS resolves to your droplet IP:

```bash
dig +short <APP_DOMAIN>
```

### 10.2 Install Nginx + Certbot

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx
```

### 10.3 Create Nginx site config

Create `/etc/nginx/sites-available/<APP_DOMAIN>`:

```nginx
server {
    listen 80;
    server_name <APP_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }
}
```

Enable site and test config:

```bash
ln -sf /etc/nginx/sites-available/<APP_DOMAIN> /etc/nginx/sites-enabled/<APP_DOMAIN>
nginx -t
systemctl reload nginx
```

### 10.4 Allow HTTP/HTTPS in firewall

```bash
ufw allow 'Nginx Full'
ufw status
```

### 10.5 Issue SSL certificate

```bash
certbot --nginx -d <APP_DOMAIN>
```

Choose:

- redirect HTTP to HTTPS: **Yes**

### 10.6 Verify HTTPS

Open:

- `https://<APP_DOMAIN>`

Optional check:

```bash
curl -I https://<APP_DOMAIN>
```

### 10.7 Auto-renew check

```bash
systemctl status certbot.timer --no-pager
certbot renew --dry-run
```

## 11) Update deployment

```bash
cd /opt/<REPO_NAME>
git pull origin <BRANCH_NAME>
deno install
deno task build
systemctl restart <SERVICE_NAME>
systemctl status <SERVICE_NAME> --no-pager
```

## Optional: Basic hardening checklist

- Use a non-root deploy user.
- Configure SSH key auth only.
- Enable UFW (`OpenSSH` + app ports).
- Put app behind Nginx/Caddy and HTTPS on `443`.
- Back up server and monitor service logs.

## 12) Auto deploy on push to `main` (GitHub Actions)

This repository includes:

- `.github/workflows/deploy.yml`

It triggers on every push to `main` and runs deployment commands on your
droplet via SSH.

### 12.1 Add GitHub repository secrets

In GitHub -> Repository -> Settings -> Secrets and variables -> Actions, add:

- `DEPLOY_HOST` = `<SERVER_PUBLIC_IP>`
- `DEPLOY_USER` = `<SERVER_USER>` (example: `root`)
- `DEPLOY_SSH_KEY` = private key content for deploy user

`DEPLOY_SSH_KEY` should be the full private key text, for example:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

### 12.2 Ensure server repo path matches workflow

Workflow uses:

- `/opt/status`

If your server path is different, update workflow script accordingly.

### 12.3 First-run requirements on server

- Repository cloned at `/opt/status`
- `deno` installed and available in PATH
- `status.service` already created and working
- Deploy user can run `systemctl restart status`

### 12.4 What the workflow executes

On each push to `main`, it runs:

```bash
cd /opt/status
git fetch origin
git reset --hard origin/main
deno install
deno task build
systemctl restart status
systemctl is-active --quiet status
```

### 12.5 Manual trigger

You can also run it from GitHub Actions UI via `workflow_dispatch`.
