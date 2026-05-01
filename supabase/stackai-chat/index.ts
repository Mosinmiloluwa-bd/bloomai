import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, session_id } = await req.json();

    const apiUrl = Deno.env.get("STACKAI_API_URL");
    const apiKey = Deno.env.get("STACKAI_API_KEY");

    if (!apiUrl || !apiKey) {
      console.error("STACKAI_API_URL or STACKAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "StackAI integration is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        "in-0": message,
        user_id: session_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("StackAI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `StackAI request failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    // StackAI may nest output in data.outputs["out-0"] or directly in data["out-0"]
    const output: string = data?.outputs?.["out-0"] ?? data?.["out-0"] ?? JSON.stringify(data);

    // Stream the response back word-by-word for progressive rendering
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Split into words while preserving whitespace and markdown
        const tokens = output.match(/\S+\s*/g) || [output];
        for (const token of tokens) {
          controller.enqueue(encoder.encode(token));
          // Small delay between tokens for smooth streaming effect
          await new Promise((r) => setTimeout(r, 25));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("Edge function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
