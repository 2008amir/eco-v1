import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  clearSupabaseDiagnostics,
  getSupabaseDiagnostics,
  onSupabaseDiagnosticsChange,
  type SupabaseDiagnosticEntry,
} from "@/lib/supabase-retry";

export const Route = createFileRoute("/admin/diagnostics")({
  component: DiagnosticsPage,
  head: () => ({ meta: [{ title: "Diagnostics — Ecomedic Squad" }] }),
});

function DiagnosticsPage() {
  const [entries, setEntries] = useState<SupabaseDiagnosticEntry[]>(() => getSupabaseDiagnostics());
  const last = entries[0];
  const retryCount = useMemo(() => entries.filter((entry) => entry.retryAttempts > 0).length, [entries]);

  useEffect(() => onSupabaseDiagnosticsChange(() => setEntries(getSupabaseDiagnostics())), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Database diagnostics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last failed database, RPC, and upload operations from this browser.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEntries(getSupabaseDiagnostics())}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { clearSupabaseDiagnostics(); setEntries([]); }}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      <section className="glass-strong rounded-2xl p-5">
        {last ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Summary label="Last target" value={`${last.kind}: ${last.target}`} icon={Database} />
            <Summary label="Status" value={last.statusCode ?? "—"} icon={AlertTriangle} />
            <Summary label="Code" value={last.code ?? "—"} icon={AlertTriangle} />
            <Summary label="Retry attempts" value={`${last.retryAttempts}/${last.attempts - 1}`} icon={RefreshCw} />
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" /> No failed database operations have been logged in this browser.
          </div>
        )}
      </section>

      <section className="glass-strong rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent failures</h2>
          <span className="text-xs text-muted-foreground">{entries.length} logged · {retryCount} retried</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="font-medium">{entry.kind}: {entry.target}</div>
                  <div className="text-xs text-muted-foreground">{entry.action ?? "operation"}{entry.path ? ` · ${entry.path}` : ""}</div>
                </TableCell>
                <TableCell>{entry.statusCode ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{entry.code ?? "—"}</TableCell>
                <TableCell>{entry.attempt}/{entry.attempts}</TableCell>
                <TableCell className="max-w-[22rem] truncate" title={entry.details ?? entry.message}>{entry.message}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No diagnostics yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Database }) {
  return (
    <div className="glass rounded-xl p-4">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
    </div>
  );
}