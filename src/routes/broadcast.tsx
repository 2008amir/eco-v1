import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { PostBody } from "@/lib/post-content";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/broadcast")({
  component: () => <RequireAuth><BroadcastPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Broadcast — Ecomedic Squad" },
      { name: "description", content: "Organisation-wide broadcasts and announcements from the Ecomedic Squad team." },
      { property: "og:title", content: "Broadcast — Ecomedic Squad" },
      { property: "og:description", content: "Organisation-wide broadcasts and announcements from the Ecomedic Squad team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function BroadcastPage() {
  const [search, setSearch] = useState("");
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["posts", "broadcast"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research")
        .select("id, title, description, header_image_url, content_html, created_at")
        .eq("post_kind" as any, "broadcast")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const q = search.trim().toLowerCase();
  const list = q ? items.filter((b: any) => b.title.toLowerCase().includes(q) || (b.description ?? "").toLowerCase().includes(q)) : items;

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="h-6 w-6 text-primary" /> Broadcast</h1>

        {isLoading ? (
          <div className="space-y-6 mt-6">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass rounded-2xl h-56 animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="glass-strong rounded-2xl p-12 text-center mt-6">
            <p className="text-muted-foreground text-sm">No broadcasts yet. Announcements from the team will appear here.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {list.map((b: any) => (
              <section key={b.id} className="glass-strong rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 pt-5 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
                    <Radio className="h-3.5 w-3.5" /> Broadcast
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(b.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div className="px-5 pt-3">
                  <h2 className="text-xl font-semibold">{b.title}</h2>
                  {b.description && <p className="text-sm text-muted-foreground mt-1">{b.description}</p>}
                </div>
                <StorageImage bucket="research-images" path={b.header_image_url} alt={b.title} className="w-full max-h-80 object-cover mt-4" />
                {b.content_html && (
                  <div className="mt-4 bg-white text-[#111827] rounded-b-2xl overflow-hidden">
                    <PostBody html={b.content_html} />
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
