/** Identifies browser disconnects without suppressing unrelated server failures. */
export function isAbortError(error: unknown): boolean {
  const err = error as
    | { name?: string; code?: string; message?: string; cause?: unknown }
    | null
    | undefined;
  if (!err || typeof err !== "object") return false;
  if (err.name === "AbortError") return true;
  if (err.code === "ECONNRESET" || err.code === "ABORT_ERR" || err.code === "EPIPE") return true;
  if (typeof err.message === "string" && /^aborted$|ECONNRESET|socket hang up/i.test(err.message))
    return true;
  if (err.cause && err.cause !== error) return isAbortError(err.cause);
  return false;
}
