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
    return { success: true };
  });