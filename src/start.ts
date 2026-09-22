import { createMiddleware, createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { isAbortError } from "@/lib/error-capture";

const abortMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    try {
      return await next();
    } catch (error) {
      if (request.signal.aborted || isAbortError(error)) {
        return new Response(null, { status: 499 });
      }
      throw error;
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [abortMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));