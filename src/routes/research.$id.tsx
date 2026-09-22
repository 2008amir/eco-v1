import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Send, ArrowLeft, Loader2, Reply } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { withSupabaseRetry } from "@/lib/supabase-retry";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostBody, extractPageStyles } from "@/lib/post-content";

function formatCommentDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startToday - startThat) / 86400000);
  if (days === 1) return "1 day ago";
  if (days > 1 && days < 7) return `${days} days ago`;
  return d.toLocaleDateString();
}

export const Route = createFileRoute("/research/$id")({
  component: () => <RequireAuth><ResearchDetail /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Research Details — Ecomedic Squad" },
      { name: "description", content: "Read Ecomedic Squad research and join the discussion." },
      { property: "og:title", content: "Research Details — Ecomedic Squad" },
      { property: "og:description", content: "Read Ecomedic Squad research and join the discussion." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ResearchDetail() {
  const { id } = Route.useParams();
  const { user, profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["research", id],
    queryFn: async () => {
      const { data: r, error } = await supabase.from("research").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return r;
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["likes", id],
    queryFn: async () => {
      const { data } = await supabase.from("likes").select("user_id").eq("research_id", id);
      return data ?? [];
    },
  });
  const liked = !!user && likes.some((l: any) => l.user_id === user.id);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, parent_id, comment_likes(user_id)")
        .eq("research_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = rows ?? [];
      const userIds = Array.from(new Set(list.map((c: any) => c.user_id))).filter(Boolean);
      let profilesById: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, first_name, last_name, avatar_url")
          .in("id", userIds);
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return list.map((c: any) => ({ ...c, profiles: profilesById[c.user_id] ?? null }));
    },
  });

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      await withSupabaseRetry(() => supabase.from("likes").delete().eq("user_id", user.id).eq("research_id", id), 5, { kind: "table", target: "likes", action: "delete research like" });
    } else {
      await withSupabaseRetry(() => supabase.from("likes").insert({ user_id: user.id, research_id: id }), 5, { kind: "table", target: "likes", action: "insert research like" });
    }
    qc.invalidateQueries({ queryKey: ["likes", id] });
  };

  const submitComment = async () => {
    const text = comment.trim();
    if (!text || !user) return;
    setSubmitting(true);
    const { error } = await withSupabaseRetry(() => supabase.from("comments").insert({ user_id: user.id, research_id: id, content: text }), 5, { kind: "table", target: "comments", action: "insert research comment" });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setComment("");
    qc.invalidateQueries({ queryKey: ["comments", id] });
  };

  const submitReply = async (parentId: string) => {
    const text = replyText.trim();
    if (!text || !user) return;
    setReplySubmitting(true);
    const { error } = await withSupabaseRetry(
      () => supabase.from("comments").insert({ user_id: user.id, research_id: id, content: text, parent_id: parentId } as any),
      5,
      { kind: "table", target: "comments", action: "insert reply" },
    );
    setReplySubmitting(false);
    if (error) { toast.error(error.message); return; }
    setReplyText("");
    setReplyTo(null);
    qc.invalidateQueries({ queryKey: ["comments", id] });
  };

  const toggleCommentLike = async (commentId: string, currentlyLiked: boolean) => {
    if (!user) return;
    if (currentlyLiked) {
      await withSupabaseRetry(() => supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", commentId), 5, { kind: "table", target: "comment_likes", action: "delete comment like" });
    } else {
      await withSupabaseRetry(() => supabase.from("comment_likes").insert({ user_id: user.id, comment_id: commentId }), 5, { kind: "table", target: "comment_likes", action: "insert comment like" });
    }
    qc.invalidateQueries({ queryKey: ["comments", id] });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold">Research not found</h2>
          <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }


  const { pageBg, pageColor } = extractPageStyles(data.content_html);
  const contentBackground = pageBg || "var(--color-background)";
  const contentColor = pageColor || "var(--color-foreground)";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <article className="relative min-h-screen w-full overflow-hidden" style={{ background: contentBackground, color: contentColor }}>
        <Link
          to="/"
          className="absolute top-4 left-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/20 bg-background/80 text-foreground backdrop-blur transition-opacity hover:opacity-70"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PostBody html={data.content_html} color={contentColor} />
      </article>

      <section className="border-t border-border bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-4 pb-12">
        <hr className="border-border" />
        {/* Interaction bar */}
        <div className="mt-8 border border-border rounded-lg p-4 bg-card text-card-foreground">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLike}
              className={cn(
                "h-10 w-10 rounded-full border flex items-center justify-center transition-all shrink-0",
                liked ? "bg-destructive/10 border-destructive text-destructive" : "border-border hover:bg-muted text-muted-foreground"
              )}
              aria-label={liked ? "Unlike" : "Like"}
            >
              <Heart className={cn("h-5 w-5", liked && "fill-current")} />
            </button>
            <span className="text-sm font-medium text-current/80">{likes.length}</span>

            <div className="flex-1 relative">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                rows={1}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-12 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 min-h-[42px] max-h-32 text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={submitComment}
                disabled={submitting || !comment.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                aria-label="Send comment"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Comments */}
        <section className="mt-6 space-y-3 pb-8">
          <h2 className="text-sm font-semibold text-current opacity-60">{comments.length} Comments</h2>
          {(() => {
            const all = comments as any[];
            const repliesByParent: Record<string, any[]> = {};
            all.forEach((c) => {
              if (c.parent_id) {
                (repliesByParent[c.parent_id] ||= []).push(c);
              }
            });
            Object.values(repliesByParent).forEach((arr) =>
              arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
            );
            const topLevel = all.filter((c) => !c.parent_id);

            const renderCard = (c: any, isReply = false) => {
              const cliked = !!user && c.comment_likes?.some((l: any) => l.user_id === user.id);
              const fullName = `${c.profiles?.first_name ?? ""} ${c.profiles?.last_name ?? ""}`.trim() || c.profiles?.username || "User";
              const initials = ((c.profiles?.first_name?.[0] ?? "") + (c.profiles?.last_name?.[0] ?? "")).toUpperCase() || "U";
              return (
                <div key={c.id} className="rounded-lg border border-border bg-card text-card-foreground p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className={cn("ring-1 ring-gray-200 shrink-0", isReply ? "h-8 w-8" : "h-10 w-10")}>
                      <AvatarImage src={c.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-current truncate">{fullName}</div>
                      <p className="mt-1 text-sm whitespace-pre-wrap break-words text-current/80">{c.content}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-current opacity-50">
                        <span>{formatCommentDate(c.created_at)}</span>
                        {isAdmin && !isReply && (
                          <button
                            type="button"
                            onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }}
                            className="inline-flex items-center gap-1 hover:text-current/80"
                          >
                            <Reply className="h-3.5 w-3.5" /> Reply
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                      <button
                        onClick={() => toggleCommentLike(c.id, cliked)}
                        className={cn(
                          "h-8 w-8 rounded-full border flex items-center justify-center transition",
                           cliked ? "bg-destructive/10 border-destructive text-destructive" : "border-border text-muted-foreground hover:bg-muted"
                        )}
                        aria-label={cliked ? "Unlike comment" : "Like comment"}
                      >
                        <Heart className={cn("h-4 w-4", cliked && "fill-current")} />
                      </button>
                      <span className="text-xs text-current opacity-50 mt-1">{c.comment_likes?.length ?? 0}</span>
                    </div>
                  </div>
                </div>
              );
            };

            return topLevel.map((c) => {
              const replies = repliesByParent[c.id] ?? [];
              return (
                <div key={c.id} className="space-y-2">
                  {renderCard(c)}
                  {(replies.length > 0 || replyTo === c.id) && (
                    <div className="pl-4 border-l-2 border-border space-y-2">
                      {replies.map((r) => renderCard(r, true))}
                      {replyTo === c.id && (
                        <div className="rounded-lg border border-border bg-card p-3">
                          <div className="flex items-center gap-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply..."
                              rows={1}
                              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 min-h-[38px] max-h-32 text-foreground"
                            />
                            <button
                              onClick={() => submitReply(c.id)}
                              disabled={replySubmitting || !replyText.trim()}
                              className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0"
                              aria-label="Send reply"
                            >
                              {replySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
          {comments.length === 0 && (
            <p className="text-sm text-current opacity-50 text-center py-6">Be the first to comment!</p>
          )}
        </section>
        </div>
      </section>
    </div>
  );
}
