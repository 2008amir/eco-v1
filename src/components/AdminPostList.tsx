import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseRetry } from "@/lib/supabase-retry";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { PostKind } from "@/lib/post-content";
import { POST_KIND_LABELS } from "@/lib/post-content";
import { StorageImage } from "@/components/StorageImage";

export function AdminPostList({ kind }: { kind: PostKind }) {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["admin-posts", kind],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await withSupabaseRetry(
        () => supabase
          .from("research")
          .select("id, title, description, header_image_url, category, created_at")
          .eq("post_kind" as any, kind)
          .order("created_at", { ascending: false }),
        4,
        { kind: "table", target: "research", action: `load ${kind} posts` },
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await withSupabaseRetry(() => supabase.from("research").delete().eq("id", id), 5, { kind: "table", target: "research", action: "delete post" });
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      qc.invalidateQueries({ queryKey: ["posts", kind] });
    }
  };

  const label = POST_KIND_LABELS[kind];

  return (
    <div>
      <h1 className="text-2xl font-bold gradient-text mb-6">{label}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {list.map((r: any) => (
          <div key={r.id} className="glass rounded-2xl overflow-hidden">
            <StorageImage bucket="research-images" path={r.header_image_url} alt={r.title} className="w-full aspect-video object-cover" />
            <div className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</div>
              <h3 className="font-semibold mt-1 line-clamp-2">{r.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</p>
              <div className="flex items-center justify-between mt-3 gap-2">
                <PublicLink kind={kind} id={r.id} />
                <div className="flex items-center gap-1">
                  <Link to="/admin/research/edit/$id" params={{ id: r.id }} className="p-1.5 rounded hover:bg-primary/20 text-primary" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-destructive/20 text-destructive" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-muted-foreground text-sm">Nothing here yet. Use the Add tab to create one.</p>}
      </div>
    </div>
  );
}

function PublicLink({ kind, id }: { kind: PostKind; id: string }) {
  const cls = "text-xs text-primary hover:underline";
  if (kind === "news") return <Link to="/news/$id" params={{ id }} className={cls}>View</Link>;
  if (kind === "project") return <Link to="/project/$id" params={{ id }} className={cls}>View</Link>;
  if (kind === "broadcast") return <Link to="/broadcast" className={cls}>View</Link>;
  return <Link to="/research/$id" params={{ id }} className={cls}>View</Link>;
}
