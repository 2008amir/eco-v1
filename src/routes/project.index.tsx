import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/project/")({
  component: () => <RequireAuth><ProjectsPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Projects — Ecomedic Squad" },
      { name: "description", content: "Active projects and initiatives across the Ecomedic Squad network." },
      { property: "og:title", content: "Projects — Ecomedic Squad" },
      { property: "og:description", content: "Active projects and initiatives across the Ecomedic Squad network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ProjectsPage() {
  const [search, setSearch] = useState("");
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["posts", "project"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research")
        .select("id, title, description, header_image_url, category, section, created_at")
        .eq("post_kind" as any, "project")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const q = search.trim().toLowerCase();
  const list = q ? items.filter((p: any) => p.title.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)) : items;

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FolderKanban className="h-6 w-6 text-primary" /> Projects</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-64 animate-pulse" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="glass-strong rounded-2xl p-12 text-center mt-6">
            <p className="text-muted-foreground text-sm">No projects listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
            {list.map((p: any) => (
              <Link
                key={p.id}
                to="/project/$id"
                params={{ id: p.id }}
                className="glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-primary transition flex flex-col"
              >
                {p.header_image_url
                  ? <StorageImage bucket="research-images" path={p.header_image_url} alt={p.title} className="w-full aspect-video object-cover" />
                  : <div className="w-full aspect-video gradient-bg opacity-70 flex items-center justify-center"><FolderKanban className="h-10 w-10 text-primary-foreground" /></div>}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">Project</span>
                    {p.section && <span className="text-[10px] text-muted-foreground">{p.section}</span>}
                  </div>
                  <h2 className="font-semibold mt-2 line-clamp-2">{p.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 flex-1">{p.description}</p>
                  <span className="text-xs text-primary mt-3">View project →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
