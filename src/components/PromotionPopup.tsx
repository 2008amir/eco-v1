import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function PromotionPopup() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(Boolean(profile?.position_pending)); }, [profile?.position_pending]);

  if (!profile?.position_pending) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>You have been promoted</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Open your profile to verify and activate your new position.
        </p>
        <Button onClick={() => { setOpen(false); navigate({ to: "/profile" }); }} className="gradient-bg text-primary-foreground hover:opacity-90">
          Go to my profile
        </Button>
      </DialogContent>
    </Dialog>
  );
}
