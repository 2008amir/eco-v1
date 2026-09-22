import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Logo } from "@/components/Logo";
import { PasswordInput, isStrongPassword } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const signInSchema = z.object({
  identifier: z.string().min(1, "Required").max(255),
  password: z.string().min(1, "Required"),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Required").max(120),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().refine(isStrongPassword, "Password must be 8+ characters with uppercase, lowercase, number and symbol"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export function AuthScreen() {
  const { user, isAdmin, rolesLoaded, rolesError, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState("signin");
  const [authPending, setAuthPending] = useState(false);

  useEffect(() => {
    // Wait for auth + roles to fully load before redirecting,
    // otherwise admins can briefly look like regular users and get sent to /dashboard.
    if (loading || !user || !rolesLoaded || rolesError) return;
    navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  }, [user, isAdmin, rolesLoaded, rolesError, loading, navigate]);

  if (authPending || (user && (loading || !rolesLoaded))) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-6 max-w-sm text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <h1 className="mt-4 text-lg font-semibold">Loading Dashboard........</h1>
        </div>
      </div>
    );
  }

  if (user && rolesError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-6 max-w-sm text-center">
          <h1 className="text-lg font-semibold">Account check failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{rolesError}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button onClick={refreshProfile} className="gradient-bg text-primary-foreground hover:opacity-90">Retry</Button>
            <Button onClick={signOut} variant="outline">Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto px-4 py-6">
        <Logo />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md glass-strong rounded-2xl p-6 md:p-8">
          <div className="w-full">
            <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  authMode === "signin" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  authMode === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create account
              </button>
            </div>
            <div className="mt-6">
              <div style={{ display: authMode === "signin" ? "block" : "none" }}>
                <SignInForm onPendingChange={setAuthPending} />
              </div>
              <div style={{ display: authMode === "signup" ? "block" : "none" }}>
                <SignUpForm onPendingChange={setAuthPending} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SignInForm({ onPendingChange }: { onPendingChange: (v: boolean) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = signInSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ identifier: flat.identifier?.[0] ?? "", password: flat.password?.[0] ?? "" });
      return;
    }
    setSubmitting(true);
    try {
      let emailToUse = identifier.trim();
      if (!emailToUse.includes("@")) {
        const { data: resolvedEmail, error: rpcErr } = await supabase
          .rpc("get_email_for_username", { _username: emailToUse });
        if (rpcErr) {
          toast.error("Could not look up username. Try again.");
          setSubmitting(false);
          return;
        }
        if (!resolvedEmail) {
          toast.error("Username not found");
          setSubmitting(false);
          return;
        }
        emailToUse = resolvedEmail as string;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      toast.success("Welcome back!");
      onPendingChange(true);
      // Keep submitting=true; redirect happens once auth + roles load.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or Username</Label>
        <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com" autoComplete="username" className="glass" />
        {errors.identifier && <p className="text-xs text-destructive">{errors.identifier}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" className="glass" />
        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
      </div>
      <Button type="submit" disabled={submitting} className="w-full gradient-bg text-primary-foreground hover:opacity-90 glow">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm({ onPendingChange: _onPendingChange }: { onPendingChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const errs: Record<string, string> = {};
      for (const k in flat) errs[k] = flat[k as keyof typeof flat]?.[0] ?? "";
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const name = form.fullName.trim().replace(/\s+/g, " ");
      const [firstName, ...rest] = name.split(" ");
      const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: rest.join(" "),
            full_name: name,
          },
        },
      });
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      toast.success("Account created! Check your email to verify your account.");
      setSubmitting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={form.fullName} onChange={set("fullName")} className="glass" autoComplete="name" />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={form.email} onChange={set("email")} className="glass" autoComplete="email" />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" value={form.password} onChange={set("password")} className="glass" autoComplete="new-password" />
        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput id="confirmPassword" value={form.confirmPassword} onChange={set("confirmPassword")} className="glass" autoComplete="new-password" />
        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
      </div>
      <Button type="submit" disabled={submitting} className="w-full gradient-bg text-primary-foreground hover:opacity-90 glow">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
