# Uptime Monitor

An uptime monitoring dashboard built with Laravel 12, Inertia, React,
and Tailwind CSS.

It checks websites every minute, stores websites/status/incidents in Postgres,
streams live updates to the UI over Server-Sent Events, and sends alerts to
Discord/Telegram.

> Auth uses Laravel’s session guard + Sanctum. Sensitive fields use Laravel’s
> `encrypted` cast / `Crypt` (`APP_KEY`). Login matches `username_hash` /
> `email_hash` / `url_hash` blind indexes via `ENCRYPTION_KEY`.

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
- Alerting via Discord webhook and the Telegram bot API (settings in DB / Alerts tab)

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
- `openssl` — Laravel Crypt / TLS

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

# Optional: set to `database` to use the Laravel `sessions` / `cache` tables.
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync

# Blind-index key for username/email/url hashes (64 hex chars). openssl rand -hex 32
ENCRYPTION_KEY=

# Optional: seeded into `alert_channels` on first migrate only.
# Afterwards manage channels in the Alerts tab (/alerts).
ALERT_DISCORD_WEBHOOK_URL=
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=
```

Notes:

- Field values use Laravel Crypt (`APP_KEY` + `encrypted` casts). `ENCRYPTION_KEY`
  is required only for blind indexes (`username_hash`, `email_hash`, `url_hash`).
- Passwords use Laravel Hash (`HASH_DRIVER`, default `argon2id`). Users include
  Sanctum `personal_access_tokens` plus Laravel defaults (`sessions`,
  `password_reset_tokens`, `cache`, `jobs`, `failed_jobs`, …). Login accepts
  username or email.
- Discord / Telegram credentials live in the `alert_channels` table (one row per
  channel: `name` + shared encrypted columns) and are edited under **Alerts**.
  Env vars are only used to seed that table.

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

Configure these under **Alerts** (`/alerts`) after signing in. On first migrate,
values from `ALERT_*` env vars (if set) are copied into `alert_channels`
(one row for Discord, one for Telegram).

### Discord Webhook

1. Open your Discord server.
2. Go to **Server Settings** -> **Integrations** -> **Webhooks**.
3. Create a webhook and choose a channel.
4. Paste the webhook URL into the Alerts form (Discord webhook URL).

### Telegram Bot Token

1. Open [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and complete setup.
3. Paste the bot token into the Alerts form.

### Telegram Chat ID

1. Send a message to your bot (or add the bot to a group and send a message).
2. Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`.
3. Find `chat.id` in the JSON response.
4. Paste that value into the Alerts form (Telegram chat ID).

Notes:

- Private chat IDs are usually positive numbers.
- Group/supergroup chat IDs are often negative (for example `-100...`).
- Leave a channel field empty to disable that channel.

## Routes

| Route             | Auth   | Purpose                                       |
| ----------------- | ------ | --------------------------------------------- |
| `GET /`           | public | Dashboard (`?login=1` opens the login dialog) |
| `GET /services`   | public | All monitored endpoints                       |
| `GET /incidents`  | public | Outage and recovery timeline                  |
| `GET /api/stream` | public | SSE snapshot feed                             |
| `POST /login`     | guest  | Username + password sign-in                   |
| `POST /logout`    | auth   | Sign out                                      |
| `GET /admin`      | auth   | Manage monitored websites                     |
| `GET /alerts`     | auth   | Discord / Telegram alert channel settings     |
| `GET /audits`     | auth   | Login, account, and website change history    |
| `GET /account`    | auth   | Profile and password                          |

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
