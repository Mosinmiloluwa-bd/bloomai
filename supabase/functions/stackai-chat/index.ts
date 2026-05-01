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
    const { message, session_id, user_id } = await req.json();

    const apiUrl = Deno.env.get("STACKAI_API_URL");
    const apiKey = Deno.env.get("STACKAI_API_KEY");

    if (!apiUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: "StackAI credentials missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sending User UUID as in-1 as requested
    const payload = {
      "in-0": message,
      "in-1": user_id,
      "user_id": session_id,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Retry with wrapped format if it was a 400
      if (response.status === 400) {
        const wrappedPayload = {
          "inputs": { 
            "in-0": message,
            "in-1": user_id
          },
          "user_id": session_id
        };
        const retryResponse = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(wrappedPayload),
        });
        
        if (retryResponse.ok) return handleStackAIResponse(retryResponse);
        const retryError = await retryResponse.text();
        return new Response(JSON.stringify({ error: retryError }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: errorText }), { status: response.status, headers: corsHeaders });
    }

    return handleStackAIResponse(response);

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

async function handleStackAIResponse(response: Response) {
  const data = await response.json();
  const output: string = data?.outputs?.["out-0"] ?? data?.["out-0"] ?? JSON.stringify(data);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tokens = output.match(/\S+\s*/g) || [output];
      for (const token of tokens) {
        controller.enqueue(encoder.encode(token));
        await new Promise((r) => setTimeout(r, 20));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}
