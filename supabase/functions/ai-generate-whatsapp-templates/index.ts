// v1.0.0 — AI-powered WhatsApp template generator using Lovable AI Gateway.
// Returns template proposals (NOT submitted to Meta). Frontend reviews before bulk-submit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EventSpec {
  event: string;
  label?: string;
  hint?: string;
}

interface Body {
  branch_id: string;
  events: EventSpec[];
  existing?: Array<{ name: string; body: string }>;
  brand?: string;
}

const SYSTEM_PROMPT = `You write WhatsApp Business message templates for a premium Indian gym brand called "Incline Fitness".

Rules:
- Output ONLY via the propose_templates tool. No prose.
- Each template body MUST:
  • Be ≤ 850 characters.
  • Use named variables in {{snake_case}} form (we convert to {{1}} {{2}} server-side).
  • Be deduplicated against the "existing" list — never propose a near-duplicate name or body.
  • Match Meta WhatsApp policy:
      - UTILITY for transactional events (booking, payment, expiry, member lifecycle, freeze, scan ready, alerts).
      - MARKETING for promotional / re-engagement / birthday / referral / offer.
      - AUTHENTICATION only for OTPs.
  • No emojis in body for UTILITY templates. Marketing may use 1 tasteful emoji max.
  • No URLs or phone numbers in body (Meta restricts; use template buttons separately).
  • Tone: warm, concise, Indian-English, premium fitness brand.
  • Each template name: lower_snake_case, max 50 chars, descriptive (e.g. "membership_expiring_7d_v2").
- For events with attachments (e.g. class flyers, workout PDFs), set header_type = "image" or "document" and provide a header_sample_url placeholder of "https://placehold.co/600x400.png" so Meta can approve the slot.
- Return a "variables" array of the named variables you used, in order.
- One template per requested event.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "propose_templates",
    description: "Return clean Meta-compliant WhatsApp template proposals for the requested events.",
    parameters: {
      type: "object",
      properties: {
        templates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              event: { type: "string", description: "The system event this template serves." },
              name: { type: "string", description: "lower_snake_case template name." },
              category: { type: "string", enum: ["UTILITY", "MARKETING", "AUTHENTICATION"] },
              language: { type: "string", description: "BCP-47 code, default 'en'." },
              body_text: { type: "string" },
              variables: { type: "array", items: { type: "string" } },
              header_type: { type: "string", enum: ["none", "image", "document", "video"] },
              header_sample_url: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["event", "name", "category", "language", "body_text", "variables"],
            additionalProperties: false,
          },
        },
      },
      required: ["templates"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body.branch_id || !Array.isArray(body.events) || body.events.length === 0) {
      return json({ error: "Missing branch_id or events[]" }, 400);
    }
    if (body.events.length > 30) return json({ error: "Max 30 events per call" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI Gateway not configured" }, 500);

    const userPrompt = [
      `Brand: ${body.brand || "Incline Fitness"}`,
      "",
      "Events to generate templates for:",
      ...body.events.map((e) => `- ${e.event}${e.label ? ` (${e.label})` : ""}${e.hint ? ` — hint: ${e.hint}` : ""}`),
      "",
      "Existing templates (avoid duplicates):",
      (body.existing || []).slice(0, 60).map((e) => `• ${e.name}: ${e.body.slice(0, 140).replace(/\n/g, " ")}`).join("\n") || "(none)",
    ].join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "propose_templates" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "AI rate-limited. Try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted — top up Lovable AI usage." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return json({ error: "AI gateway error", details: t.slice(0, 400) }, 502);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return json({ error: "AI returned no proposals" }, 500);
    }
    let parsed: any;
    try { parsed = JSON.parse(toolCall.function.arguments); } catch { return json({ error: "Bad AI JSON" }, 500); }
    const templates = Array.isArray(parsed?.templates) ? parsed.templates : [];

    return json({ success: true, templates });
  } catch (e) {
    console.error("ai-generate-whatsapp-templates error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
