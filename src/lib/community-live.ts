import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps community data in sync across panels without a page reload.
 * Pass a community id to scope the subscription, or omit it for the list page.
 */
export function useCommunityLive(communityId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const scoped = (column: string) => (communityId ? { filter: `${column}=eq.${communityId}` } : {});
    const ch = supabase
      .channel(communityId ? `community-sync-${communityId}` : "community-sync-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "communities", ...(communityId ? { filter: `id=eq.${communityId}` } : {}) }, () => {
        qc.invalidateQueries({ queryKey: ["communities"] });
        if (communityId) qc.invalidateQueries({ queryKey: ["community", communityId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members", ...scoped("community_id") }, () => {
        qc.invalidateQueries({ queryKey: ["my-communities"] });
        qc.invalidateQueries({ queryKey: ["communities"] });
        if (communityId) {
          qc.invalidateQueries({ queryKey: ["community-members", communityId] });
          qc.invalidateQueries({ queryKey: ["community-membership", communityId] });
          qc.invalidateQueries({ queryKey: ["community-my-role", communityId] });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_join_requests", ...scoped("community_id") }, () => {
        qc.invalidateQueries({ queryKey: ["my-join-requests"] });
        if (communityId) {
          qc.invalidateQueries({ queryKey: ["community-requests", communityId] });
          qc.invalidateQueries({ queryKey: ["community-requests-count", communityId] });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_projects", ...scoped("community_id") }, () => {
        if (communityId) qc.invalidateQueries({ queryKey: ["community-projects", communityId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [communityId, qc]);
}
