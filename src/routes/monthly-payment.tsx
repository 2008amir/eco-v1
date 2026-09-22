import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { usePositions, periodLabel, formatAmount } from "@/lib/membership";
import { memberPeriods, periodDueDate, useMyMonthlyPayments, type MonthStatus } from "@/lib/monthly";
import { PaymentStep } from "@/components/PaymentStep";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/monthly-payment")({
  component: () => <RequireAuth><MonthlyPaymentPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Monthly payment — Ecomedic Squad" },
      { name: "description", content: "See every month of your Ecomedic Squad dues, your payment status for each month, and make an outstanding payment." },
      { property: "og:title", content: "Monthly payment — Ecomedic Squad" },
      { property: "og:description", content: "Track and pay your Ecomedic Squad monthly dues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const META: Record<MonthStatus, { label: string; icon: any; cls: string }> = {
  paid: { label: "Paid", icon: CheckCircle2, cls: "text-primary bg-primary/15" },
  review: { label: "In review", icon: Clock, cls: "text-amber-500 bg-amber-500/15" },
  overdue: { label: "Not paid", icon: AlertTriangle, cls: "text-destructive bg-destructive/15" },
};

function MonthlyPaymentPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: positions = [] } = usePositions();
  const { data: statuses } = useMyMonthlyPayments(user?.id);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const periods = memberPeriods(profile?.registered_at ?? null);
  const position = positions.find((p) => p.id === profile?.position_id);
  const amount = Number(position?.monthly_amount ?? 0);
  const statusOf = (p: string): MonthStatus => statuses?.get(p) ?? "overdue";

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold gradient-text">Monthly payment</h1>
        <p className="text-sm text-muted-foreground">
          Your dues start the month after you registered. Tap a month to see its status or to pay.
        </p>

        {periods.length === 0 && (
          <div className="glass-strong rounded-2xl p-6 text-sm text-muted-foreground">
            Your monthly dues will start the month after your registration is verified.
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {periods.map((p) => {
            const s = statusOf(p);
            const { label, icon: Icon, cls } = META[s];
            return (
              <button key={p} onClick={() => setOpen(p)}
                className="glass-strong rounded-2xl p-4 flex items-center justify-between gap-3 text-left hover:ring-1 hover:ring-primary transition">
                <div>
                  <div className="font-semibold">{periodLabel(p)}</div>
                  <div className="text-xs text-muted-foreground">{formatAmount(amount)}</div>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full", cls)}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open ? periodLabel(open) : ""}</DialogTitle></DialogHeader>
          {open && (() => {
            const s = statusOf(open);
            if (s === "paid") return <p className="text-sm text-primary">This month has been paid and verified. Thank you.</p>;
            if (s === "review") return <p className="text-sm text-muted-foreground">Your payment for this month is under review. You will see “Paid” once the administration verifies it.</p>;
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This month is not paid. {new Date() > periodDueDate(open) ? "It is past due." : ""}
                </p>
                {user && (
                  <PaymentStep
                    userId={user.id}
                    amount={amount}
                    kind="monthly"
                    period={open}
                    positionId={profile?.position_id ?? null}
                    title={`Monthly dues — ${periodLabel(open)}`}
                    onSubmitted={async () => {
                      await refreshProfile();
                      qc.invalidateQueries({ queryKey: ["my-monthly-payments", user.id] });
                      setOpen(null);
                    }}
                  />
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
