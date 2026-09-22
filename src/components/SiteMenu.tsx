import { Link } from "@tanstack/react-router";
import { Users, FlaskConical, Radio, Newspaper, FolderKanban, Crown, LayoutDashboard, Wallet, IdCard } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/communities", label: "Community", icon: Users },
  { to: "/dashboard", label: "Research", icon: FlaskConical },
  { to: "/broadcast", label: "Broadcast", icon: Radio },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/project", label: "Project", icon: FolderKanban },
  { to: "/chat", label: "CEO Chat", icon: Crown },
  { to: "/monthly-payment", label: "Monthly payment", icon: Wallet },
  { to: "/id-card", label: "ID card and form", icon: IdCard },
] as const;

export function SiteMenu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="p-4 space-y-1" aria-label="Site menu">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 pb-2">Menu</p>
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={label}
          to={to as never}
          onClick={onNavigate}
          activeProps={{ className: "bg-primary/15 text-primary font-semibold" }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
