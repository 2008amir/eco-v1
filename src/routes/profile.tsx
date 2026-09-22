import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithSupabaseRetry, withSupabaseRetry } from "@/lib/supabase-retry";
import { useStorageUrl } from "@/lib/storage-url";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { MemberForm, EMPTY_MEMBER_FORM, buildProfilePayload, Section, Field, type FormState } from "@/components/MemberForm";
import { PositionActivation } from "@/components/PositionActivation";
import { usePositions } from "@/lib/membership";

export const Route = createFileRoute("/profile")({
  component: () => <RequireAuth><ProfilePage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Your Profile — Ecomedic Squad" },
      { name: "description", content: "Manage your Ecomedic Squad member profile: personal details, address, education, guardian and emergency contacts, and ID card information." },
      { property: "og:title", content: "Your Profile — Ecomedic Squad" },
      { property: "og:description", content: "Manage your Ecomedic Squad member profile and ID card details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: positions = [] } = usePositions();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_MEMBER_FORM);
  const [signature, setSignature] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const avatarUrl = useStorageUrl("avatars", form.avatar_url);

  useEffect(() => {
    if (!profile) return;
    const next: FormState = { ...EMPTY_MEMBER_FORM };
    Object.keys(EMPTY_MEMBER_FORM).forEach((k) => {
      const val = (profile as unknown as Record<string, unknown>)[k];
      next[k] = val === null || val === undefined ? "" : String(val);
    });
    next.is_graduate = profile.is_graduate === true ? "yes" : profile.is_graduate === false ? "no" : "";
    setForm(next);
    setSignature(profile.signature_data ?? null);
  }, [profile]);

  const onAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await uploadWithSupabaseRetry("avatars", path, file, { contentType: file.type, upsert: true }, 6);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    setForm((f) => ({ ...f, avatar_url: path }));
    await withSupabaseRetry(() =>
      supabase.from("profiles").update({ avatar_url: path, updated_at: new Date().toISOString() }).eq("id", user.id),
      4,
      { kind: "table", target: "profiles", action: "save avatar" },
    );
    await refreshProfile();
    setUploading(false);
    toast.success("Avatar updated");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...buildProfilePayload(form, signature), avatar_url: form.avatar_url };
      const { error } = await withSupabaseRetry(() =>
        supabase.from("profiles").update(payload).eq("id", user.id),
        6,
        { kind: "table", target: "profiles", action: "update profile" },
      );
      if (error) { toast.error(error.message); setSaving(false); return; }

      if (password.trim().length >= 6) {
        const { error: pErr } = await supabase.auth.updateUser({ password });
        if (pErr) { toast.error(pErr.message); setSaving(false); return; }
        setPassword("");
      }
      await refreshProfile();
      toast.success("Profile updated");
    } finally {
      setSaving(false);
    }
  };

  const initials = ((form.first_name?.[0] ?? "") + (form.last_name?.[0] ?? "")).toUpperCase() || "U";
  const positionName = positions.find((p) => p.id === profile?.position_id)?.name ?? "Member";

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6 gradient-text">Your Profile</h1>

        <div className="mb-5"><PositionActivation /></div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="glass-strong rounded-2xl p-6 flex flex-col items-center text-center gap-3">
            <Avatar className="h-28 w-28 ring-2 ring-border">
              <AvatarImage src={avatarUrl ?? undefined} alt="Your avatar" />
              <AvatarFallback className="gradient-bg text-primary-foreground text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md glass cursor-pointer hover:bg-muted/50 text-sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Change avatar
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} disabled={uploading} />
            </label>
            <p className="text-xs text-muted-foreground">Visible to everyone.</p>
          </div>

          <MemberForm
            form={form}
            onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
            signature={signature}
            onSignatureChange={setSignature}
            email={user?.email ?? ""}
            positionName={positionName}
            memberNo={profile?.member_no ?? null}
          />

          <Section index={7} title="Security">
            <Field label="New password (optional)" full>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className="glass" placeholder="Leave blank to keep current" showStrength={false} />
            </Field>
          </Section>

          <Button type="submit" disabled={saving} className="w-full gradient-bg text-primary-foreground hover:opacity-90 glow">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update
          </Button>
        </form>
      </main>
    </div>
  );
}
