import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseRetry } from "@/lib/supabase-retry";
import { Heart, MessageCircle, ArrowLeft, Trash2, Ban, PauseCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteMemberAccount } from "@/lib/admin-users.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/users/$userId")({
  component: UserDetail,
  head: () => ({ meta: [
    { title: "User details — Ecomedic Squad Admin" },
    { name: "description", content: "Review and manage a member account in Ecomedic Squad." },
    { property: "og:title", content: "User details — Ecomedic Squad Admin" },
    { property: "og:description", content: "Review and manage a member account in Ecomedic Squad." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function UserDetail() {
  const { userId } = Route.useParams();
  const [showComments, setShowComments] = useState(false);
  const [action, setAction] = useState<"delete" | "suspend" | "ban" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const deleteAccount = useServerFn(deleteMemberAccount);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const { data, error } = await withSupabaseRetry(
        () => supabase.rpc("get_user_detail" as never, { _user_id: userId } as never),
        4,
        { kind: "rpc", target: "get_user_detail", action: "load user detail" },
      );
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="glass rounded-xl h-40 animate-pulse" />;
  if (!data?.profile) return <div className="text-muted-foreground">User not found.</div>;

  const p = data.profile;
  const comments = data.comments ?? [];
  const status = p.account_status === "suspended" ? "suspended" : p.account_status === "banned" || p.is_revoked ? "banned" : "active";
  const self = user?.id === userId;

  const performAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action === "delete") {
        await deleteAccount({ data: { userId } });
        toast.success("Account deleted. This person can sign up again as a new member.");
        await qc.invalidateQueries({ queryKey: ["admin-users"] });
        void navigate({ to: "/admin/users" });
      } else {
        const nextStatus = action === "restore" ? "active" : action === "ban" ? "banned" : "suspended";
        const { error } = await supabase.rpc("admin_set_account_status", { _user_id: userId, _status: nextStatus });
        if (error) throw error;
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] }),
          qc.invalidateQueries({ queryKey: ["admin-users"] }),
        ]);
        toast.success(action === "restore" ? "Account restored" : action === "ban" ? "Account banned" : "Account suspended");
      }
      setAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this account");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <div className="glass-strong rounded-2xl p-6 flex items-center gap-4">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={p.username} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full gradient-bg flex items-center justify-center text-xl font-bold text-primary-foreground">
            {(p.username ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-xl font-bold">@{p.username}</div>
          <div className="text-sm text-muted-foreground">{p.first_name} {p.last_name}</div>
          <div className="text-xs text-muted-foreground">{p.country || "—"}{p.phone ? ` • ${p.phone}` : ""}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-strong rounded-2xl p-5">
          <Heart className="h-5 w-5 text-primary mb-2" />
          <div className="text-2xl font-bold">{data.totalLikes ?? 0}</div>
          <div className="text-xs text-muted-foreground">Total likes</div>
        </div>
        <Button variant="ghost" onClick={() => setShowComments((v) => !v)} className="glass-strong rounded-2xl p-5 text-left hover:ring-1 hover:ring-primary transition h-auto block">
          <MessageCircle className="h-5 w-5 text-primary mb-2" />
          <div className="text-2xl font-bold">{data.totalComments ?? 0}</div>
          <div className="text-xs text-muted-foreground">Total comments {showComments ? "(hide)" : "(view)"}</div>
        </Button>
      </div>

      {showComments && (
        <div className="glass-strong rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold">All comments</div>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="border border-border rounded-xl p-3">
                <div className="text-sm">{c.content}</div>
                <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
                  <span>On: {c.research_title ?? c.research_id}</span>
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <section className="border-t border-border pt-6 space-y-3">
        <h2 className="text-base font-semibold">Account access</h2>
        <p className="text-sm text-muted-foreground">Status: {status === "active" ? "Active" : status === "suspended" ? "Suspended" : "Banned"}</p>
        <div className="flex flex-wrap gap-2">
          {status !== "active" ? (
            <Button variant="outline" disabled={self} onClick={() => setAction("restore")}><RotateCcw className="mr-2 h-4 w-4" />Return account</Button>
          ) : (
            <Button variant="outline" disabled={self} onClick={() => setAction("suspend")}><PauseCircle className="mr-2 h-4 w-4" />Suspend</Button>
          )}
          {status !== "banned" && <Button variant="outline" disabled={self} onClick={() => setAction("ban")}><Ban className="mr-2 h-4 w-4" />Revoke / ban</Button>}
          <Button variant="destructive" disabled={self} onClick={() => setAction("delete")}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>
        </div>
      </section>
      <AlertDialog open={!!action} onOpenChange={(open) => { if (!open && !busy) setAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action === "delete" ? "Permanently delete this account?" : action === "restore" ? "Return this account?" : action === "ban" ? "Ban this account?" : "Suspend this account?"}</AlertDialogTitle>
            <AlertDialogDescription>{action === "delete" ? "This permanently removes the account and its registration, payment, messages and related records. They will have to sign up again and start from the beginning." : action === "restore" ? "They will be able to access the site again." : action === "ban" ? "They will see that their account was banned from this site." : "They will see that their account was suspended until you return it."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void performAction(); }} className={action === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
