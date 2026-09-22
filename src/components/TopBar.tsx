import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Search, User, LogOut, Sun, Moon, Monitor, Check, Camera, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithSupabaseRetry, withSupabaseRetry } from "@/lib/supabase-retry";
import { useStorageUrl } from "@/lib/storage-url";
import { SiteMenu } from "@/components/SiteMenu";
import { toast } from "sonner";


type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  homeTo: string;
  profileTo: string;
};

export function TopBar({ search, onSearchChange, profileTo }: Props) {
  const { profile, user, signOut, isAdmin, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const avatarUrl = useStorageUrl("avatars", profile?.avatar_url);
  const initials = ((profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "")).toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "U");

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Device default", icon: Monitor },
  ];

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const up = await uploadWithSupabaseRetry("avatars", path, file, { contentType: file.type, upsert: true }, 6);
    if (up.error) { toast.error(up.error.message); setUploading(false); return; }
    const { error } = await withSupabaseRetry(
      () => supabase.from("profiles").update({ avatar_url: path, updated_at: new Date().toISOString() }).eq("id", user.id),
      4,
      { kind: "table", target: "profiles", action: "save avatar" },
    );
    if (error) { toast.error(error.message); setUploading(false); return; }
    await refreshProfile();
    setUploading(false);
    toast.success("Profile picture updated");
  };

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <header className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="container mx-auto px-4 py-3 flex flex-col gap-3">
          {/* Row 1: logo + profile */}
          <div className="flex items-center justify-between">
            <Logo onClick={() => setSidebarOpen(true)} />
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickAvatar} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-2 ring-border hover:ring-primary transition relative" aria-label="Open profile menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl ?? undefined} alt="Your avatar" />
                    <AvatarFallback className="gradient-bg text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <span className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold">{profile?.first_name} {profile?.last_name}</div>
                  <div className="text-xs text-muted-foreground font-normal">@{profile?.username}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={uploading}
                  onSelect={(e) => { e.preventDefault(); fileInput.current?.click(); }}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  {uploading ? "Uploading…" : "Change profile picture"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: profileTo as never })}>
                  <User className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" as never })}>Admin Panel</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Appearance</DropdownMenuLabel>
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuItem key={value} onSelect={(e) => { e.preventDefault(); setTheme(value); }}>
                    <Icon className="mr-2 h-4 w-4" /> {label}
                    {theme === value && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Row 2: search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="AI search across research..."
              className="pl-9 glass"
            />
          </div>
        </div>
      </header>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Site menu</SheetTitle>
        </SheetHeader>
        <div className="flex items-center justify-between p-4 border-b border-border lg:hidden">
          <span className="font-semibold gradient-text">Ecomedic Squad</span>
        </div>
        <SiteMenu onNavigate={() => setSidebarOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
