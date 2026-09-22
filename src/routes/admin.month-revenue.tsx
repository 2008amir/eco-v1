import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { PaymentPlan } from "@/components/admin/PaymentPlan";
import { AwaitingVerification } from "@/components/admin/AwaitingVerification";
import { monthlyPeriods, periodLabel, periodStart } from "@/lib/membership";

export const Route = createFileRoute("/admin/month-revenue")({ component: MonthRevenue });

function MonthDetail({ period, onBack }: { period: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["month-pay", period],
    queryFn: async () => {
      const start = periodStart(period).toISOString();
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, phone, registered_at")
        .not("registered_at", "is", null)
        .lt("registered_at", start);
      if (error) throw error;
      const { data: paid, error: perr } = await supabase
        .from("payments")
        .select("user_id")
        .eq("kind", "monthly")
        .eq("period", period)
        .eq("status", "verified");
      if (perr) throw perr;
      const paidIds = new Set((paid ?? []).map((p: any) => p.user_id));
      const all = (users ?? []) as unknown as Array<Record<string, any>>;
      return { paid: all.filter((u) => paidIds.has(u.id)), unpaid: all.filter((u) => !paidIds.has(u.id)) };
    },
  });

  const List = ({ rows }: { rows: Array<Record<string, any>> }) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((u) => (
        <div key={u.id} className="glass rounded-xl p-4">
          <div className="font-semibold">{[u.first_name, u.last_name].filter(Boolean).join(" ") || `@${u.username}`}</div>
          <div className="text-sm text-muted-foreground">{u.phone || "No phone"}</div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nobody here.</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" />All months</Button>
      <h2 className="text-lg font-semibold">{periodLabel(period)}</h2>
      {isLoading ? <div className="glass rounded-xl h-32 animate-pulse" /> : (
        <Tabs defaultValue="pay">
          <TabsList>
            <TabsTrigger value="pay">Pay</TabsTrigger>
            <TabsTrigger value="not">Not in pay</TabsTrigger>
          </TabsList>
          <TabsContent value="pay" className="mt-4"><List rows={data?.paid ?? []} /></TabsContent>
          <TabsContent value="not" className="mt-4"><List rows={data?.unpaid ?? []} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function UsersPay() {
  const [period, setPeriod] = useState<string | null>(null);
  if (period) return <MonthDetail period={period} onBack={() => setPeriod(null)} />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {monthlyPeriods().map((p) => (
        <button key={p} onClick={() => setPeriod(p)} className="glass rounded-xl p-4 text-left hover:ring-1 hover:ring-primary transition">
          <div className="font-semibold">{periodLabel(p)}</div>
          <div className="text-xs text-muted-foreground">{p}</div>
        </button>
      ))}
    </div>
  );
}

function MonthRevenue() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gradient-text">Monthly revenue</h1>
      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Payment plans</TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting verification</TabsTrigger>
          <TabsTrigger value="users">Users pay</TabsTrigger>
        </TabsList>
        <TabsContent value="plan" className="mt-4"><PaymentPlan field="monthly_amount" /></TabsContent>
        <TabsContent value="awaiting" className="mt-4"><AwaitingVerification kind="monthly" /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersPay /></TabsContent>
      </Tabs>
    </div>
  );
}
