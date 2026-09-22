import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { ArrowLeft, FolderKanban, Loader2, Plus, Check, X, ShieldCheck } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { supabase } from "@/integrations/supabase/client";
import { useCommunityLive } from "@/lib/community-live";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useStorageUrl } from "@/lib/storage-url";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RichEditor = lazy(() => import("@/components/RichEditor").then((m) => ({ default: m.RichEditor })));

export const Route = createFileRoute("/community-projects/$id")({
  component: () => <RequireAuth><CommunityProjectsPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Community projects — Ecomedic Squad" },
      { name: "description", content: "Current and past projects run by an Ecomedic Squad community." },
      { property: "og:title", content: "Community projects — Ecomedic Squad" },
      { property: "og:description", content: "Current and past projects run by an Ecomedic Squad community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Project = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  image_url: string | null;
  status: "active" | "done" | "cancelled";
  created_by: string;
  created_at: string;
};

function CommunityProjectsPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  useCommunityLive(id);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);

  const { data: community } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data } = await supabase.from("communities").select("id, name").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: myRole } = useQuery({
    queryKey: ["community-my-role", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("community_members").select("role").eq("community_id", id).eq("user_id", user!.id).maybeSingle();
      return (data?.role ?? null) as "admin" | "member" | null;
    },
  });
  const canManage = myRole === "admin" || isAdmin;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["community-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_projects")
        .select("*")
        .eq("community_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const current = projects.filter((p) => p.status === "active");
  const past = projects.filter((p) => p.status !== "active");

  const setStatus = async (p: Project, status: "done" | "cancelled") => {
    const { error } = await supabase.from("community_projects").update({ status }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "done" ? "Project marked as done" : "Project cancelled");
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["community-projects", id] });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center gap-2">
          <Link to="/community/$id" params={{ id }} className="p-2 rounded-md hover:bg-muted/50" aria-label="Back to community">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">Projects</div>
            <div className="text-[11px] text-muted-foreground truncate">{community?.name ?? "Community"}</div>
          </div>
          {canManage && (
            <Button size="sm" className="gradient-bg text-primary-foreground h-8" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Add project</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl w-full px-4 py-6 space-y-8">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <section>
              <h2 className="text-lg font-bold flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /> Current projects</h2>
              {current.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">No active projects yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {current.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => setSelected(p)} />)}
                </div>
              )}
            </section>

            {canManage && past.length > 0 && (
              <section>
                <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Finished / cancelled (admins only)</h2>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {past.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => setSelected(p)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <CreateProjectDialog communityId={id} open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="glass-strong max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{selected.description || "No description provided."}</DialogDescription>
              </DialogHeader>

              <ProjectImage path={selected.image_url} name={selected.name} />

              {canManage && <ProjectReviews project={selected} />}

              {canManage && selected.status === "active" && (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setStatus(selected, "cancelled")}>
                    <X className="h-4 w-4 mr-1" /> Cancel project
                  </Button>
                  <Button className="gradient-bg text-primary-foreground" onClick={() => setStatus(selected, "done")}>
                    <Check className="h-4 w-4 mr-1" /> Done
                  </Button>
                </DialogFooter>
              )}
              {selected.status !== "active" && (
                <p className="text-xs text-muted-foreground">
                  This project is <span className="font-semibold">{selected.status}</span> and is no longer visible to community members.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectImage({ path, name }: { path: string | null; name: string }) {
  const url = useStorageUrl("community-images", path);
  if (!url) return null;
  return <img src={url} alt={`${name} project`} className="rounded-xl w-full max-h-64 object-cover" />;
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const url = useStorageUrl("community-images", p.image_url);
  return (
    <button type="button" onClick={onOpen} className="glass rounded-2xl overflow-hidden text-left hover:glow transition flex flex-col">
      <div className="aspect-video bg-muted/30">
        {url ? <img src={url} alt={`${p.name} cover`} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-bg opacity-40" />}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm flex-1 truncate">{p.name}</h3>
          <span className={cn("text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full", p.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
            {p.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
      </div>
    </button>
  );
}

function ProjectReviews({ project }: { project: Project }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ["project-reviews", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_project_reviews")
        .select("id, title, content, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string | null; content: string; created_at: string }[];
    },
  });

  const save = async () => {
    if (!user) return;
    if (!content.trim()) { toast.error("Write the review content first"); return; }
    setSaving(true);
    const { error } = await supabase.from("community_project_reviews").insert({
      project_id: project.id,
      author_id: user.id,
      title: title.trim() || null,
      content,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Review added");
    setTitle(""); setContent(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["project-reviews", project.id] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Reviews (admins only)</h4>
        <Button size="sm" variant="outline" onClick={() => setOpen((s) => !s)}>
          {open ? "Close" : <><Plus className="h-4 w-4 mr-1" /> Add review</>}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 glass rounded-xl p-3">
          <Label htmlFor="review-title">Title</Label>
          <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} className="glass" placeholder="Review title" />
          <Label>Content</Label>
          <Suspense fallback={<div className="h-40 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}>
            <RichEditor value={content} onChange={setContent} />
          </Suspense>
          <Button onClick={save} disabled={saving} className="gradient-bg text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save review"}
          </Button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <article key={r.id} className="glass rounded-xl p-3">
              {r.title && <h5 className="font-semibold text-sm">{r.title}</h5>}
              <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-2" dangerouslySetInnerHTML={{ __html: r.content }} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
