import { getListenSql, STATUS_CHANNEL } from "@/lib/db.ts";

type StatusListener = () => void;

const listeners = new Set<StatusListener>();
let listenReady: Promise<void> | null = null;

async function ensureListen(): Promise<void> {
  if (listenReady) return listenReady;

  listenReady = (async () => {
    const sql = await getListenSql();
    await sql.listen(STATUS_CHANNEL, () => {
      for (const listener of listeners) {
        try {
          listener();
        } catch (error) {
          console.error("Status listener failed:", error);
        }
      }
    });
  })();

  try {
    await listenReady;
  } catch (error) {
    listenReady = null;
    throw error;
  }
}

export async function onStatusUpdate(
  listener: StatusListener,
): Promise<() => void> {
  await ensureListen();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
