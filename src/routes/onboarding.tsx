import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Printer, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseRetry } from "@/lib/supabase-retry";
import { MemberForm, EMPTY_MEMBER_FORM, buildProfilePayload, type FormState } from "@/components/MemberForm";
import { PolicyView } from "@/components/PolicyView";
import { PaymentStep } from "@/components/PaymentStep";
import { MembershipPrintSheet } from "@/components/MembershipPrintSheet";
import { usePositions } from "@/lib/membership";

export const Route = createFileRoute("/onboarding")({
  component: () => <RequireAuth skipOnboarding><Onboarding /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Complete your registration — Ecomedic Squad" },
      { name: "description", content: "Fill the membership form, accept the organization policy and complete your registration payment to join Ecomedic Squad." },
      { property: "og:title", content: "Complete your registration — Ecomedic Squad" },
      { property: "og:description", content: "Membership form, policy and registration payment for Ecomedic Squad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { data: positions = [] } = usePositions();
  const [form, setForm] = useState<FormState>(EMPTY_MEMBER_FORM);
  const [signature, setSignature] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const step = (profile as any)?.onboarding_step ?? 0;
  const memberPosition = positions.find((p) => p.is_member);

  const { data: latestPayment } = useQuery({
    queryKey: ["my-registration-payment", user?.id, step],
    enabled: !!user && step === 3,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("user_id", user!.id)
        .eq("kind", "registration").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (latestPayment && latestPayment.status !== "pending") void refreshProfile();
  }, [latestPayment]);

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

  useEffect(() => { setAccepted(false); }, [step]);

  useEffect(() => {
    if (profile && step >= 6) navigate({ to: "/" });
  }, [step, profile, navigate]);

  const setStep = async (n: number, extra: Record<string, unknown> = {}) => {
    if (!user) return;
    setBusy(true);
    const { error } = await withSupabaseRetry(() =>
      supabase.from("profiles").update({ onboarding_step: n, updated_at: new Date().toISOString(), ...extra } as never).eq("id", user.id),
      4, { kind: "table", target: "profiles", action: "save progress" });
    if (error) { toast.error(error.message); setBusy(false); return; }
    await refreshProfile();
    setBusy(false);
  };

  const saveForm = async () => {
    if (!user) return;
    if (!form.first_name || !form.last_name || !form.phone) { toast.error("First name, last name and phone number are required"); return; }
    setBusy(true);
    const { error } = await withSupabaseRetry(() =>
      supabase.from("profiles").update({ ...buildProfilePayload(form, signature), onboarding_step: 1 } as never).eq("id", user.id),
      4, { kind: "table", target: "profiles", action: "save membership form" });
    if (error) { toast.error(error.message); setBusy(false); return; }
    await refreshProfile();
    setBusy(false);
  };

  if (!user) return null;

  const positionName = positions.find((p) => p.id === (profile as any)?.position_id)?.name ?? "Member";
  const memberNo = (profile as any)?.member_no ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 max-w-3xl no-print space-y-5">
        {step === 0 && (
          <>
            <div className="glass-strong rounded-2xl p-5">
              <h1 className="text-2xl font-bold gradient-text">Complete your registration</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Please fill the following form so the organization can verify you. Use your real details — they appear on your membership form and ID card.
              </p>
            </div>
            <MemberForm form={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
              signature={signature} onSignatureChange={setSignature} email={user.email ?? ""}
              positionName={positionName} memberNo={memberNo} />
            <Button onClick={saveForm} disabled={busy} className="w-full gradient-bg text-primary-foreground hover:opacity-90 glow">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save and continue
            </Button>
          </>
        )}

        {(step === 1 || step === 4) && (
          <>
            <h1 className="text-2xl font-bold gradient-text">Organization policy</h1>
            <PolicyView />
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
              I have read and accept the organization policy
            </label>
            <Button disabled={!accepted || busy} onClick={() => setStep(step === 1 ? 2 : 5, { policy_accepted_at: new Date().toISOString() })}
              className="w-full gradient-bg text-primary-foreground hover:opacity-90">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Next
            </Button>
          </>
        )}

        {step === 2 && (
          <PaymentStep
            userId={user.id}
            kind="registration"
            positionId={memberPosition?.id ?? null}
            amount={Number(memberPosition?.reg_amount ?? 0)}
            intro="Pay the registration fee for the Member position, upload your receipt, then submit it for verification."
            onSubmitted={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <div className="glass-strong rounded-2xl p-8 text-center space-y-3">
            <Clock className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">Your payment is under review</h1>
            <p className="text-sm text-muted-foreground">After it is verified you will be redirected to the dashboard.</p>
            <Button variant="outline" onClick={() => refreshProfile()}>Check again</Button>
          </div>
        )}

        {step === 5 && (
          <>
            <div className="glass-strong rounded-2xl p-5">
              <h1 className="text-2xl font-bold gradient-text">Verify your form</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Check your details below, then print or save them as a PDF. The organization policy is included on a separate page.
              </p>
              <p className="text-sm mt-2">Form no: <strong>{memberNo ?? "—"}</strong></p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border">
              <MembershipPrintSheet profile={profile as any} email={user.email ?? ""} positionName={positionName} memberNo={memberNo} />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => window.print()} variant="outline" className="flex-1"><Printer className="mr-2 h-4 w-4" />Print</Button>
              <Button onClick={() => setStep(6)} disabled={busy} className="flex-1 gradient-bg text-primary-foreground hover:opacity-90">Go to dashboard</Button>
            </div>
          </>
        )}
      </main>

      {step === 5 && (
        <div className="print-only">
          <MembershipPrintSheet profile={profile as any} email={user.email ?? ""} positionName={positionName} memberNo={memberNo} />
        </div>
      )}
    </div>
  );
}
