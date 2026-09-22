import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, UserPlus, Check, X } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCommunityLive } from "@/lib/community-live";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useStorageUrl } from "@/lib/storage-url";
import { toast } from "sonner";

export const Route = createFileRoute("/community-requests/$id")({
  component: () => <RequireAuth><CommunityRequestsPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Join requests — Ecomedic Squad" },
      { name: "description", content: "Review and respond to community join requests." },
      { property: "og:title", content: "Join requests — Ecomedic Squad" },
      { property: "og:description", content: "Review and respond to community join requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type ProfileLite = { first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null };

function RequestAvatar({ path, name }: { path: string | null; name: string }) {
  const url = useStorageUrl("avatars", path);
  return (
    <Avatar className="h-10 w-10">
      {url && <AvatarImage src={url} alt={`${name} avatar`} />}
      <AvatarFallback>{name.slice(0, 1).toUpperCase() || "U"}</AvatarFallback>
    </Avatar>
  );
}

function CommunityRequestsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  useCommunityLive(id);

  const { data: community, isLoading } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: membership, isLoading: membershipLoading } = useQuery({
    queryKey: ["community-membership", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_members")
        .select("id, role")
        .eq("community_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const isCommunityAdmin = membership?.role === "admin";

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["community-requests", id],
    enabled: isCommunityAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_join_requests")
        .select("id, user_id, status, created_at")
        .eq("community_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as { id: string; user_id: string; status: string; created_at: string }[];
      if (rows.length === 0) return [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url")
        .in("id", rows.map((r) => r.user_id));
      const map: Record<string, ProfileLite> = {};
      for (const p of (profilesData ?? []) as any[]) map[p.id] = p;
      return rows.map((r) => ({ ...r, profiles: map[r.user_id] ?? null }));
    },
  });

  const resolveRequest = async (reqId: string, status: "approved" | "declined") => {
    const { error } = await supabase.from("community_join_requests").update({ status }).eq("id", reqId);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Request approved" : "Request declined");
    qc.invalidateQueries({ queryKey: ["community-requests", id] });
    qc.invalidateQueries({ queryKey: ["community-members", id] });
  };

  if (isLoading || membershipLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!community) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Community not found.</p>
        <Link to="/communities" className="text-primary hover:underline text-sm">Back to communities</Link>
      </div>
    );
  }

  if (!isCommunityAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-muted-foreground">Only community admins can view join requests.</p>
        <Link to="/community/$id" params={{ id }} className="text-primary hover:underline text-sm">Back to {community.name}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center gap-2">
          <Link to="/community/$id" params={{ id }} className="p-2 rounded-md hover:bg-muted/50" aria-label="Back to community">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <UserPlus className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">Join requests</h1>
              <p className="text-[11px] text-muted-foreground truncate">{community.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1 w-full max-w-2xl">
        {requestsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : requests.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-3 font-semibold">No pending requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">When people ask to join this community, their requests will show up here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const name = `${r.profiles?.first_name ?? "User"} ${r.profiles?.last_name ?? ""}`.trim();
              return (
                <li key={r.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                  <RequestAvatar path={r.profiles?.avatar_url ?? null} name={name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.profiles?.username ? `@${r.profiles.username} · ` : ""}
                      {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <Button size="sm" className="gradient-bg text-primary-foreground h-8 px-3" onClick={() => resolveRequest(r.id, "approved")}>
                    <Check className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Approve</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => resolveRequest(r.id, "declined")}>
                    <X className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Decline</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
