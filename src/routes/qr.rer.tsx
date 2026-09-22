import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicCard } from "@/lib/member-card.functions";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/qr/rer")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : "",
  }),
  component: PublicCardPage,
  head: () => ({
    meta: [
      { title: "Member verification — Ecomedic Squad" },
      { name: "description", content: "Verify an Ecomedic Squad member ID card and view the member's official details." },
      { property: "og:title", content: "Member verification — Ecomedic Squad" },
      { property: "og:description", content: "Verify an Ecomedic Squad member ID card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border/60 text-sm">
      <div className="w-40 text-muted-foreground">{label}</div>
      <div className="flex-1 font-medium">{value ? String(value) : "—"}</div>
    </div>
  );
}

function PublicCardPage() {
  const { id } = Route.useSearch();
  const fetchCard = useServerFn(getPublicCard);
  const { data, isLoading } = useQuery({
    queryKey: ["public-card", id],
    enabled: id.length > 0,
    queryFn: () => fetchCard({ data: { id } }),
  });

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold gradient-text text-center">Ecomedic Squad — Member verification</h1>

        {isLoading && (
          <div className="glass-strong rounded-2xl p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}

        {!isLoading && !data && (
          <div className="glass-strong rounded-2xl p-8 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 mx-auto text-destructive" />
            <p className="font-semibold">No member found</p>
            <p className="text-sm text-muted-foreground">ID no “{id || "—"}” does not match any Ecomedic Squad member.</p>
          </div>
        )}

        {data && (
          <div className="glass-strong rounded-2xl p-6 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              {data.avatar_signed_url
                ? <img src={data.avatar_signed_url} alt={data.full_name ?? "Member"} className="h-32 w-32 rounded-full object-cover ring-2 ring-primary" />
                : <div className="h-32 w-32 rounded-full gradient-bg flex items-center justify-center text-3xl font-bold text-primary-foreground">
                    {(data.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </div>}
              <div>
                <div className="text-xl font-bold">{data.full_name ?? data.username}</div>
                <div className="text-sm text-muted-foreground">{data.position}</div>
              </div>
              <div className={`inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full ${data.revoked ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                {data.revoked ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {data.revoked ? "Membership revoked" : "Active member"}
              </div>
            </div>

            <div>
              <Row label="ID no" value={data.member_no} />
              <Row label="Full name" value={data.full_name} />
              <Row label="Type" value={data.position} />
              <Row label="Blood group" value={data.blood_group} />
              <Row label="Phone no" value={data.phone} />
              <Row label="Gender" value={data.gender} />
              <Row label="Date of birth" value={data.date_of_birth} />
              <Row label="City" value={data.city} />
              <Row label="State" value={data.state} />
              <Row label="Country" value={data.country} />
              <Row label="Member since" value={data.registered_at ? new Date(data.registered_at).toLocaleDateString() : null} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
