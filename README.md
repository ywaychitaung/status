# Uptime Monitor

A minimalist uptime monitoring dashboard built with Deno, Fresh, Tailwind, and
Preact.

It checks your websites on a schedule, stores results in Deno KV, streams
updates to the UI, and sends alerts to Discord/Telegram.

## Features

- Scheduled checks with `Deno.cron` (every minute)
- Status persistence with `Deno.Kv`
- Realtime dashboard refresh via `Deno.Kv.watch()` + SSE
- Timezone-aware timestamps
- Dark mode toggle (header button + `d` keyboard shortcut)
- Alerting with native `fetch`:
  - Discord webhook
  - Telegram bot API
- Configurable alert rules for down/recovery + down alert interval

## Tech Stack

- [Deno](https://deno.com/)
- [Fresh](https://fresh.deno.dev/)
- [Preact](https://preactjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## Environment Variables

Create and configure `.env`:

```env
APP_NAME="Status"

DASHBOARD_TIMEZONE=Asia/Singapore
DASHBOARD_TIMEZONE_SHORT=SGT
DASHBOARD_TIMEZONE_NAME="Singapore Time"
DASHBOARD_TIMEZONE_UTC_LABEL="UTC/GMT +8"

ALERT_DISCORD_WEBHOOK_URL=
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=

ALERT_ON_DOWN=true
ALERT_ON_RECOVERY=true
ALERT_DOWN_INTERVAL_MINUTES=60
```

Notes:

- Leave Discord/Telegram fields empty if you do not want that channel.
- `ALERT_DOWN_INTERVAL_MINUTES` throttles repeated down alerts per monitor.

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

- Non-200 checks trigger down alerts (throttled by
  `ALERT_DOWN_INTERVAL_MINUTES`)
- Recovery to 200 triggers recovery alerts when enabled
- `ALERT_ON_DOWN` and `ALERT_ON_RECOVERY` control each transition type

## Monitored Sites

Configured in `lib/monitor.ts`.

## Scripts

- `deno task dev` - Start Vite/Fresh dev mode
- `deno task build` - Build app
- `deno task start` - Run built server with `.env`
- `deno task check` - Format check, lint, and type-check
