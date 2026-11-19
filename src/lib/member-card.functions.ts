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
    const p = await import("@/lib/privileged.server");
    if (p.hasServiceKey()) return p.publicCardWithKey(data.id);
    return p.relay<PublicCard | null>("public-card", { id: data.id });
  });
