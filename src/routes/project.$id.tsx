import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, FolderKanban, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { PostBody, extractPageStyles } from "@/lib/post-content";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/project/$id")({
  component: () => <RequireAuth><ProjectDetail /></RequireAuth>,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["project-post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("research").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold">Project not found</h2>
          <Link to="/project" className="mt-4 inline-block text-primary hover:underline">Back to projects</Link>
        </div>
      </div>
    );
  }

  const p = data as any;
  const { pageBg, pageColor } = extractPageStyles(p.content_html);
  const textColor = pageColor || "#111827";

  return (
    <div className="min-h-screen" style={{ background: pageBg || "#ffffff", color: textColor }}>
      <div className="relative">
        <StorageImage bucket="research-images" path={p.header_image_url} alt={p.title} className="w-full h-64 md:h-80 object-cover" />
        <Link
          to="/project"
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
          aria-label="Back to projects"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-10 relative">
        <div className="rounded-2xl border border-black/10 bg-white/90 backdrop-blur p-6 shadow-lg text-[#111827]">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
              <FolderKanban className="h-3.5 w-3.5" /> Project
            </span>
            {p.category && <span className="opacity-70">{p.category}</span>}
            <span className="inline-flex items-center gap-1 opacity-70">
              <CalendarDays className="h-3.5 w-3.5" /> {new Date(p.created_at).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-3xl font-bold mt-3">{p.title}</h1>
          <p className="mt-2 opacity-80">{p.description}</p>
        </div>
      </div>

      <article className="w-full overflow-hidden mt-8 pb-16">
        <PostBody html={p.content_html} color={textColor} />
      </article>
    </div>
  );
}
