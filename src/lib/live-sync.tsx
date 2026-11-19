import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { enablePush, inIframe, pushMessage, pushSupported } from "@/lib/push";

const LIVE_TABLES = [
  "research", "payments", "profiles", "comments", "likes", "comment_likes", "saved_research", "positions",
  "community_project_reviews", "org_policies", "user_roles", "payment_accounts", "messages",
  "community_messages", "communities", "community_members", "community_join_requests", "community_projects", "notifications",
];

/** Keeps every screen up to date: any change anyone makes refreshes the visible data within a moment. */
export function LiveSync() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const refreshRef = useRef(refreshProfile);
  refreshRef.current = refreshProfile;

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; qc.invalidateQueries({ type: "active" }); }, 150);
    };
    let ch = supabase.channel(`live-${Math.random().toString(36).slice(2)}`);
    for (const table of LIVE_TABLES) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (table === "profiles" || table === "user_roles") {
          const row = (payload.new ?? payload.old) as { id?: string; user_id?: string };
          if (row?.id === user.id || row?.user_id === user.id) void refreshRef.current();
        }
        if (table === "notifications" && payload.eventType === "INSERT") {
          const n = payload.new as { title: string; body: string; url: string };
          toast(n.title, {
            description: n.body,
            action: { label: "Open", onClick: () => navigate({ to: n.url as never }) },
          });
        }
        flush();
      });
    }
    ch.subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  }, [user?.id, qc, navigate]);

  return <NotificationPrompt />;
}

/** Asks signed-in people to allow notifications when they haven't decided yet. */
function NotificationPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !pushSupported() || inIframe()) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem("push-prompt-dismissed")) return;
    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, [user?.id]);

  if (!user) return null;
  const allow = async () => {
    setBusy(true);
    const r = await enablePush(user.id);
    setBusy(false);
    setOpen(false);
    (r === "on" ? toast.success : toast.error)(pushMessage(r));
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) sessionStorage.setItem("push-prompt-dismissed", "1"); setOpen(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Allow notifications?</DialogTitle>
          <DialogDescription>
            Get news, projects, research, broadcasts, chat and payment updates instantly — even when the site is closed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { sessionStorage.setItem("push-prompt-dismissed", "1"); setOpen(false); }}>Not now</Button>
          <Button onClick={allow} disabled={busy} className="gradient-bg text-primary-foreground">Allow</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
