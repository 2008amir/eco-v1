import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { usePositions } from "@/lib/membership";

export const Route = createFileRoute("/admin/ranking")({ component: Ranking });

type Row = Record<string, any>;

function useRankedUsers(memberOnly: boolean) {
  return useQuery({
    queryKey: ["ranked-users", memberOnly],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, positions:positions!profiles_position_id_fkey(id, name, description, is_member)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Row[];
      return rows.filter((u) => {
        const isMemberPos = !u.positions || u.positions.is_member;
        return memberOnly ? isMemberPos : !isMemberPos;
      });
    },
  });
}

function UserDetail({ user, onClose }: { user: Row; onClose: () => void }) {
  const { data: positions = [] } = usePositions();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const promote = async () => {
    if (!target) { toast.error("Select a position"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_position", { _user_id: user.id, _position_id: target });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ranked-users"] });
    toast.success("Position updated");
    onClose();
  };

  const Item = ({ label, value }: { label: string; value: any }) => (
    <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-sm">{value || "—"}</div></div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{[user.first_name, user.last_name].filter(Boolean).join(" ") || `@${user.username}`}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Item label="Username" value={`@${user.username}`} />
          <Item label="Phone" value={user.phone} />
          <Item label="Position" value={user.positions?.name ?? "Member"} />
          <Item label="ID no" value={user.member_no} />
          <Item label="Country" value={user.country} />
          <Item label="Institution" value={user.institution} />
          <Item label="Blood group" value={user.blood_group} />
          <Item label="Registered" value={user.registered_at ? new Date(user.registered_at).toLocaleDateString() : "Not verified"} />
        </div>
        <div className="space-y-2 pt-3 border-t border-border">
          <Label>Promote to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="glass w-full"><SelectValue placeholder="Select position" /></SelectTrigger>
            <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={promote} disabled={busy} className="w-full gradient-bg text-primary-foreground hover:opacity-90">Promote</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserGrid({ memberOnly }: { memberOnly: boolean }) {
  const { data: rows = [], isLoading } = useRankedUsers(memberOnly);
  const [open, setOpen] = useState<Row | null>(null);
  if (isLoading) return <div className="glass rounded-xl h-24 animate-pulse" />;
  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((u) => (
          <button key={u.id} onClick={() => setOpen(u)} className="glass rounded-xl p-4 text-left hover:ring-1 hover:ring-primary transition">
            <div className="font-semibold">{[u.first_name, u.last_name].filter(Boolean).join(" ") || `@${u.username}`}</div>
            <div className="text-sm text-muted-foreground">{u.phone || "No phone"}</div>
            <div className="text-xs text-muted-foreground mt-1">{u.positions?.name ?? "Member"}</div>
          </button>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nobody here yet.</p>}
      </div>
      {open && <UserDetail user={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PositionsTab() {
  const { data: positions = [] } = usePositions();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!form.name.trim()) { toast.error("Enter a position name"); return; }
    setBusy(true);
    const { error } = await supabase.from("positions").insert({ name: form.name.trim(), description: form.description } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["positions"] });
    setForm({ name: "", description: "" });
    setOpen(false);
    toast.success("Position added");
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete the position "${name}"?`)) return;
    const { error } = await supabase.from("positions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["positions"] });
    toast.success("Position deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="gradient-bg text-primary-foreground hover:opacity-90"><Plus className="mr-2 h-4 w-4" />Add position</Button>
      </div>
      <div className="space-y-3">
        {positions.map((p) => (
          <div key={p.id} className="glass rounded-xl p-4 flex items-start gap-3">
            <div className="flex-1">
              <div className="font-semibold">{p.name}{p.is_member && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}</div>
              <div className="text-sm text-muted-foreground">{p.description || "No description"}</div>
            </div>
            {!p.is_member && <Button variant="outline" size="sm" onClick={() => remove(p.id, p.name)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add position</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Position name</Label><Input className="glass" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Describe its work</Label><Textarea className="glass" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button onClick={add} disabled={busy} className="w-full gradient-bg text-primary-foreground hover:opacity-90">Add position</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ranking() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gradient-text">Ranking</h1>
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="official">Official</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4"><UserGrid memberOnly /></TabsContent>
        <TabsContent value="official" className="mt-4"><UserGrid memberOnly={false} /></TabsContent>
        <TabsContent value="positions" className="mt-4"><PositionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
