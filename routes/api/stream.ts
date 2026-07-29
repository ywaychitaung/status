import { getSnapshot } from "@/lib/checks.ts";
import { onStatusUpdate } from "@/lib/statusEvents.ts";

function ssePayload(event: string, data: unknown): Uint8Array {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(body);
}

function sseComment(text: string): Uint8Array {
  return new TextEncoder().encode(`: ${text}\n\n`);
}

export const handler = async () => {
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let sending: Promise<void> = Promise.resolve();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const pushSnapshot = () => {
        if (closed) return;
        sending = sending
          .then(async () => {
            if (closed) return;
            controller.enqueue(ssePayload("snapshot", await getSnapshot()));
          })
          .catch((error) => {
            console.error("SSE snapshot push failed:", error);
          });
      };

      controller.enqueue(ssePayload("snapshot", await getSnapshot()));

      let listening = false;
      try {
        unsubscribe = await onStatusUpdate(pushSnapshot);
        listening = true;
      } catch (error) {
        console.error("Postgres LISTEN failed; falling back to polling:", error);
      }

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(sseComment("ping"));
        } catch {
          // Stream already closed.
        }
      }, 25_000);

      if (!listening) {
        poll = setInterval(pushSnapshot, 15_000);
      }
    },
    cancel() {
      closed = true;
      if (heartbeat !== null) clearInterval(heartbeat);
      if (poll !== null) clearInterval(poll);
      unsubscribe?.();
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
