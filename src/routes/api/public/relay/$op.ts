import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Relay for deployments without the private backend key (e.g. Vercel).
// Only the listed operations are allowed, and each one re-checks the caller.
function sameToken(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function requireAdmin(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (token.split(".").length !== 3) throw new Error("Unauthorized");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: data.claims.sub, _role: "admin" });
  if (!isAdmin) throw new Error("Admin access required");
  return { sb, userId: data.claims.sub as string };
}

export const Route = createFileRoute("/api/public/relay/$op")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!sameToken(request.headers.get("x-relay-token") ?? "", process.env.RELAY_TOKEN ?? "")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const p = await import("@/lib/privileged.server");
        try {
          const body = await request.json();
          if (params.op === "public-card") {
            const { id } = z.object({ id: z.string().min(1).max(64) }).parse(body);
            return Response.json(await p.publicCardWithKey(id));
          }
          if (params.op === "delete-member") {
            const { userId } = z.object({ userId: z.string().uuid() }).parse(body);
            const { sb, userId: me } = await requireAdmin(request);
            if (userId === me) throw new Error("You cannot delete your own account");
            const { data: targetAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
            if (targetAdmin) throw new Error("Administrator accounts cannot be deleted");
            await p.deleteMemberWithKey(userId);
            return Response.json({ success: true });
          }
          return new Response("Unknown operation", { status: 404 });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Failed", { status: 400 });
        }
      },
    },
  },
});
