/** Load `.env` into `Deno.env` once (Vite SSR does not always inject it). */
let loaded = false;

export function loadEnvFile(path = ".env"): void {
  if (loaded) return;
  loaded = true;

  try {
    const text = Deno.readTextFileSync(path);
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Prefer an already-set process env (e.g. production systemd Environment=)
      if (!Deno.env.get(key)) {
        Deno.env.set(key, value);
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    console.error("Failed to load .env:", error);
  }
}
