import { getKv, getSnapshot } from "@/lib/kv.ts";
import { monitorKey, MONITORS, SUMMARY_KEY } from "@/lib/monitor.ts";

function ssePayload(event: string, data: unknown): Uint8Array {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(body);
}

export const handler = async () => {
  const kv = await getKv();
  const watchKeys: Deno.KvKey[] = [
    ...MONITORS.map((monitor) => monitorKey(monitor.id)),
    SUMMARY_KEY,
  ];
  const stream = kv.watch(watchKeys);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(ssePayload("snapshot", await getSnapshot()));

      for await (const _entries of stream) {
        controller.enqueue(ssePayload("snapshot", await getSnapshot()));
      }
    },
    async cancel() {
      try {
        await stream.cancel();
      } catch {
        // Ignore cancellation races when the KV stream is already locked/closed.
      }
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
};
