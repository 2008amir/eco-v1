import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { formatAmount, usePaymentAccount } from "@/lib/membership";

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
  const [showAccount, setShowAccount] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    let receiptPath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/receipt-${Date.now()}.${ext}`;
      const { error } = await uploadWithSupabaseRetry("receipts", path, file, { contentType: file.type, upsert: true }, 4);
      if (error) { toast.error(error.message); setBusy(false); return; }
      receiptPath = path;
    }
    const { error } = await supabase.from("payments").insert({
      user_id: userId, kind, position_id: positionId ?? null, amount,
      receipt_url: receiptPath, period: period ?? null, status: "pending",
    } as never);
    if (error) { toast.error(error.message); setBusy(false); return; }
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

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md glass cursor-pointer hover:bg-muted/50 text-sm">
            <Upload className="h-4 w-4" />
            {file ? file.name : "Upload payment receipt"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          <Button onClick={submit} disabled={busy} className="w-full gradient-bg text-primary-foreground hover:opacity-90">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}I have made the payment
          </Button>
        </div>
      )}
    </div>
  );
}
