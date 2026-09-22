import { createFileRoute, Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/news/")({
  component: () => <RequireAuth><NewsPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "News — Ecomedic Squad" },
      { name: "description", content: "Health, science and organisation news curated for the Ecomedic Squad network." },
      { property: "og:title", content: "News — Ecomedic Squad" },
      { property: "og:description", content: "Health, science and organisation news curated for the Ecomedic Squad network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function NewsPage() {
  const [search, setSearch] = useState("");
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["posts", "news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research")
        .select("id, title, description, header_image_url, category, created_at")
        .eq("post_kind" as any, "news")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const q = search.trim().toLowerCase();
  const list = q ? items.filter((n: any) => n.title.toLowerCase().includes(q) || (n.description ?? "").toLowerCase().includes(q)) : items;

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Newspaper className="h-6 w-6 text-primary" /> News</h1>

        {isLoading ? (
          <div className="space-y-4 mt-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-36 animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="glass-strong rounded-2xl p-12 text-center mt-6">
            <p className="text-muted-foreground text-sm">No news articles published yet.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {list.map((n: any) => (
              <article key={n.id} className="glass rounded-2xl overflow-hidden sm:flex">
                <StorageImage bucket="research-images" path={n.header_image_url} alt={n.title} className="sm:w-56 w-full h-40 sm:h-auto object-cover" />
                <div className="p-5 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {n.category} · {new Date(n.created_at).toLocaleDateString()}
                  </div>
                  <h2 className="font-semibold text-lg mt-1">{n.title}</h2>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{n.description}</p>
                  <Link to="/news/$id" params={{ id: n.id }} className="inline-block mt-3 text-sm font-medium text-primary hover:underline">
                    Read more →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
