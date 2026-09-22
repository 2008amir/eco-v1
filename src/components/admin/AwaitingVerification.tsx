import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { StorageImage } from "@/components/StorageImage";
import { formatAmount, usePendingPayments, type PendingPayment } from "@/lib/membership";

export function AwaitingVerification({ kind }: { kind: "registration" | "monthly" | "position" }) {
  const { data: rows = [], isLoading } = usePendingPayments(kind);
  const [open, setOpen] = useState<PendingPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const act = async (action: "verify" | "reject" | "revoke") => {
    if (!open) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_review_payment", { _payment_id: open.id, _action: action });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pending-payments"] });
    qc.invalidateQueries({ queryKey: ["registered-users"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success(action === "verify" ? "Payment verified" : action === "reject" ? "Marked as not received" : "User revoked");
    setOpen(null);
  };

  if (isLoading) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-xl h-24 animate-pulse" />)}</div>;

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <button key={r.id} onClick={() => setOpen(r)} className="glass rounded-xl p-4 text-left hover:ring-1 hover:ring-primary transition">
            <div className="font-semibold">{[r.first_name, r.last_name].filter(Boolean).join(" ") || `@${r.username}`}</div>
            <div className="text-sm text-muted-foreground">{r.phone || "No phone"}</div>
            {r.period && <div className="text-xs text-muted-foreground mt-1">{r.period}</div>}
          </button>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No payments awaiting verification.</p>}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment details</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-4">
              {open.receipt_url
                ? <StorageImage bucket="receipts" path={open.receipt_url} alt="Payment receipt" className="w-full max-h-80 object-contain rounded-lg border border-border bg-muted/30" />
                : <p className="text-sm text-muted-foreground">No receipt uploaded.</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Name</div>{[open.first_name, open.last_name].filter(Boolean).join(" ") || "—"}</div>
                <div><div className="text-muted-foreground text-xs">Phone no</div>{open.phone || "—"}</div>
                <div><div className="text-muted-foreground text-xs">Position</div>{open.position_name || "Member"}</div>
                <div><div className="text-muted-foreground text-xs">Amount</div>{formatAmount(open.amount)}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button disabled={busy} onClick={() => act("verify")} className="gradient-bg text-primary-foreground hover:opacity-90">Verify</Button>
                <Button disabled={busy} variant="outline" onClick={() => act("reject")}>Not verify</Button>
                <Button disabled={busy} variant="destructive" onClick={() => act("revoke")}>Revoke user</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
