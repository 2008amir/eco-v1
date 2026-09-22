import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { toast } from "sonner";

export function CreateProjectDialog({
  communityId,
  open,
  onOpenChange,
}: {
  communityId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Project name is required"); return; }
    setSaving(true);
    let image_url: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await uploadWithSupabaseRetry("community-images", path, file, { contentType: file.type, upsert: true }, 5);
      if (up.error) { toast.error(up.error.message); setSaving(false); return; }
      image_url = path;
    }
    const { error } = await supabase.from("community_projects").insert({
      community_id: communityId,
      name: name.trim(),
      description: description.trim(),
      image_url,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    setName(""); setDescription(""); setFile(null);
    qc.invalidateQueries({ queryKey: ["community-projects", communityId] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Add a new project for this community.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} className="glass mt-1" placeholder="e.g. Community health outreach" />
          </div>
          <div>
            <Label htmlFor="project-desc">Description</Label>
            <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="glass mt-1" rows={4} placeholder="What is this project about?" />
          </div>
          <div>
            <Label>Project image</Label>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="mt-1 w-full" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-2" /> {file ? file.name : "Upload image"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gradient-bg text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
