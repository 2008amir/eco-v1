import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentPlan } from "@/components/admin/PaymentPlan";
import { AwaitingVerification } from "@/components/admin/AwaitingVerification";

export const Route = createFileRoute("/admin/reg-revenue")({ component: RegRevenue });

function RegisteredUsers() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["registered-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, phone, member_no, registered_at, is_revoked, positions:positions!profiles_position_id_fkey(name)")
        .not("registered_at", "is", null)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<Record<string, any>>;
    },
  });

  if (isLoading) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-xl h-24 animate-pulse" />)}</div>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((u) => (
        <div key={u.id} className="glass rounded-xl p-4">
          <div className="font-semibold">{[u.first_name, u.last_name].filter(Boolean).join(" ") || `@${u.username}`}</div>
          <div className="text-sm text-muted-foreground">{u.phone || "No phone"}</div>
          <div className="text-xs text-muted-foreground mt-1">{u.positions?.name ?? "Member"} · {u.member_no ?? "—"}</div>
          {u.is_revoked && <div className="text-xs text-destructive mt-1">Revoked</div>}
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No registered users yet.</p>}
    </div>
  );
}

function RegRevenue() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gradient-text">Registration revenue</h1>
      <Tabs defaultValue="registered">
        <TabsList>
          <TabsTrigger value="registered">Registered users</TabsTrigger>
          <TabsTrigger value="plan">Payment plan</TabsTrigger>
          <TabsTrigger value="awaiting">Awaiting verification</TabsTrigger>
        </TabsList>
        <TabsContent value="registered" className="mt-4"><RegisteredUsers /></TabsContent>
        <TabsContent value="plan" className="mt-4"><PaymentPlan field="reg_amount" /></TabsContent>
        <TabsContent value="awaiting" className="mt-4"><AwaitingVerification kind="registration" /></TabsContent>
      </Tabs>
    </div>
  );
}
