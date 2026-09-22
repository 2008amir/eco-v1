import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicCard = {
  member_no: string | null;
  full_name: string | null;
  username: string | null;
  blood_group: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  position: string | null;
  registered_at: string | null;
  revoked: boolean | null;
  avatar_signed_url: string | null;
};

export const getPublicCard = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<PublicCard | null> => {
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
  });
