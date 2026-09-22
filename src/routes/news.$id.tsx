import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { PostBody } from "@/lib/post-content";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/news/$id")({
  component: () => <RequireAuth><NewsArticle /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "News Article — Ecomedic Squad" },
      { name: "description", content: "Read the latest Ecomedic Squad news article." },
      { property: "og:title", content: "News Article — Ecomedic Squad" },
      { property: "og:description", content: "Read the latest Ecomedic Squad news article." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function NewsArticle() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["news", id],
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
          <h2 className="text-xl font-semibold">Article not found</h2>
          <Link to="/news" className="mt-4 inline-block text-primary hover:underline">Back to news</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <Link to="/news" className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-70">
          <ArrowLeft className="h-5 w-5" /> Back to news
        </Link>
        <p className="text-xs opacity-60 mt-6">
          {(data as any).category} · {new Date((data as any).created_at).toLocaleDateString()}
        </p>
        <h1 className="text-3xl font-bold mt-1">{(data as any).title}</h1>
        <p className="mt-3 opacity-80">{(data as any).description}</p>
        <hr className="mt-6 border-border" />
        <StorageImage bucket="research-images" path={(data as any).header_image_url} alt={(data as any).title} className="w-full rounded-lg mt-6 object-cover" />
      </div>
      <article className="w-full overflow-hidden mt-6 pb-16">
        <PostBody html={(data as any).content_html} className="site-rich-content" />
      </article>
    </div>
  );
}
