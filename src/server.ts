import { isAbortError } from "./lib/error-capture";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as unknown as { default?: ServerEntry }).default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeAbortedResponse(request: Request, response: Response): Promise<Response> {
  if (request.signal.aborted) return new Response(null, { status: 499 });
  if (response.status < 500) return response;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  try {
    const payload = (await response.clone().json()) as {
      message?: unknown;
      cause?: { code?: unknown; message?: unknown };
    };
    const message = typeof payload.message === "string" ? payload.message : "";
    const causeCode = typeof payload.cause?.code === "string" ? payload.cause.code : "";
    const causeMessage =
      typeof payload.cause?.message === "string" ? payload.cause.message : "";

    if (/^aborted$/i.test(message) || causeCode === "ECONNRESET" || /^aborted$/i.test(causeMessage)) {
      return new Response(null, { status: 499 });
    }
  } catch {
    return response;
  }

  return response;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeAbortedResponse(request, response);
    } catch (error) {
      if (isAbortError(error) || request.signal?.aborted) {
        return new Response(null, { status: 499 });
      }
      console.error(error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
};
