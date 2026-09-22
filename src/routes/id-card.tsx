import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { usePositions } from "@/lib/membership";
import { usePolicyText } from "@/lib/org-policy";
import { useStorageUrl } from "@/lib/storage-url";
import { qrDataUrl, qrUrlFor, signatureInkDataUrl, toDataUrl, downloadFormPdf, downloadIdCardPdf } from "@/lib/member-card";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { PolicyView } from "@/components/PolicyView";
import { MembershipPrintSheet } from "@/components/MembershipPrintSheet";
import { MemberIdCard } from "@/components/MemberIdCard";
import formTemplate from "@/assets/personal-information-form.pdf.asset.json";

export const Route = createFileRoute("/id-card")({
  component: () => <RequireAuth><IdCardPage /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "ID card & form — Ecomedic Squad" },
      { name: "description", content: "Download your Ecomedic Squad membership form and member ID card, each with your personal verification QR code." },
      { property: "og:title", content: "ID card & form — Ecomedic Squad" },
      { property: "og:description", content: "Download your membership form and member ID card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function IdCardPage() {
  const { user, profile } = useAuth();
  const { data: positions = [] } = usePositions();
  const { data: formPolicy } = usePolicyText("form");
  const { data: idPolicy } = usePolicyText("id_card");
  const [search, setSearch] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState<"form" | "card" | null>(null);
  const [stage, setStage] = useState<"policy" | "review">("policy");
  const [accepted, setAccepted] = useState(false);
  const verified = Boolean(profile?.registered_at && profile?.member_no);
  const avatarUrl = useStorageUrl("avatars", profile?.avatar_url ?? null);

  const memberNo = profile?.member_no ?? null;
  const positionName = positions.find((p) => p.id === profile?.position_id)?.name ?? "Member";
  const fullName = profile?.id_full_name || [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(" ");
  const issued = profile?.registered_at
    ? new Date(profile.registered_at).toLocaleDateString("en-GB")
    : "—";

  useEffect(() => { qrDataUrl(memberNo).then(setQr).catch(() => setQr(null)); }, [memberNo]);
  useEffect(() => {
    signatureInkDataUrl(profile?.signature_data).then(setSignature).catch(() => setSignature(profile?.signature_data ?? null));
  }, [profile?.signature_data]);

  const base = { profile: (profile ?? null) as Record<string, any> | null, email: user?.email ?? "", positionName, memberNo };

  const onForm = async () => {
    if (!qr) return;
    setBusy("form");
    try { await downloadFormPdf({ ...base, qr, policy: formPolicy ?? "" }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const onCard = async () => {
    if (!qr) return;
    setBusy("card");
    try {
      const avatar = await toDataUrl(avatarUrl);
      await downloadIdCardPdf({ ...base, qr, avatar, policy: idPolicy ?? "" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold gradient-text">ID card & form</h1>
        {!memberNo && <p className="text-sm text-muted-foreground">Your ID number appears once your registration payment has been verified.</p>}

        <Tabs defaultValue="card">
          <TabsList>
            <TabsTrigger value="card">ID card</TabsTrigger>
            <TabsTrigger value="form">Form</TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="mt-4 space-y-4">
            <div className="glass-strong rounded-2xl p-5">
              <div className="member-id-card-stack">
                <MemberIdCard
                  side="front"
                  fullName={fullName || profile?.username || ""}
                  positionName={positionName}
                  bloodGroup={profile?.blood_group || ""}
                  phone={profile?.id_phone || profile?.phone || ""}
                  memberNo={memberNo || ""}
                  avatarUrl={avatarUrl}
                  qr={qr}
                  signature={signature}
                />
                <MemberIdCard
                  side="back"
                  fullName={fullName || profile?.username || ""}
                  positionName={positionName}
                  bloodGroup={profile?.blood_group || ""}
                  phone={profile?.id_phone || profile?.phone || ""}
                  memberNo={memberNo || ""}
                  policy={idPolicy ?? ""}
                  issued={issued}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 break-all">Scanning the code opens {qrUrlFor(memberNo)}</p>
              <Button onClick={onCard} disabled={!qr || busy !== null} className="mt-4 gradient-bg text-primary-foreground hover:opacity-90">
                {busy === "card" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download ID card
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="form" className="mt-4 space-y-4">
            <div className="glass-strong rounded-2xl p-5 space-y-4">
              <div>
                <div className="text-lg font-bold">Ecomedic Squad — Official member registration form</div>
                <div className="text-sm text-muted-foreground">Form no: {memberNo ?? "—"}</div>
              </div>

              {!verified && (
                <>
                  <iframe className="member-form-preview" src={`${formTemplate.url}#toolbar=0&navpanes=0`} title="Official member registration form" />
                  <Button onClick={onForm} disabled={!qr || busy !== null} className="gradient-bg text-primary-foreground hover:opacity-90">
                    {busy === "form" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download form
                  </Button>
                </>
              )}

              {verified && stage === "policy" && (
                <>
                  <PolicyView />
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
                    I have read and accept the organization policy
                  </label>
                  <Button disabled={!accepted} onClick={() => setStage("review")} className="gradient-bg text-primary-foreground hover:opacity-90">Next</Button>
                </>
              )}

              {verified && stage === "review" && (
                <>
                  <p className="text-sm text-muted-foreground">Check your details below, then print or download your completed form.</p>
                  <div className="rounded-2xl overflow-hidden border border-border">
                    <MembershipPrintSheet profile={profile as any} email={user?.email ?? ""} positionName={positionName} memberNo={memberNo} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
                    <Button onClick={onForm} disabled={!qr || busy !== null} className="gradient-bg text-primary-foreground hover:opacity-90">
                      {busy === "form" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download form
                    </Button>
                    <Button variant="ghost" onClick={() => { setAccepted(false); setStage("policy"); }}>Back to policy</Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
