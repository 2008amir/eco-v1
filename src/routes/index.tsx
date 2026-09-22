import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  FlaskConical,
  Users,
  FolderKanban,
  Bookmark,
  MessagesSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { PromotionPopup } from "@/components/PromotionPopup";
import { MonthlyDuesReminder } from "@/components/MonthlyDuesReminder";
import { TopBar } from "@/components/TopBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { withSupabaseRetry } from "@/lib/supabase-retry";
import heroImg from "@/assets/overview-hero.jpg";
import researchImg from "@/assets/overview-research.jpg";
import communityImg from "@/assets/overview-community.jpg";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <PromotionPopup />
      <MonthlyDuesReminder />
      <HomeDashboard />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Dashboard — Ecomedic Squad" },
      { name: "description", content: "Organisation-wide activity: research published, communities, projects and engagement across Ecomedic Squad." },
      { property: "og:title", content: "Dashboard — Ecomedic Squad" },
      { property: "og:description", content: "Organisation-wide activity: research published, communities, projects and engagement across Ecomedic Squad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

async function countOf(table: string, filters?: (q: any) => any) {
  const { count, error } = await withSupabaseRetry<{ count: number | null; error: unknown }>(
    () => {
      let q = supabase.from(table as never).select("*", { count: "exact", head: true });
      if (filters) q = filters(q);
      return q as any;
    },
    3,
    { kind: "table", target: table, action: "count" },
  );
  if (error) return 0;
  return count ?? 0;
}

function HomeDashboard() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  const { data: org, isLoading } = useQuery({
    queryKey: ["overview-org"],
    queryFn: async () => ({
      research: await countOf("research"),
      members: await countOf("profiles"),
      communities: await countOf("communities"),
      projects: await countOf("community_projects", (q) => q.eq("status", "active")),
    }),
  });

  const { data: mine } = useQuery({
    queryKey: ["overview-mine", user?.id],
    enabled: !!user,
    queryFn: async () => ({
      saved: await countOf("saved_research", (q) => q.eq("user_id", user!.id)),
      communities: await countOf("community_members", (q) => q.eq("user_id", user!.id)),
    }),
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["overview-recent-research"],
    queryFn: async () => {
      const { data } = await supabase
        .from("research")
        .select("id, title, category, created_at")
        .eq("post_kind" as any, "research")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const orgCards = [
    { label: "Research published", value: org?.research, icon: FlaskConical, to: "/dashboard" },
    { label: "Members", value: org?.members, icon: Users, to: "/communities" },
    { label: "Communities", value: org?.communities, icon: MessagesSquare, to: "/communities" },
    { label: "Active projects", value: org?.projects, icon: FolderKanban, to: "/project" },
  ] as const;

  const myCards = [
    { label: "Saved research", value: mine?.saved, icon: Bookmark },
    { label: "Your communities", value: mine?.communities, icon: Users },
  ] as const;

  return (
    <div className="min-h-screen">
      <TopBar search={search} onSearchChange={setSearch} homeTo="/" profileTo="/profile" />
      <main className="container mx-auto px-4 py-8 space-y-10">
        {/* Hero banner */}
        <section className="relative overflow-hidden rounded-3xl glass-strong">
          <img
            src={heroImg}
            alt="Ecomedic Squad — medical research network"
            width={1920}
            height={640}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
          <div className="relative p-8 md:p-12 max-w-xl">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Organisation dashboard
            </p>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold leading-tight">
              Everything happening across Ecomedic Squad
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Research, communities and projects — a live snapshot of the whole organisation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                Browse research <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/communities"
                className="inline-flex items-center gap-2 rounded-full glass px-5 py-2.5 text-sm font-semibold hover:glow transition"
              >
                Explore communities
              </Link>
            </div>
          </div>
        </section>

        {/* Organisation stats */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Organisation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
            {orgCards.map(({ label, value, icon: Icon, to }) => (
              <Link
                key={label}
                to={to as never}
                className="glass rounded-2xl p-5 hover:glow transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-3xl font-bold mt-4">
                  {isLoading ? <span className="inline-block h-7 w-12 rounded bg-muted/40 animate-pulse" /> : value ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Feature cards with images */}
        <section className="grid md:grid-cols-2 gap-4">
          <Link to="/dashboard" className="group relative overflow-hidden rounded-3xl glass-strong hover:glow transition-all">
            <img
              src={researchImg}
              alt="Researchers collaborating on studies"
              width={800}
              height={600}
              loading="lazy"
              className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="p-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Research library
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {org?.research ?? 0} papers published by the organisation — read, like and save them.
              </p>
            </div>
          </Link>
          <Link to="/communities" className="group relative overflow-hidden rounded-3xl glass-strong hover:glow transition-all">
            <img
              src={communityImg}
              alt="Connected communities network"
              width={800}
              height={600}
              loading="lazy"
              className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="p-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Communities
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {org?.communities ?? 0} communities and {org?.projects ?? 0} active projects to join and follow.
              </p>
            </div>
          </Link>
        </section>

        {/* Your activity */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your activity</h2>
          <div className="grid grid-cols-2 gap-4 mt-3">
            {myCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass rounded-2xl p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold mt-4">{value ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Latest research */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest research</h2>
            <Link to="/dashboard" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="glass-strong rounded-2xl mt-3 divide-y divide-border">
            {recent.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No research published yet.</p>
            ) : (
              recent.map((r: any) => (
                <Link
                  key={r.id}
                  to="/research/$id"
                  params={{ id: r.id }}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.category}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
