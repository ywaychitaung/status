import { csrfToken } from '@/lib/csrf';

export interface AlertSettingsForm {
    discordWebhookUrl: string;
    telegramBotToken: string;
    telegramChatId: string;
}

export interface AlertsViewProps {
    settings: AlertSettingsForm;
    flash: string | null;
    error: string | null;
}

export default function AlertsView({ settings, flash, error }: AlertsViewProps) {
    return (
        <div className="w-full space-y-6">
            {flash && (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {flash}
                </p>
            )}
            {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </p>
            )}

            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <h2 className="text-sm font-semibold tracking-tight">Alert channels</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Configure Discord and Telegram destinations for downtime and recovery alerts. Leave a field empty to
                    disable that channel.
                </p>

                <form method="post" action="/alerts" className="mt-5 grid w-full gap-4">
                    <input type="hidden" name="_token" value={csrfToken()} />
                    <input type="hidden" name="_method" value="PUT" />

                    <div className="space-y-3 rounded-xl border border-zinc-200/90 p-4 dark:border-zinc-800">
                        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Discord</h3>
                        <label className="block">
                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                                Webhook URL
                            </span>
                            <input
                                type="url"
                                name="discord_webhook_url"
                                defaultValue={settings.discordWebhookUrl}
                                placeholder="https://discord.com/api/webhooks/…"
                                autoComplete="off"
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                            />
                        </label>
                    </div>

                    <div className="space-y-3 rounded-xl border border-zinc-200/90 p-4 dark:border-zinc-800">
                        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Telegram</h3>
                        <label className="block">
                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                                Bot token
                            </span>
                            <input
                                type="text"
                                name="telegram_bot_token"
                                defaultValue={settings.telegramBotToken}
                                placeholder="123456:ABC-DEF…"
                                autoComplete="off"
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                                Chat ID
                            </span>
                            <input
                                type="text"
                                name="telegram_chat_id"
                                defaultValue={settings.telegramChatId}
                                placeholder="-100…"
                                autoComplete="off"
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-emerald-500/40 outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                            />
                        </label>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                            Save alert settings
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
