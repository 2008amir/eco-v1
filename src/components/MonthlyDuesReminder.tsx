import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { periodLabel } from "@/lib/membership";
import { memberPeriods, periodDueDate, useMyMonthlyPayments } from "@/lib/monthly";
import { AlertTriangle } from "lucide-react";

/** Reminds a member every minute once a month's dues are 7+ days late and still unpaid. */
export function MonthlyDuesReminder() {
  const { user, profile } = useAuth();
  const { data: statuses } = useMyMonthlyPayments(user?.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const overdue = memberPeriods(profile?.registered_at ?? null)
    .filter((p) => !statuses?.get(p) && new Date() > periodDueDate(p))
    .reverse();

  const hasOverdue = overdue.length > 0;

  useEffect(() => {
    if (!hasOverdue) { setOpen(false); return; }
    setOpen(true);
    const t = setInterval(() => setOpen(true), 60_000);
    return () => clearInterval(t);
  }, [hasOverdue]);

  if (!hasOverdue) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Make your monthly payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {overdue.length === 1
            ? `Your dues for ${periodLabel(overdue[0]!)} are overdue.`
            : `You have ${overdue.length} months of overdue dues, starting with ${periodLabel(overdue[0]!)}.`}
        </p>
        <Button onClick={() => { setOpen(false); navigate({ to: "/monthly-payment" }); }}
          className="w-full gradient-bg text-primary-foreground hover:opacity-90">
          Make payment
        </Button>
      </DialogContent>
    </Dialog>
  );
}
