const TRANSIENT_CODES = new Set(["08P01", "PGRST001", "PGRST002"]);
const DIAGNOSTICS_KEY = "ecomedic.supabase.diagnostics.v1";
const DIAGNOSTICS_EVENT = "supabase-diagnostics:update";

export type SupabaseOperationKind = "table" | "rpc" | "storage" | "auth" | "unknown";

export type SupabaseOperationInfo = {
  kind: SupabaseOperationKind;
  target: string;
  action?: string;
  path?: string;
};

export type SupabaseDiagnosticEntry = SupabaseOperationInfo & {
  id: string;
  timestamp: string;
  code: string | null;
  statusCode: string | null;
  message: string;
  details: string | null;
  attempt: number;
  attempts: number;
  retryAttempts: number;
  transient: boolean;
};

function readDiagnostics() {
  if (typeof window === "undefined") return [] as SupabaseDiagnosticEntry[];
  try {
    return JSON.parse(window.localStorage.getItem(DIAGNOSTICS_KEY) || "[]") as SupabaseDiagnosticEntry[];
  } catch {
    return [] as SupabaseDiagnosticEntry[];
  }
}

function writeDiagnostic(error: unknown, operation: SupabaseOperationInfo | undefined, attempt: number, attempts: number) {
  if (typeof window === "undefined") return;
  const value = error as { code?: string; statusCode?: string | number; status?: string | number; message?: string; details?: string } | null;
  const entry: SupabaseDiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    kind: operation?.kind ?? "unknown",
    target: operation?.target ?? "unknown",
    action: operation?.action,
    path: operation?.path,
    code: value?.code ?? null,
    statusCode: value?.statusCode != null ? String(value.statusCode) : value?.status != null ? String(value.status) : null,
    message: value?.message || String(error || "Unknown database error"),
    details: value?.details ?? null,
    attempt,
    attempts,
    retryAttempts: Math.max(0, attempt - 1),
    transient: isTransientSupabaseError(error),
  };
  const next = [entry, ...readDiagnostics()].slice(0, 25);
  window.localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DIAGNOSTICS_EVENT));
}

export function getSupabaseDiagnostics() {
  return readDiagnostics();
}

export function clearSupabaseDiagnostics() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DIAGNOSTICS_KEY);
  window.dispatchEvent(new CustomEvent(DIAGNOSTICS_EVENT));
}

export function onSupabaseDiagnosticsChange(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DIAGNOSTICS_EVENT, callback);
  return () => window.removeEventListener(DIAGNOSTICS_EVENT, callback);
}

export function isTransientSupabaseError(error: unknown) {
  const value = error as { code?: string; statusCode?: string | number; message?: string; details?: string; name?: string } | null;
  const message = `${value?.name ?? ""} ${value?.message ?? ""} ${value?.details ?? ""} ${value?.code ?? ""}`.toLowerCase();
  const statusCode = String(value?.statusCode ?? "");

  return Boolean(
    (value?.code && TRANSIENT_CODES.has(value.code)) ||
    statusCode === "500" ||
    statusCode === "503" ||
    message.includes("08p01") ||
    message.includes("database client error") ||
    message.includes("schema cache") ||
    message.includes("retrying") ||
    message.includes("no connection") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("failed to fetch") ||
    message.includes("abort") ||
    message.includes("network") ||
    message.includes("timeout"),
  );
}

function asFailedResult<T extends { error: unknown }>(error: unknown): T {
  return { data: null, error } as unknown as T;
}

/** An expired/invalid access token — recoverable by refreshing the session. */
export function isAuthExpiredError(error: unknown) {
  const value = error as { code?: string; status?: number; statusCode?: string | number; message?: string } | null;
  const message = `${value?.message ?? ""}`.toLowerCase();
  return Boolean(
    value?.code === "PGRST303" ||
    value?.code === "PGRST301" ||
    message.includes("jwt expired") ||
    message.includes("invalid jwt") ||
    message.includes("token is expired"),
  );
}

let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSupabaseSession() {
  if (typeof window === "undefined") return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session) return true;
        const { data: fallback } = await supabase.auth.getSession();
        return Boolean(fallback.session);
      } catch {
        return false;
      } finally {
        setTimeout(() => { refreshInFlight = null; }, 0);
      }
    })();
  }
  return refreshInFlight;
}

export async function withSupabaseRetry<T extends { error: unknown }>(
  request: () => PromiseLike<T>,
  attempts = 4,
  operation?: SupabaseOperationInfo,
): Promise<T> {
  let result = asFailedResult<T>(new Error("Request was not attempted"));

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      result = await request();
    } catch (error) {
      result = asFailedResult<T>(error);
    }

    if (!result.error) return result;

    writeDiagnostic(result.error, operation, attempt, attempts);

    if (isAuthExpiredError(result.error) && attempt < attempts) {
      const refreshed = await refreshSupabaseSession();
      if (refreshed) continue;
      return result;
    }

    if (!isTransientSupabaseError(result.error) || attempt >= attempts) return result;

    const jitter = Math.round(Math.random() * 250);
    await new Promise((resolve) => setTimeout(resolve, 750 * attempt + jitter));
  }

  return result;
}

export async function uploadWithSupabaseRetry(
  bucket: string,
  path: string,
  file: File,
  options?: { cacheControl?: string; contentType?: string; upsert?: boolean },
  attempts = 5,
) {
  return withSupabaseRetry(
    () => import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.storage.from(bucket).upload(path, file, options),
    ),
    attempts,
    { kind: "storage", target: bucket, action: "upload", path },
  );
}
