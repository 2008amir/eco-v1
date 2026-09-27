import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthScreen } from "@/components/AuthScreen";
import { AlertTriangle, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRegistrationComplete } from "@/lib/registration";

export function RequireAuth({ children, requireAdmin = false, skipOnboarding = false }: { children: ReactNode; requireAdmin?: boolean; skipOnboarding?: boolean }) {
  const { user, profile, isAdmin, rolesLoaded, rolesError, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const onboardingDone = isAdmin || isRegistrationComplete(profile);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (!skipOnboarding && profile?.account_status !== "suspended" && profile?.account_status !== "banned" && !profile?.is_revoked && !onboardingDone) {
      navigate({ to: "/onboarding" });
      return;
    }
    // Only enforce admin requirement once roles have actually loaded —
    // otherwise transient DB errors bounce admins to /dashboard.
    if (requireAdmin && rolesLoaded && !rolesError && !isAdmin) {
      navigate({ to: "/dashboard" as never });
    }
  }, [user, profile, isAdmin, rolesLoaded, rolesError, loading, requireAdmin, skipOnboarding, onboardingDone, navigate]);

  if (profile?.account_status === "suspended" || profile?.account_status === "banned" || profile?.is_revoked) {
    const suspended = profile.account_status === "suspended";
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-6 max-w-sm text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">{suspended ? "Your account was suspended" : "Your account was banned from this site"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{suspended ? "Your account is temporarily unavailable. Please contact the administration for more information." : "You can no longer access Ecomedic Squad. Please contact the administration if you believe this is a mistake."}</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && rolesLoaded && rolesError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-6 max-w-sm text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 text-lg font-semibold">Admin access check failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{rolesError}</p>
          <Button onClick={refreshProfile} className="mt-5 gradient-bg text-primary-foreground hover:opacity-90">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (user && rolesLoaded && rolesError) {
    return <div className="min-h-screen flex items-center justify-center px-4"><div className="glass-strong rounded-2xl p-6 max-w-sm text-center"><AlertTriangle className="mx-auto h-8 w-8 text-primary" /><p className="mt-4 text-sm">We could not check your registration status.</p><Button onClick={refreshProfile} className="mt-5"><RefreshCcw className="mr-2 h-4 w-4" />Retry</Button></div></div>;
  }

  if (!loading && !user) {
    return <AuthScreen />;
  }

  if (loading || !user || !rolesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-6 max-w-sm text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <h1 className="mt-4 text-lg font-semibold">Loading Dashboard........</h1>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) return null;

  if (!skipOnboarding && !onboardingDone) return null;

  return <>{children}</>;
}
