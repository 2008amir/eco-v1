import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { usePaymentAccount, usePositions } from "@/lib/membership";

function AccountDetails() {
  const { data: account, isLoading } = usePaymentAccount();
  const qc = useQueryClient();
  const [form, setForm] = useState({ bank_name: "", account_name: "", account_number: "", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) setForm({
      bank_name: account.bank_name, account_name: account.account_name,
      account_number: account.account_number, note: account.note ?? "",
    });
  }, [account]);

  const save = async () => {
    if (!form.bank_name || !form.account_name || !form.account_number) {
      toast.error("Fill bank, account name and account number");
      return;
    }
    setSaving(true);
    const payload = { ...form, note: form.note || null, updated_at: new Date().toISOString() };
    const { error } = account
      ? await supabase.from("payment_accounts").update(payload).eq("id", account.id)
      : await supabase.from("payment_accounts").insert(payload as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["payment-account"] });
    toast.success("Account saved");
  };

  const remove = async () => {
    if (!account || !confirm("Delete the recipient account?")) return;
    const { error } = await supabase.from("payment_accounts").delete().eq("id", account.id);
    if (error) { toast.error(error.message); return; }
    setForm({ bank_name: "", account_name: "", account_number: "", note: "" });
    qc.invalidateQueries({ queryKey: ["payment-account"] });
    toast.success("Account deleted");
  };

  if (isLoading) return <div className="glass rounded-xl h-40 animate-pulse" />;

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-4 max-w-xl">
      <p className="text-sm text-muted-foreground">Only one recipient account can be set. Members see these details when paying.</p>
      <div className="space-y-1.5"><Label>Bank name</Label>
        <Input className="glass" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Account name</Label>
        <Input className="glass" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Account number</Label>
        <Input className="glass" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Note (optional)</Label>
        <Input className="glass" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="gradient-bg text-primary-foreground hover:opacity-90">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{account ? "Save changes" : "Add account"}
        </Button>
        {account && <Button variant="outline" onClick={remove}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
      </div>
    </div>
  );
}

function PayToPay({ field }: { field: "reg_amount" | "monthly_amount" }) {
  const { data: positions = [], isLoading } = usePositions();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    positions.forEach((p) => { next[p.id] = String(p[field] ?? 0); });
    setValues(next);
  }, [positions, field]);

  const saveOne = async (id: string) => {
    const amount = Number(values[id] ?? 0);
    if (Number.isNaN(amount)) { toast.error("Enter a valid amount"); return; }
    const { error } = await supabase.from("positions").update({ [field]: amount, updated_at: new Date().toISOString() } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["positions"] });
    toast.success("Amount saved");
  };

  if (isLoading) return <div className="glass rounded-xl h-40 animate-pulse" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Set the amount a user with each position has to pay.</p>
      {positions.map((p) => (
        <div key={p.id} className="glass rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
          </div>
          <Input className="glass w-36" inputMode="decimal" value={values[p.id] ?? ""}
            onChange={(e) => setValues({ ...values, [p.id]: e.target.value })} />
          <Button size="sm" onClick={() => saveOne(p.id)} className="gradient-bg text-primary-foreground hover:opacity-90">Save</Button>
        </div>
      ))}
      {positions.length === 0 && <p className="text-sm text-muted-foreground">Add positions in the Ranking tab first.</p>}
    </div>
  );
}

export function PaymentPlan({ field }: { field: "reg_amount" | "monthly_amount" }) {
  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList>
        <TabsTrigger value="account">Account details</TabsTrigger>
        <TabsTrigger value="pay">Pay to pay</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="mt-4"><AccountDetails /></TabsContent>
      <TabsContent value="pay" className="mt-4"><PayToPay field={field} /></TabsContent>
    </Tabs>
  );
}
