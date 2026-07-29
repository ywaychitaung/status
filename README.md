# Uptime Monitor

A minimalist uptime monitoring dashboard built with Laravel 12, Inertia, React,
and Tailwind CSS.

It checks websites every minute, stores monitors/status/incidents in Postgres,
streams live updates to the UI over Server-Sent Events, and sends alerts to
Discord/Telegram.

> The previous Deno + Fresh + Preact implementation lives in `_legacy/` for
> reference. Both versions share the same Postgres schema, the same AES-256-GCM
> field encryption, the same HMAC blind indexes, and the same Argon2id password
> format, so an existing database works unchanged.

## Features

- Website list in Postgres (add/edit/soft-delete/restore via `/admin`)
- Scheduled checks with the Laravel scheduler (every minute)
- Status, incidents, and alert state in Postgres
- Realtime dashboard refresh via Postgres `LISTEN`/`NOTIFY` + SSE
- Encrypted at rest: monitor names/URLs, usernames, audit trails
- Audit log of logins, account changes, and website changes
- Timezone-aware timestamps (Singapore Time by default)
- Dark mode toggle (header button + `d` keyboard shortcut)
- Dashboard, Services, Incidents, Admin, Audits, and Account pages
- Alerting via Discord webhook and the Telegram bot API

## Tech Stack

- [Laravel 12](https://laravel.com/) (PHP 8.2+)
- [Inertia](https://inertiajs.com/) + [React](https://react.dev/)
- [Postgres](https://www.postgresql.org/) 14+
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vite.dev/)

### PHP extensions

- `pdo_pgsql` — database access
- `pgsql` — Postgres `LISTEN` for the live stream (falls back to polling)
- `sodium` — Argon2id password hashing in the legacy-compatible format
- `openssl` — AES-256-GCM field encryption

## Environment Variables

Secrets and connection details come from `.env`. App name, timezone, alert
rules, and the check interval live in `config/status.php`.

```env
APP_NAME=Status
APP_TIMEZONE=Asia/Singapore
APP_URL=http://localhost:8000

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=status
DB_USERNAME=
DB_PASSWORD=

# Sessions and cache use the filesystem, so no extra tables are needed.
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync

# AES-256-GCM key (64 hex chars / 32 bytes). openssl rand -hex 32
ENCRYPTION_KEY=

ALERT_DISCORD_WEBHOOK_URL=
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=
```

Notes:

- `ENCRYPTION_KEY` must be the **same key** the legacy app used, or existing
  encrypted rows cannot be read. When it is absent, the key is read from (or
  generated into) the `app_settings` table, matching the legacy behaviour.
- Admin `name` + `username` are AES-256-GCM encrypted; `username_hash` is an
  HMAC-SHA256 blind index used for lookups; passwords use Argon2id.
- Leave the Discord/Telegram fields empty to disable that channel.

## Install

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

## Database

The migration is idempotent (`CREATE TABLE IF NOT EXISTS` throughout), so it is
safe to run against a database that already holds the legacy Deno tables:

```bash
php artisan migrate
```

Seed the default admin (`admin` / `password`) when the `users` table is empty:

```bash
php artisan status:seed-admin
```

The default admin is also created automatically on the first login attempt.
**Change the password from `/account` right after signing in.**

## Run

Development (server, logs, and Vite together):

```bash
composer run dev
```

Or individually:

```bash
php artisan serve
npm run dev
```

Production build:

```bash
npm run build
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

## Scheduled Checks

Checks run through the Laravel scheduler instead of `Deno.cron`. Add one cron
entry on the server:

```cron
* * * * * cd /path/to/status && php artisan schedule:run >> /dev/null 2>&1
```

Run a check manually at any time:

```bash
php artisan status:check
```

## App Constants

Configured in `config/status.php`, including:

- `name`, `version`, `tagline`, `description`
- `timezone` (Singapore Time / SGT)
- `alerts.on_down`, `alerts.on_recovery`
- `alerts.down_interval_minutes` (throttles repeated down alerts)
- `alerts.down_consecutive` (failures required before a down alert)
- `monitor` schedule labels and cron expression
- `stream` heartbeat, poll, and max-connection-lifetime seconds
- `incident_history_limit` (newest records kept)

## How Alerts Work

- Failed checks trigger a down alert after `alerts.down_consecutive` failures
- Repeated down alerts are throttled by `alerts.down_interval_minutes`
- Recovery triggers a recovery alert when `alerts.on_recovery` is enabled
- `alerts.on_down` and `alerts.on_recovery` control each transition type

A check counts as "up" when the response status is 200–399.

## Getting Discord Webhook + Telegram Chat ID

### Discord Webhook

1. Open your Discord server.
2. Go to **Server Settings** -> **Integrations** -> **Webhooks**.
3. Create a webhook and choose a channel.
4. Copy the webhook URL into `ALERT_DISCORD_WEBHOOK_URL`.

### Telegram Bot Token

1. Open [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and complete setup.
3. Copy the bot token into `ALERT_TELEGRAM_BOT_TOKEN`.

### Telegram Chat ID

1. Send a message to your bot (or add the bot to a group and send a message).
2. Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`.
3. Find `chat.id` in the JSON response.
4. Put that value into `ALERT_TELEGRAM_CHAT_ID`.

Notes:

- Private chat IDs are usually positive numbers.
- Group/supergroup chat IDs are often negative (for example `-100...`).

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /` | public | Dashboard (`?login=1` opens the login dialog) |
| `GET /services` | public | All monitored endpoints |
| `GET /incidents` | public | Outage and recovery timeline |
| `GET /api/stream` | public | SSE snapshot feed |
| `POST /login` | guest | Username + password sign-in |
| `POST /logout` | auth | Sign out |
| `GET /admin` | auth | Manage monitored websites |
| `GET /audits` | auth | Login, account, and website change history |
| `GET /account` | auth | Profile and password |

## Project Layout

```
app/Services/         Ported domain logic (checks, monitors, alerts, audits, crypto)
app/Support/          URL normalization, dashboard datetime, page metadata
app/Models/           Eloquent models for the legacy Postgres schema
config/status.php     App constants (was _legacy/lib/constants.ts)
routes/web.php        Dashboard, auth, and admin routes
routes/stream.php     SSE route, registered outside the session middleware
routes/console.php    Scheduled `status:check`
_legacy/              Previous Deno + Fresh implementation (reference only)
```

## Artisan Commands

- `php artisan status:check` — probe every active monitor now
- `php artisan status:seed-admin` — create the default admin if none exists
- `php artisan migrate` — create any missing tables (safe to re-run)
