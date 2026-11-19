// Server-only work that needs the private backend key. When the key is not
// available (e.g. the Vercel deployment), calls are relayed to the Lovable-hosted
// server, authenticated with the shared RELAY_TOKEN.
import type { PublicCard } from "./member-card.functions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_RELAY_URL = "https://project--361d3082-af1f-4023-b43a-c0792e00af2d.lovable.app";

export function hasServiceKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function relay<T>(op: string, body: unknown, bearer?: string): Promise<T> {
  const token = process.env.RELAY_TOKEN;
  if (!token) throw new Error("RELAY_TOKEN is not configured");
  const base = (process.env.RELAY_URL || DEFAULT_RELAY_URL).replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-relay-token": token };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`${base}/api/public/relay/${op}`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Relay failed [${res.status}]`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function deleteMemberWithKey(userId: string) {
  if (!UUID.test(userId)) throw new Error("Invalid user");
  const data = { userId };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove private uploads before deleting their payment and profile rows.
    for (const bucket of ["avatars", "receipts", "chat-files", "community-files", "community-images", "research-images", "research-media"] as const) {
      let offset = 0;
      let batch: string[] = [];
      const paths: string[] = [];
      do {
        const { data: files, error: listError } = await supabaseAdmin.storage.from(bucket).list(data.userId, { limit: 1000, offset });
        if (listError) throw listError;
        batch = (files ?? []).map((file) => file.name).filter((name) => name !== ".emptyFolderPlaceholder");
        paths.push(...batch.map((name) => `${data.userId}/${name}`));
        offset += 1000;
      } while (batch.length === 1000);
      for (let i = 0; i < paths.length; i += 1000) {
        const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths.slice(i, i + 1000));
        if (removeError) throw removeError;
      }
    }
    // These records do not reference auth.users with ON DELETE CASCADE.
    for (const field of ["sender_id", "recipient_id"] as const) {
      const { error } = await supabaseAdmin.from("messages").delete().eq(field, data.userId);
      if (error) throw error;
    }
    const { error: activityError } = await supabaseAdmin.from("active_days").delete().eq("user_id", data.userId);
    if (activityError) throw activityError;
    const { error: savedError } = await supabaseAdmin.from("saved_research").delete().eq("user_id", data.userId);
    if (savedError) throw savedError;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
}

export async function publicCardWithKey(id: string): Promise<PublicCard | null> {
  const data = { id };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: card, error } = await supabaseAdmin.rpc("public_member_card", { _member_no: data.id });
    if (error || !card) return null;
    const c = card as Record<string, any>;
    let avatar_signed_url: string | null = null;
    if (c.avatar_url) {
      const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(String(c.avatar_url), 60 * 60);
      avatar_signed_url = signed?.signedUrl ?? null;
    }
    return {
      member_no: c.member_no ?? null,
      full_name: c.full_name ?? null,
      username: c.username ?? null,
      blood_group: c.blood_group ?? null,
      phone: c.phone ?? null,
      gender: c.gender ?? null,
      date_of_birth: c.date_of_birth ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      country: c.country ?? null,
      position: c.position ?? null,
      registered_at: c.registered_at ?? null,
      revoked: c.revoked ?? null,
      avatar_signed_url,
    };
}
