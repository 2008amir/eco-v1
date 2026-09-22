import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Position = {
  id: string;
  name: string;
  description: string;
  is_member: boolean;
  reg_amount: number;
  monthly_amount: number;
};

export type PaymentAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  note: string | null;
};

export type PendingPayment = {
  id: string;
  user_id: string;
  kind: "registration" | "monthly" | "position";
  amount: number;
  receipt_url: string | null;
  period: string | null;
  created_at: string;
  position_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
};

/** Monthly dues start counting from October 2026. */
export const MONTHLY_START = { year: 2026, month: 10 };

export function monthlyPeriods(): string[] {
  const out: string[] = [];
  const now = new Date();
  let y = MONTHLY_START.year;
  let m = MONTHLY_START.month;
  const endY = now.getFullYear();
  const endM = now.getMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  if (out.length === 0) out.push(`${MONTHLY_START.year}-${String(MONTHLY_START.month).padStart(2, "0")}`);
  return out.reverse();
}

export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

/** First day of the period, used to decide who was registered before it. */
export function periodStart(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
}

export function formatAmount(amount: number | string | null | undefined) {
  const n = Number(amount ?? 0);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("positions").select("*").order("is_member", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Position[];
    },
  });
}

export function usePaymentAccount() {
  return useQuery({
    queryKey: ["payment-account"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_accounts").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PaymentAccount | null;
    },
  });
}

export function usePendingPayments(kind: "registration" | "monthly" | "position") {
  return useQuery({
    queryKey: ["pending-payments", kind],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_pending_payments", { _kind: kind });
      if (error) throw error;
      return (data ?? []) as unknown as PendingPayment[];
    },
  });
}
