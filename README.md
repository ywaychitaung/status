# Uptime Monitor

A minimalist uptime monitoring dashboard built with Deno, Fresh, Tailwind, and
Preact.

It checks websites on a schedule, stores monitors/status/incidents in
Postgres, streams live updates to the UI, and sends alerts to
Discord/Telegram.

## Features

- Website list in Postgres (add/edit/delete via password-protected `/admin`)
- Scheduled checks with `Deno.cron` (every minute)
- Status, incidents, and alert state in Postgres
- Realtime dashboard refresh via Postgres `LISTEN`/`NOTIFY` + SSE
- Timezone-aware timestamps (Singapore Time by default)
- Dark mode toggle (header button + `d` keyboard shortcut)
- Dashboard, Services, and Incidents pages
- Alerting with native `fetch`:
  - Discord webhook
  - Telegram bot API

## Tech Stack

- [Deno](https://deno.com/)
- [Fresh](https://fresh.deno.dev/)
- [Preact](https://preactjs.com/)
- [Postgres](https://www.postgresql.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Environment Variables

Alert secrets and Postgres come from `.env`. App name,
timezone, alert rules, and check interval live in `lib/constants.ts`.

Create and configure `.env`:

```env
DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/status
# AES-256-GCM key (64 hex chars / 32 bytes). openssl rand -hex 32
ENCRYPTION_KEY=
ALERT_DISCORD_WEBHOOK_URL=
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=
```

Notes:

- Website list and admin users are stored in Postgres.
- Admin `name` + `username` are AES-256-GCM encrypted; passwords use Argon2id.
- First visit seeds a default admin if `users` is empty; use **Login** in the header (modal) or open `/?login=1`.
- On first boot with an empty `monitors` table, seed sites are imported once.
- Leave Discord/Telegram fields empty if you do not want that channel.
- Edit `lib/constants.ts` to change app name, timezone, alert thresholds, and
  related settings.

## App Constants

Configured in `lib/constants.ts`, including:

- `APP_NAME`, `APP_VERSION`, `APP_TAGLINE`
- `DASHBOARD_TIMEZONE` (Singapore Time / SGT)
- `ALERTS.onDown`, `ALERTS.onRecovery`
- `ALERTS.downIntervalMinutes` (throttles repeated down alerts)
- `ALERTS.downConsecutive` (failures required before a down alert)
- `MONITOR` schedule labels and cron expression

## Getting Discord Webhook + Telegram Chat ID

### Discord Webhook

1. Open your Discord server.
2. Go to **Server Settings** -> **Integrations** -> **Webhooks**.
3. Create a webhook and choose a channel.
4. Copy the webhook URL into:
   - `ALERT_DISCORD_WEBHOOK_URL`

### Telegram Bot Token

1. Open [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and complete setup.
3. Copy the bot token into:
   - `ALERT_TELEGRAM_BOT_TOKEN`

### Telegram Chat ID

1. Send a message to your bot (or add bot to a group and send a message).
2. Open:
   - `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find `chat.id` in the JSON response.
4. Put that value into:
   - `ALERT_TELEGRAM_CHAT_ID`

Notes:

- Private chat IDs are usually positive numbers.
- Group/supergroup chat IDs are often negative (for example `-100...`).

## Install

```bash
deno install
```

## Run

Development:

```bash
deno task dev
```

Production server:

```bash
deno task build
deno task start
```

## How Alerts Work

- Non-200 checks trigger down alerts after `ALERTS.downConsecutive` failures
- Repeated down alerts are throttled by `ALERTS.downIntervalMinutes`
- Recovery to 200 triggers recovery alerts when `ALERTS.onRecovery` is enabled
- `ALERTS.onDown` and `ALERTS.onRecovery` control each transition type

## Monitored Sites

Managed in Postgres via `/admin` (websites) and `/account` (profile). Log in with
the header Login modal.
First boot also seeds from `SEED_MONITORS` in `lib/monitor.ts` if monitors is empty.

## Scripts

- `deno task dev` - Start Vite/Fresh dev mode
- `deno task build` - Build app
- `deno task start` - Run built server with `.env`
- `deno task check` - Format check, lint, and type-check
