import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Search, Users, MapPin, FolderKanban, Lock, Globe, Loader2, Check, ImagePlus, Copy } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { SiteMenu } from "@/components/SiteMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCommunityLive } from "@/lib/community-live";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useStorageUrl } from "@/lib/storage-url";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/communities")({
  component: () => <RequireAuth><CommunitiesPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Communities — Ecomedic Squad" },
      { name: "description", content: "Join health, research, youth, technology and environmental communities inside the Ecomedic Squad network." },
      { property: "og:title", content: "Communities — Ecomedic Squad" },
      { property: "og:description", content: "Join health, research, youth, technology and environmental communities inside the Ecomedic Squad network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

export type Community = {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  visibility: "public" | "private";
  location: string | null;
  active_projects: number;
  invite_code: string;
  created_by: string | null;
  member_count: number;
};

function CommunitiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useCommunityLive();
  const navigate = useNavigate();
  const [topSearch, setTopSearch] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, description, cover_image_url, visibility, location, active_projects, invite_code, created_by, community_members(count)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({ ...c, member_count: c.community_members?.[0]?.count ?? 0 })) as Community[];
    },
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ["my-communities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("community_members").select("community_id").eq("user_id", user!.id);
      return (data ?? []).map((m: any) => m.community_id) as string[];
    },
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("community_join_requests").select("community_id, status").eq("user_id", user!.id);
      return (data ?? []) as { community_id: string; status: string }[];
    },
  });

  const filtered = useMemo(() => {
    const q = (search || topSearch).trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q) ||
        c.invite_code.toLowerCase() === q,
    );
  }, [communities, search, topSearch]);

  const join = async (c: Community) => {
    if (!user) return;
    if (c.visibility === "public") {
      const { error } = await supabase.from("community_members").insert({ community_id: c.id, user_id: user.id, role: "member" });
      if (error) { toast.error(error.message); return; }
      toast.success(`Joined ${c.name}`);
      qc.invalidateQueries({ queryKey: ["my-communities"] });
      qc.invalidateQueries({ queryKey: ["communities"] });
      navigate({ to: "/community/$id", params: { id: c.id } });
    } else {
      const { error } = await supabase.from("community_join_requests").insert({ community_id: c.id, user_id: user.id, status: "pending" });
      if (error) { toast.error(error.message); return; }
      toast.success("Request sent to the community admin");
      qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar search={topSearch} onSearchChange={setTopSearch} homeTo="/" profileTo="/profile" />

      <div className="flex">
        <aside className="hidden lg:block sticky top-[112px] h-[calc(100vh-112px)] w-60 border-r border-border shrink-0">
          <SiteMenu />
        </aside>

        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Communities</h1>
              <p className="text-sm text-muted-foreground">Different communities within the organisation.</p>
            </div>
            <Button onClick={() => setAddOpen(true)} className="gradient-bg text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Add community
            </Button>
          </div>

          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities or paste a community link/code…"
              className="pl-9 glass"
            />
          </div>

          <div className="lg:hidden mt-4">
            <Button variant="outline" size="sm" onClick={() => setMenuOpen((s) => !s)}>Site menu</Button>
            {menuOpen && <div className="glass rounded-xl mt-2"><SiteMenu onNavigate={() => setMenuOpen(false)} /></div>}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-80 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-strong rounded-2xl p-12 text-center mt-6">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-lg font-semibold">No communities found</h2>
              <p className="text-sm text-muted-foreground mt-1">Try another search, or create a new community.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
              {filtered.map((c) => (
                <CommunityCard
                  key={c.id}
                  c={c}
                  isMember={myMemberships.includes(c.id)}
                  requested={myRequests.some((r) => r.community_id === c.id && r.status === "pending")}
                  onJoin={() => join(c)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateCommunityDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function CommunityCard({ c, isMember, requested, onJoin }: { c: Community; isMember: boolean; requested: boolean; onJoin: () => void }) {
  const cover = useStorageUrl("community-images", c.cover_image_url);
  return (
    <div className="glass rounded-2xl overflow-hidden hover:glow transition-all flex flex-col">
      <div className="aspect-video bg-muted/30 relative overflow-hidden">
        {cover ? (
          <img src={cover} alt={`${c.name} cover`} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full gradient-bg opacity-40" />
        )}
        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider bg-background/70 backdrop-blur px-2 py-1 rounded-full font-semibold flex items-center gap-1">
          {c.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />} {c.visibility}
        </span>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-base">{c.name}</h3>
        <p className="text-xs text-primary font-medium mt-0.5">{c.member_count.toLocaleString()} Members</p>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">{c.description}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {c.active_projects} projects</span>
          {c.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {c.location}</span>}
        </div>
        <div className="mt-4 flex items-center gap-2">
          {isMember ? (
            <Link
              to="/community/$id"
              params={{ id: c.id }}
              className="flex-1 text-center text-sm font-semibold text-primary hover:underline py-2"
            >
              Explore Community →
            </Link>
          ) : requested ? (
            <Button disabled variant="outline" className="flex-1"><Check className="h-4 w-4 mr-1" /> Request sent</Button>
          ) : (
            <Button onClick={onJoin} className="flex-1 gradient-bg text-primary-foreground">
              {c.visibility === "private" ? "Request to join" : "Join"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCommunityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [groupType, setGroupType] = useState<"none" | "general">("none");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; link: string } | null>(null);

  const reset = () => {
    setName(""); setDescription(""); setLocation(""); setVisibility("public");
    setFile(null); setPreview(null); setCreated(null); setGroupType("none");
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Community name is required"); return; }
    setSaving(true);
    let coverPath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/community-${Date.now()}.${ext}`;
      const up = await uploadWithSupabaseRetry("community-images", path, file, { contentType: file.type, upsert: true }, 5);
      if (up.error) { toast.error(up.error.message); setSaving(false); return; }
      coverPath = path;
    }
    const { data, error } = await supabase
      .from("communities")
      .insert({
        name: name.trim(),
        description: description.trim(),
        location: location.trim() || null,
        visibility,
        cover_image_url: coverPath,
        created_by: user.id,
      })
      .select("id, invite_code")
      .single();
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Could not create community"); return; }
    if (isAdmin && groupType === "general") {
      const { error: gErr } = await supabase.rpc("set_community_general" as never, { _community_id: data.id, _general: true } as never);
      if (gErr) toast.error("Community created, but everyone could not be added automatically");
    }
    qc.invalidateQueries({ queryKey: ["communities"] });
    qc.invalidateQueries({ queryKey: ["my-communities"] });
    setCreated({ id: data.id, link: `${window.location.origin}/community/${data.id}` });
    toast.success("Community created");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Community ready</DialogTitle>
              <DialogDescription>Share this link so people can find and join your community.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input readOnly value={created.link} className="glass" />
              <Button
                variant="outline"
                onClick={async () => { await navigator.clipboard.writeText(created.link); toast.success("Link copied"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button
                className="gradient-bg text-primary-foreground"
                onClick={() => { onOpenChange(false); const id = created.id; reset(); navigate({ to: "/community/$id", params: { id } }); }}
              >
                Open community
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create a community</DialogTitle>
              <DialogDescription>Upload a cover image, add details and choose who can join.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full aspect-video rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2 overflow-hidden hover:bg-muted/30 transition"
              >
                {preview ? (
                  <img src={preview} alt="Cover preview" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload community image</span>
                  </>
                )}
              </button>
              <div className="space-y-1.5">
                <Label>Community name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Youth Innovation Network" className="glass" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this community about?" className="glass" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nigeria" className="glass" />
              </div>
              <div className="space-y-1.5">
                <Label>Settings</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["public", "private"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisibility(v)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        visibility === v ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30",
                      )}
                    >
                      <span className="text-sm font-semibold capitalize flex items-center gap-1.5">
                        {v === "public" ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {v}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-1">
                        {v === "public" ? "Anyone can join instantly." : "People must request to join."}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label>Group type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "none", title: "None", note: "People join or request to join." },
                      { v: "general", title: "General group", note: "Every current and future user is added automatically." },
                    ] as const).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setGroupType(o.v)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          groupType === o.v ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30",
                        )}
                      >
                        <span className="text-sm font-semibold flex items-center gap-1.5">
                          {o.v === "general" ? <Users className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />} {o.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-1">{o.note}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving} className="gradient-bg text-primary-foreground">
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create community
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
