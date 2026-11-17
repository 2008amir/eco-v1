import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Paperclip, X, Loader2, Users, MapPin, FolderKanban, Lock, Globe, Shield, Copy, UserPlus, ChevronDown, Plus, Trash2, LogOut, Image as ImageIcon } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useStorageUrl } from "@/lib/storage-url";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logoSrc from "@/assets/logo.png";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";

export const Route = createFileRoute("/community/$id")({
  component: () => <RequireAuth><CommunityPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Community — Ecomedic Squad" },
      { name: "description", content: "Community group chat, members and projects inside the Ecomedic Squad network." },
      { property: "og:title", content: "Community — Ecomedic Squad" },
      { property: "og:description", content: "Community group chat, members and projects inside the Ecomedic Squad network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "member";
  profiles: { first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null;
};

type Msg = {
  id: string;
  community_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
};
type ProfileLite = { first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null };

async function fetchProfiles(ids: string[]): Promise<Record<string, ProfileLite>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return {};
  const { data } = await supabase.from("profiles").select("id, first_name, last_name, username, avatar_url").in("id", unique);
  const map: Record<string, ProfileLite> = {};
  for (const p of (data ?? []) as any[]) map[p.id] = p;
  return map;
}

function CommunityPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: community, isLoading } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, description, cover_image_url, visibility, location, active_projects, invite_code, created_by, is_general, members_can_post")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["community-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select("id, user_id, role")
        .eq("community_id", id)
        .order("role", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as { id: string; user_id: string; role: "admin" | "member" }[];
      const profiles = await fetchProfiles(rows.map((r) => r.user_id));
      return rows.map((r) => ({ ...r, profiles: profiles[r.user_id] ?? null })) as Member[];
    },
  });

  const { data: adminIds = [] } = useQuery({
    queryKey: ["site-admin-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_ids");
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });

  const me = members.find((m) => m.user_id === user?.id);
  const isMember = !!me;
  const isCommunityAdmin = me?.role === "admin";
  const ownerId = (community as any)?.created_by as string | null | undefined;
  const isGeneral = !!(community as any)?.is_general;
  // Groups created by a site admin (and the general group) are owned by every site admin.
  const adminOwned = isGeneral || !ownerId || adminIds.includes(ownerId);
  const isOwner = !!user && (adminOwned ? isAdmin || ownerId === user.id : ownerId === user.id);
  const isOwnerUser = (uid: string) => (adminOwned ? adminIds.includes(uid) : uid === ownerId);
  const membersCanPost = (community as any)?.members_can_post !== false;
  const canPost = isMember && (membersCanPost || isCommunityAdmin);

  const setMembersCanPost = async (value: boolean) => {
    const { error } = await supabase.from("communities").update({ members_can_post: value } as any).eq("id", id);
    if (error) { toast.error("Couldn't update the setting"); return; }
    toast.success(value ? "All members can now send messages" : "Only admins can send messages now");
    qc.invalidateQueries({ queryKey: ["community", id] });
  };

  const setVisibility = async (value: "public" | "private") => {
    const { error } = await supabase.from("communities").update({ visibility: value } as any).eq("id", id);
    if (error) { toast.error("Couldn't update who can join"); return; }
    toast.success(value === "public" ? "Community is now public" : "Community is now private");
    qc.invalidateQueries({ queryKey: ["community", id] });
    qc.invalidateQueries({ queryKey: ["communities"] });
  };

  const changeCover = async (f: File) => {
    if (!user) return;
    setUploadingCover(true);
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${id}/cover-${Date.now()}.${ext}`;
    const up = await uploadWithSupabaseRetry("community-images", path, f, { contentType: f.type, upsert: true }, 5);
    if (up.error) { setUploadingCover(false); toast.error("Couldn't upload the image"); return; }
    const { error } = await supabase.from("communities").update({ cover_image_url: path } as any).eq("id", id);
    setUploadingCover(false);
    if (error) { toast.error("Couldn't save the new image"); return; }
    toast.success("Community image updated");
    qc.invalidateQueries({ queryKey: ["community", id] });
    qc.invalidateQueries({ queryKey: ["communities"] });
    qc.invalidateQueries({ queryKey: ["my-communities"] });
  };

  const deleteCommunity = async () => {
    if (!window.confirm("Delete this community for everyone? This cannot be undone.")) return;
    const { error } = await supabase.from("communities").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete this community"); return; }
    toast.success("Community deleted");
    qc.invalidateQueries({ queryKey: ["communities"] });
    qc.invalidateQueries({ queryKey: ["my-communities"] });
    navigate({ to: "/communities" });
  };

  const leaveCommunity = async () => {
    if (!user) return;
    if (!window.confirm("Leave this community?")) return;
    const { error } = await supabase.from("community_members").delete().eq("community_id", id).eq("user_id", user.id);
    if (error) { toast.error("Couldn't leave this community"); return; }
    toast.success("You left the community");
    qc.invalidateQueries({ queryKey: ["community-members", id] });
    qc.invalidateQueries({ queryKey: ["my-communities"] });
    navigate({ to: "/communities" });
  };

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["community-requests-count", id],
    enabled: isCommunityAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("community_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("community_id", id)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["community-messages", id],
    enabled: isMember,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_messages")
        .select("*")
        .eq("community_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  // Realtime: chat, members, settings, projects and join requests
  useEffect(() => {
    const ch = supabase
      .channel(`community-live-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_messages", filter: `community_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["community-messages", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members", filter: `community_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["community-members", id] });
        qc.invalidateQueries({ queryKey: ["my-communities"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "communities", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["community", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_join_requests", filter: `community_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["community-requests-count", id] });
        qc.invalidateQueries({ queryKey: ["community-requests", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_projects", filter: `community_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["community-projects", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useCallback(async () => {
    if (!user || (!text.trim() && !file)) return;
    setSending(true);
    let payload: Partial<Msg> = { community_id: id, sender_id: user.id, content: text.trim() || null };
    if (file) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await uploadWithSupabaseRetry("community-files", path, file, { contentType: file.type, upsert: true }, 5);
      if (up.error) { toast.error(up.error.message); setSending(false); return; }
      payload = { ...payload, file_url: path, file_name: file.name, file_type: file.type };
    }
    const { error } = await supabase.from("community_messages").insert(payload as any);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setText(""); setFile(null);
    qc.invalidateQueries({ queryKey: ["community-messages", id] });
  }, [user, text, file, id, qc]);

  const join = async () => {
    if (!user || !community) return;
    if (community.visibility === "public") {
      const { error } = await supabase.from("community_members").insert({ community_id: id, user_id: user.id, role: "member" });
      if (error) { toast.error(error.message); return; }
      toast.success("You joined this community");
      qc.invalidateQueries({ queryKey: ["community-members", id] });
      qc.invalidateQueries({ queryKey: ["my-communities"] });
    } else {
      const { error } = await supabase.from("community_join_requests").insert({ community_id: id, user_id: user.id, status: "pending" });
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["community-requests-count", id] });
      toast.success("Request sent to the community admin");
    }
  };

  const promote = async (m: Member) => {
    const next = m.role === "admin" ? "member" : "admin";
    const { error } = await supabase.from("community_members").update({ role: next }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "admin" ? "Promoted to community admin" : "Changed to member");
    qc.invalidateQueries({ queryKey: ["community-members", id] });
  };

  const coverUrl = useStorageUrl("community-images", community?.cover_image_url ?? null);
  const avatarSrc = (community as any)?.is_general ? logoSrc : coverUrl;

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) => {
        const q = memberSearch.toLowerCase();
        const name = `${m.profiles?.first_name ?? ""} ${m.profiles?.last_name ?? ""} ${m.profiles?.username ?? ""}`.toLowerCase();
        return name.includes(q);
      })
    : members;

  if (isLoading) {
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Chat-style header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center gap-2">
          <Link to="/communities" className="p-2 rounded-md hover:bg-muted/50" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={() => setShowInfo((s) => !s)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-md px-1 py-1 hover:bg-muted/40 transition"
          >
            <span className="h-9 w-9 rounded-full overflow-hidden shrink-0 gradient-bg flex items-center justify-center">
              {avatarSrc ? (
                <img src={avatarSrc} alt={`${community.name} icon`} className="h-full w-full object-cover" />
              ) : (
                <Users className="h-4 w-4 text-primary-foreground" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-sm truncate">{community.name}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {members.length.toLocaleString()} members · tap for info
              </span>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition shrink-0", showInfo && "rotate-180")} />
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {isCommunityAdmin && (
              <Button size="sm" className="gradient-bg text-primary-foreground h-8 px-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Create project</span>
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="h-8 px-2">
              <Link to="/community-projects/$id" params={{ id }}>
                <FolderKanban className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Projects</span>
              </Link>
            </Button>
            {isCommunityAdmin && (
              <Button asChild size="sm" variant="outline" className="h-8 px-2 relative">
                <Link to="/community-requests/$id" params={{ id }}>
                  <UserPlus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Requests</span>
                  {pendingCount > 0 && (
                    <span className="ml-1 rounded-full gradient-bg text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{pendingCount}</span>
                  )}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Info panel: description + all members */}
        {showInfo && (
          <div className="border-t border-border bg-background/95 max-h-[70vh] overflow-y-auto">
            <div className="container mx-auto px-4 py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {community.visibility === "private" ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />} {community.visibility}
                </span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {members.length.toLocaleString()} members</span>
                <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {community.active_projects} active projects</span>
                {community.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {community.location}</span>}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/community/${community.id}`); toast.success("Community link copied"); }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                </Button>
                {!isMember && (
                  <Button size="sm" className="h-7 gradient-bg text-primary-foreground" onClick={join}>
                    {community.visibility === "private" ? "Send request to join" : "Join community"}
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground max-w-3xl">{community.description}</p>

              {isCommunityAdmin && (
                <div className="glass rounded-2xl p-4">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Community settings</h3>

                  {!isGeneral && (
                    <div className="mt-3 flex items-center gap-3">
                      <Avatar className="h-12 w-12 border border-border/60">
                        {avatarSrc ? <AvatarImage src={avatarSrc} alt={community.name} /> : null}
                        <AvatarFallback className="gradient-bg text-primary-foreground text-xs">{community.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs text-muted-foreground">Community image</p>
                        <Button size="sm" variant="outline" className="h-8 mt-1" disabled={uploadingCover} onClick={() => coverInput.current?.click()}>
                          {uploadingCover ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
                          Change image
                        </Button>
                        <input
                          ref={coverInput}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) changeCover(f); e.target.value = ""; }}
                        />
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-muted-foreground">Choose who is allowed to send messages in the group chat.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={membersCanPost ? "default" : "outline"}
                      className={cn("h-8", membersCanPost && "gradient-bg text-primary-foreground")}
                      onClick={() => setMembersCanPost(true)}
                    >
                      All members can send
                    </Button>
                    <Button
                      size="sm"
                      variant={!membersCanPost ? "default" : "outline"}
                      className={cn("h-8", !membersCanPost && "gradient-bg text-primary-foreground")}
                      onClick={() => setMembersCanPost(false)}
                    >
                      Admins only
                    </Button>
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">Choose who can join this community.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={community.visibility === "public" ? "default" : "outline"}
                      className={cn("h-8", community.visibility === "public" && "gradient-bg text-primary-foreground")}
                      onClick={() => setVisibility("public")}
                    >
                      <Globe className="h-3.5 w-3.5 mr-1" /> Public
                    </Button>
                    <Button
                      size="sm"
                      variant={community.visibility === "private" ? "default" : "outline"}
                      className={cn("h-8", community.visibility === "private" && "gradient-bg text-primary-foreground")}
                      onClick={() => setVisibility("private")}
                    >
                      <Lock className="h-3.5 w-3.5 mr-1" /> Private
                    </Button>
                  </div>
                </div>
              )}

              {isMember && (
                <div className="flex flex-wrap gap-2">
                  {isOwner ? (
                    <Button size="sm" variant="destructive" className="h-8" onClick={deleteCommunity}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete community
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8" onClick={leaveCommunity}>
                      <LogOut className="h-3.5 w-3.5 mr-1" /> Leave community
                    </Button>
                  )}
                </div>
              )}


              <div className="glass rounded-2xl p-4">
                <h3 className="font-semibold text-sm flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> Members ({members.length})</h3>
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members…"
                  className="glass mt-3 h-9"
                />
                <ul className="mt-3 space-y-1 max-h-[40vh] overflow-y-auto">
                  {filteredMembers.map((m) => (
                    <MemberRow
                      key={m.id}
                      m={m}
                      isOwnerRow={isOwnerUser(m.user_id)}
                      canPromote={isOwner && m.user_id !== user?.id && !isOwnerUser(m.user_id)}
                      onPromote={() => promote(m)}
                    />
                  ))}
                  {filteredMembers.length === 0 && <li className="text-xs text-muted-foreground p-2">No members found.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Chat body */}
      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold">Members only</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {community.visibility === "private"
              ? "Send a request to join and an admin will approve you."
              : "Join this community to see the group chat."}
          </p>
          <Button size="sm" className="gradient-bg text-primary-foreground mt-2" onClick={join}>
            {community.visibility === "private" ? "Send request to join" : "Join community"}
          </Button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 container mx-auto max-w-3xl w-full">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No messages yet — say hello to the community 👋</p>
            )}
            {messages.map((m) => (
              <GroupBubble key={m.id} m={m} mine={m.sender_id === user?.id} author={members.find((x) => x.user_id === m.sender_id)} />
            ))}
          </div>

          <div className="sticky bottom-0 glass-strong border-t border-border">
            {!canPost ? (
              <div className="container mx-auto max-w-3xl p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> This community is admins only — only admins can send messages here.
              </div>
            ) : (
            <div className="container mx-auto max-w-3xl p-3 space-y-2">
              {file && (
                <div className="flex items-center gap-2 text-xs glass rounded-lg px-2 py-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="truncate flex-1">{file.name}</span>
                  <button onClick={() => setFile(null)} aria-label="Remove attachment"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={fileInput} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setFile(f); }} />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="h-10 w-10 shrink-0 rounded-full glass flex items-center justify-center hover:bg-muted/50"
                  aria-label="Attach"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Message the community... (Shift+Enter for newline)"
                  rows={1}
                  className="flex-1 resize-none glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring max-h-32"
                />
                <button
                  onClick={send}
                  disabled={sending || (!text.trim() && !file)}
                  className="h-10 w-10 shrink-0 rounded-full gradient-bg text-primary-foreground flex items-center justify-center disabled:opacity-50"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
            )}
          </div>
        </>
      )}

      <CreateProjectDialog communityId={id} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function MemberRow({ m, canPromote, onPromote, isOwnerRow }: { m: Member; canPromote: boolean; onPromote: () => void; isOwnerRow?: boolean }) {
  const avatar = useStorageUrl("avatars", m.profiles?.avatar_url ?? null);
  const name = `${m.profiles?.first_name ?? ""} ${m.profiles?.last_name ?? ""}`.trim() || m.profiles?.username || "Member";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <li className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatar ?? undefined} alt={name} />
        <AvatarFallback className="gradient-bg text-primary-foreground text-[10px] font-bold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate font-medium">{name}</div>
        {m.profiles?.username && <div className="text-[11px] text-muted-foreground truncate">@{m.profiles.username}</div>}
      </div>
      {isOwnerRow ? (
        <span className="text-[10px] font-semibold text-primary flex items-center gap-1"><Shield className="h-3 w-3" /> Owner</span>
      ) : m.role === "admin" ? (
        <span className="text-[10px] font-semibold text-primary flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</span>
      ) : null}
      {canPromote && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onPromote}>
          {m.role === "admin" ? "Demote" : "Promote"}
        </Button>
      )}
    </li>
  );
}

function GroupBubble({ m, mine, author }: { m: Msg; mine: boolean; author?: Member }) {
  const fileUrl = useStorageUrl("community-files", m.file_url);
  const isImage = m.file_type?.startsWith("image/");
  const name = `${author?.profiles?.first_name ?? ""} ${author?.profiles?.last_name ?? ""}`.trim() || author?.profiles?.username || "Member";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words", mine ? "gradient-bg text-primary-foreground" : "glass border border-border")}>
        {!mine && <div className="text-[11px] font-semibold opacity-80 mb-0.5">{name}</div>}
        {fileUrl && isImage && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="block mb-1">
            <img src={fileUrl} alt={m.file_name ?? "image"} className="rounded-lg max-h-64 object-cover" />
          </a>
        )}
        {fileUrl && !isImage && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline mb-1">
            <Paperclip className="h-3.5 w-3.5" /> {m.file_name ?? "attachment"}
          </a>
        )}
        {m.content}
        <div className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
