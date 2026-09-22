import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/policy")({
  component: PolicyAdmin,
  head: () => ({ meta: [{ title: "Policy — Ecomedic Squad Admin" }] }),
});

function PolicyEditor({ policyKey, label }: { policyKey: "form" | "id_card"; label: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["org-policy-raw", policyKey],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_policies").select("content").eq("key", policyKey).maybeSingle();
      if (error) throw error;
      return ((data as { content?: string } | null)?.content ?? "") as string;
    },
  });

  useEffect(() => { if (data !== undefined) setText(data ?? ""); }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("org_policies").upsert({ key: policyKey, content: text } as never, { onConflict: "key" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["org-policy-raw", policyKey] });
    qc.invalidateQueries({ queryKey: ["org-policy", policyKey] });
    toast.success("Policy saved");
  };

  if (isLoading) return <div className="glass rounded-xl h-64 animate-pulse" />;

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Textarea className="glass min-h-[380px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Write the policy here. Leave a blank line between paragraphs." />
      <Button onClick={save} disabled={saving} className="gradient-bg text-primary-foreground hover:opacity-90">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save policy
      </Button>
    </div>
  );
}

function PolicyAdmin() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold gradient-text">Organization policy</h1>
      <Tabs defaultValue="id_card">
        <TabsList>
          <TabsTrigger value="id_card">ID card</TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
        </TabsList>
        <TabsContent value="id_card" className="mt-4">
          <PolicyEditor policyKey="id_card" label="This text is printed with the member ID card." />
        </TabsContent>
        <TabsContent value="form" className="mt-4">
          <PolicyEditor policyKey="form" label="This text is printed with the membership form and shown during sign-up." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
