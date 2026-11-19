import { useEffect, useRef, useState, type ChangeEvent } from "react";

// Survives the step being redrawn (e.g. when the phone returns from the file picker).
const pickedFiles = new Map<string, File>();
import { Button } from "@/components/ui/button";
import { Camera, Check, FileText, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { formatAmount, usePaymentAccount } from "@/lib/membership";
import { hasPaymentProof } from "@/lib/payment-validation";

type Props = {
  userId: string;
  amount: number;
  kind: "registration" | "monthly" | "position";
  positionId?: string | null;
  period?: string | null;
  title?: string;
  intro?: string;
  onSubmitted: () => Promise<void> | void;
};

export function PaymentStep({ userId, amount, kind, positionId, period, title, intro, onSubmitted }: Props) {
  const { data: account } = usePaymentAccount();
  const storeKey = `payment-open:${userId}:${kind}:${period ?? ""}`;
  const [showAccount, setShowAccountState] = useState(false);
  const [file, setFileState] = useState<File | null>(() => pickedFiles.get(storeKey) ?? null);
  useEffect(() => {
    try { if (sessionStorage.getItem(storeKey) === "1") setShowAccountState(true); } catch { /* ignore */ }
  }, [storeKey]);
  const setShowAccount = (v: boolean) => {
    setShowAccountState(v);
    try { v ? sessionStorage.setItem(storeKey, "1") : sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
  };
  const setFile = (f: File | null) => {
    if (f) pickedFiles.set(storeKey, f); else pickedFiles.delete(storeKey);
    setFileState(f);
  };
  const [receiptError, setReceiptError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pathKey = `${storeKey}:receipt`;
  const [uploaded, setUploaded] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setChooserOpen(false);
    if (f) void uploadPicked(f);
  };
  useEffect(() => {
    try { const v = sessionStorage.getItem(pathKey); if (v) setUploaded(JSON.parse(v)); } catch { /* ignore */ }
  }, [pathKey]);

  // Upload as soon as the file is picked, so a page refresh afterwards loses nothing.
  const uploadPicked = async (f: File) => {
    setFile(f);
    setReceiptError(false);
    setUploading(true);
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${userId}/receipt-${Date.now()}.${ext}`;
    const { error } = await uploadWithSupabaseRetry("receipts", path, f, { contentType: f.type || undefined, upsert: true }, 4);
    setUploading(false);
    if (error) { toast.error(`Receipt upload failed: ${error.message}`); return; }
    const info = { path, name: f.name };
    setUploaded(info);
    try { sessionStorage.setItem(pathKey, JSON.stringify(info)); sessionStorage.setItem(storeKey, "1"); } catch { /* ignore */ }
    toast.success("Receipt uploaded");
  };

  const submit = async () => {
    if (uploading) return;
    let receiptPath = uploaded?.path ?? null;
    if (!receiptPath && hasPaymentProof(file)) {
      await uploadPicked(file);
      try { receiptPath = JSON.parse(sessionStorage.getItem(pathKey) ?? "null")?.path ?? null; } catch { receiptPath = null; }
    }
    if (!receiptPath) { setReceiptError(true); return; }
    setBusy(true);
    const { error: paymentError } = await supabase.from("payments").insert({
      user_id: userId, kind, position_id: positionId ?? null, amount,
      receipt_url: receiptPath, period: period ?? null, status: "pending",
    } as never);
    if (paymentError) { toast.error(paymentError.message); setBusy(false); return; }
    pickedFiles.delete(storeKey);
    try { sessionStorage.removeItem(storeKey); sessionStorage.removeItem(pathKey); } catch { /* ignore */ }
    await onSubmitted();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">{title ?? "Make the payment to be an eligible member of Ecomedic Squad"}</h2>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
        <div className="text-3xl font-bold gradient-text">{formatAmount(amount)}</div>
        {!showAccount && (
          <Button onClick={() => setShowAccount(true)} className="gradient-bg text-primary-foreground hover:opacity-90">Make payment</Button>
        )}
      </div>

      {showAccount && (
        <div className="glass-strong rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">Account details</h3>
          {account ? (
            <div className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">Bank: </span>{account.bank_name}</div>
              <div><span className="text-muted-foreground">Account name: </span>{account.account_name}</div>
              <div><span className="text-muted-foreground">Account number: </span><strong>{account.account_number}</strong></div>
              <div><span className="text-muted-foreground">Amount: </span><strong>{formatAmount(amount)}</strong></div>
              {account.note && <p className="text-muted-foreground">{account.note}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">The organization has not added a payment account yet. Please check back shortly.</p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => setChooserOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md glass hover:bg-muted/50 text-sm disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : uploaded ? <Check className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : uploaded ? `${uploaded.name} — uploaded (tap to change)` : "Upload payment receipt"}
            </button>
            {chooserOpen && !uploading && (
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-1 rounded-md glass px-2 py-3 text-xs hover:bg-muted/50">
                  <Camera className="h-5 w-5" />Camera
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-1 rounded-md glass px-2 py-3 text-xs hover:bg-muted/50">
                  <ImageIcon className="h-5 w-5" />Photos
                </button>
                <button type="button" onClick={() => filesRef.current?.click()} className="flex flex-col items-center gap-1 rounded-md glass px-2 py-3 text-xs hover:bg-muted/50">
                  <FileText className="h-5 w-5" />Files
                </button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={onPicked} />
            <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={onPicked} />
            <input ref={filesRef} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={onPicked} />
          </div>
          {receiptError && <p role="alert" className="text-sm font-medium text-destructive">Upload a payment proof before you continue.</p>}

          <Button onClick={submit} disabled={busy || uploading} className="w-full gradient-bg text-primary-foreground hover:opacity-90">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}I have made the payment
          </Button>
        </div>
      )}
    </div>
  );
}
