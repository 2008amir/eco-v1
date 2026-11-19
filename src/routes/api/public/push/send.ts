import { createFileRoute } from "@tanstack/react-router";
import { buildPushHTTPRequest } from "@pushforge/builder";

type Claimed = {
  title: string; body: string; url: string; tag: string;
  subscriptions: { endpoint: string; keys: { p256dh: string; auth: string } }[];
} | null;

async function rpc(name: string, args: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Backend address is not configured");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${name} failed [${res.status}]: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const Route = createFileRoute("/api/public/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // The token only lives in the database; the call is rejected by claim_push if it is wrong.
        const token = request.headers.get("x-push-token") ?? "";
        let id = "";
        try { id = String(((await request.json()) as { id?: unknown }).id ?? ""); } catch { /* ignore */ }
        if (!token || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad request", { status: 400 });

        const privateJWK = process.env.VAPID_PRIVATE_KEY;
        if (!privateJWK) return new Response("VAPID_PRIVATE_KEY missing", { status: 500 });

        let claimed: Claimed;
        try { claimed = (await rpc("claim_push", { _id: id, _token: token })) as Claimed; }
        catch (e) { console.error(e); return new Response("Unauthorized", { status: 401 }); }
        if (!claimed) return Response.json({ sent: 0 });

        let sent = 0;
        await Promise.all(claimed.subscriptions.map(async (subscription) => {
          try {
            const req = await buildPushHTTPRequest({
              privateJWK,
              subscription,
              message: {
                payload: { title: claimed!.title, body: claimed!.body, url: claimed!.url, tag: claimed!.tag },
                adminContact: process.env.VAPID_SUBJECT || "mailto:admin@ecomedic.me",
                options: { ttl: 86400, urgency: "high" },
              },
            });
            const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
            if (res.status === 404 || res.status === 410) {
              await rpc("drop_push_subscription", { _endpoint: subscription.endpoint, _token: token });
            } else if (res.ok) sent++;
            else console.error(`Push failed [${res.status}]: ${await res.text()}`);
          } catch (e) { console.error("Push error", e); }
        }));
        return Response.json({ sent });
      },
    },
  },
});
