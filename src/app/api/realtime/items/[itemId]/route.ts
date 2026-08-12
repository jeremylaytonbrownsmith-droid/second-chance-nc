import type { NextRequest } from "next/server";
import { Client } from "pg";
import { channelForItem } from "@/lib/realtime/notify";
import { getItemBidState } from "@/lib/auction/bidding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * SSE stream of bid updates for one item (Section 13). LISTEN/NOTIFY
 * needs a direct, session-scoped Postgres connection — NOT the pooled
 * DATABASE_URL Prisma uses elsewhere, which may hand the underlying
 * connection to a different client between statements under connection
 * pooling (e.g. PgBouncer transaction mode). Use the unpooled URL if the
 * host provides one (Neon does, as DATABASE_URL_UNPOOLED).
 */
const LISTEN_CONNECTION_STRING =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const channel = channelForItem(itemId);

  const client = new Client({ connectionString: LISTEN_CONNECTION_STRING });
  await client.connect();
  await client.query(`LISTEN "${channel}"`);

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller already closed by the abort handler below.
        }
      }

      async function cleanup() {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          await client.query(`UNLISTEN "${channel}"`);
        } catch {
          // connection may already be gone
        }
        await client.end().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      // Snapshot on connect so a client that joins mid-auction (or is
      // reconnecting after a dropped stream) isn't stuck waiting for the
      // next bid to know where things stand.
      try {
        const state = await getItemBidState(itemId);
        send("snapshot", state);
      } catch {
        send("error", { message: "Failed to load item state" });
      }

      client.on("notification", (msg) => {
        if (msg.channel !== channel || !msg.payload) return;
        try {
          send("bid", JSON.parse(msg.payload));
        } catch {
          // malformed payload — drop it, client will reconcile on reconnect
        }
      });

      client.on("error", () => {
        void cleanup();
      });

      // Keeps intermediary proxies/load balancers from treating an idle
      // SSE connection as dead and closing it early.
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 20_000);

      request.signal.addEventListener("abort", () => {
        void cleanup();
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      client.end().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
