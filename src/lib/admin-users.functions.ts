import { getRequestHeader } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId)) throw new Error("Invalid user");
    const { data: authorized, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !authorized) throw new Error("Admin access required");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { data: targetAdmin, error: targetError } = await context.supabase.rpc("has_role", { _user_id: data.userId, _role: "admin" });
    if (targetError || targetAdmin) throw new Error("Administrator accounts cannot be deleted");

    const p = await import("@/lib/privileged.server");
    if (p.hasServiceKey()) await p.deleteMemberWithKey(data.userId);
    else await p.relay("delete-member", { userId: data.userId }, (getRequestHeader("authorization") ?? "").replace(/^Bearer /, ""));
    return { success: true };
  });
