import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MonthStatus = "paid" | "review" | "overdue";

/** Months a member owes for: starts the month AFTER they registered, up to the current month. */
export function memberPeriods(registeredAt: string | null | undefined): string[] {
  if (!registeredAt) return [];
  const reg = new Date(registeredAt);
  let y = reg.getFullYear();
  let m = reg.getMonth() + 2; // month after registration
  if (m > 12) { m -= 12; y += 1; }
  const now = new Date();
  const endY = now.getFullYear();
  const endM = now.getMonth() + 1;
  const out: string[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.reverse();
}

/** First day of the month after the given period — dues become late 7 days later. */
export function periodDueDate(period: string) {
  const [y, m] = period.split("-").map(Number);
  const end = new Date(Date.UTC(y!, m!, 1)); // first day of next month
  return new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function useMyMonthlyPayments(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-monthly-payments", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, period, status, amount, created_at")
        .eq("user_id", userId!)
        .eq("kind", "monthly");
      if (error) throw error;
      const map = new Map<string, MonthStatus>();
      for (const row of (data ?? []) as Array<{ period: string | null; status: string }>) {
        if (!row.period) continue;
        const current = map.get(row.period);
        if (row.status === "verified") map.set(row.period, "paid");
        else if (row.status === "pending" && current !== "paid") map.set(row.period, "review");
      }
      return map;
    },
  });
}
