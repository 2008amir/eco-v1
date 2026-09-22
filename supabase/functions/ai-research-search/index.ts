// AI semantic search over research items
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, items } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not set");
    if (!query || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap items to keep prompt tight
    const trimmed = items.slice(0, 200).map((r: any) => ({
      id: r.id,
      n: r.research_number ?? "",
      t: r.title ?? "",
      s: r.section ?? "",
      d: (r.description ?? "").slice(0, 240),
    }));

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You rank research items by semantic relevance to a user query. Return only IDs of relevant items, ordered most-relevant first. Exclude irrelevant items.",
          },
          {
            role: "user",
            content: `Query: ${query}\n\nItems:\n${JSON.stringify(trimmed)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_ranked_ids",
              description: "Return ordered list of relevant research IDs",
              parameters: {
                type: "object",
                properties: {
                  ids: { type: "array", items: { type: "string" } },
                },
                required: ["ids"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_ranked_ids" } },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error", resp.status, body);
      return new Response(JSON.stringify({ error: "AI search failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { ids: [] };
    return new Response(JSON.stringify({ ids: args.ids ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-research-search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
