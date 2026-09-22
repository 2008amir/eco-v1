import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PaymentStep } from "@/components/PaymentStep";
import { usePositions } from "@/lib/membership";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function PositionActivation() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: positions = [] } = usePositions();
  const [stage, setStage] = useState<"idle" | "describe" | "pay" | "sent">("idle");

  if (!user || !profile?.position_pending) return null;
  const position = positions.find((p) => p.id === profile.pending_position_id);

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-3">
      <h2 className="text-lg font-semibold gradient-text">You have been promoted</h2>
      {stage === "idle" && (
        <>
          <p className="text-sm text-muted-foreground">Activate your new position{position ? `: ${position.name}` : ""}.</p>
          <Button onClick={() => setStage("describe")} className="gradient-bg text-primary-foreground hover:opacity-90">Activate your position</Button>
        </>
      )}
      {stage === "describe" && (
        <>
          <h3 className="font-semibold">{position?.name ?? "New position"}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{position?.description || "No description provided."}</p>
          <Button onClick={() => setStage("pay")} className="gradient-bg text-primary-foreground hover:opacity-90">Accept</Button>
        </>
      )}
      {stage === "pay" && (
        <PaymentStep
          userId={user.id}
          kind="position"
          positionId={position?.id ?? null}
          amount={Number(position?.reg_amount ?? 0)}
          title={`Payment for the ${position?.name ?? "new"} position`}
          intro="Pay the amount set for this position and upload your receipt for verification."
          onSubmitted={async () => {
            await refreshProfile();
            setStage("sent");
            toast.success("Payment submitted for verification");
          }}
        />
      )}
      {stage === "sent" && (
        <p className="text-sm text-muted-foreground">Your payment is under review. Your position is activated once it is verified.</p>
      )}
    </div>
  );
}
