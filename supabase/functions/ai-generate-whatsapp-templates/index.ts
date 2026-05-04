// v2.1.0 — Multi-channel AI template generator (WhatsApp / SMS / Email)
// v2.1.0: document-bearing events forced to header_type='none' + {{document_link}}
// in body (Meta rejects DOCUMENT headers without an uploaded media handle;
// the dispatcher already injects the actual PDF at send-time).
// Returns proposals (NOT submitted to Meta). Frontend reviews before save.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EventSpec { event: string; label?: string; hint?: string }
type Channel = 'whatsapp' | 'sms' | 'email';
interface Body {
  branch_id: string;
  channel?: Channel; // default 'whatsapp'
  events: EventSpec[];
  existing?: Array<{ name: string; body: string }>;
  brand?: string;
}

const SYSTEM_PROMPTS: Record<Channel, string> = {
  whatsapp: `You write WhatsApp Business message templates for a premium Indian gym brand "Incline Fitness".
Rules:
- Output ONLY via the propose_templates tool. No prose.
- Each body ≤ 850 chars; named variables in {{snake_case}}; never duplicate the existing list.
- Categories: UTILITY (transactional/lifecycle), MARKETING (promo/birthday/referral/offer), AUTHENTICATION (OTPs only).
- No emojis on UTILITY; max 1 tasteful emoji on MARKETING; no URLs / phone numbers in body.
- Tone: warm, concise, Indian-English, premium fitness.
- Names: lower_snake_case ≤ 50 chars, descriptive.
- For attachment events (flyers, PDFs) set header_type=image|document with sample url "https://placehold.co/600x400.png".
- One template per event.`,
  sms: `You write Indian-DLT-compliant transactional/promotional SMS for "Incline Fitness".
Rules:
- Output ONLY via the propose_templates tool. No prose.
- Each body ≤ 160 chars (single segment) unless absolutely needed (max 320 chars).
- No emojis. No URLs. No phone numbers in body.
- Variable placeholders use {{snake_case}}; later mapped to {#var#}.
- End every promotional SMS with the suffix "-INCLNE" (DLT entity tag) — do not add it for transactional.
- Categories map to dlt_category: TRANSACTIONAL (utility/booking/payment/expiry), SERVICE_IMPLICIT (lifecycle confirmations), SERVICE_EXPLICIT (rich utility w/ promo cross-sell), PROMOTIONAL (offers/marketing/birthday).
- Names: lower_snake_case ≤ 30 chars.
- One template per event.`,
  email: `You write transactional & marketing emails for "Incline Fitness", a premium Indian gym brand.
Rules:
- Output ONLY via the propose_templates tool. No prose.
- For each event return: subject (≤ 70 chars, no clickbait), preheader (≤ 110 chars), body_html (clean, mobile-first, inline styles, max 600px width, no external CSS, brand color #6d28d9), body_text fallback.
- Variables in {{snake_case}}.
- Tone: warm, premium, friendly. Add a single primary CTA when relevant ("Renew Membership", "View Receipt", "Book Class").
- Categories: UTILITY (receipts/lifecycle), MARKETING (offers/newsletter/birthday).
- For events with attachments (e.g. invoice, scan report), set header_type='document'.
- One template per event.`,
};

function buildToolSchema(channel: Channel) {
  const itemProps: Record<string, unknown> = {
    event: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    language: { type: "string" },
    body_text: { type: "string" },
    variables: { type: "array", items: { type: "string" } },
    header_type: { type: "string", enum: ["none", "image", "document", "video"] },
    header_sample_url: { type: "string" },
    rationale: { type: "string" },
  };
  const required = ["event", "name", "category", "body_text", "variables"];
  if (channel === 'email') {
    itemProps.subject = { type: "string" };
    itemProps.preheader = { type: "string" };
    itemProps.body_html = { type: "string" };
    required.push("subject", "body_html");
  }
  if (channel === 'sms') {
    itemProps.dlt_category = { type: "string", enum: ["TRANSACTIONAL", "SERVICE_IMPLICIT", "SERVICE_EXPLICIT", "PROMOTIONAL"] };
  }
  return {
    type: "function",
    function: {
      name: "propose_templates",
      description: `Return clean ${channel.toUpperCase()} template proposals.`,
      parameters: {
        type: "object",
        properties: {
          templates: {
            type: "array",
            items: { type: "object", properties: itemProps, required, additionalProperties: false },
          },
        },
        required: ["templates"],
        additionalProperties: false,
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
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

    const channel: Channel = (body.channel === 'sms' || body.channel === 'email') ? body.channel : 'whatsapp';
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI Gateway not configured" }, 500);

    const userPrompt = [
      `Brand: ${body.brand || "Incline Fitness"}`,
      `Channel: ${channel}`,
      "",
      "Events to generate templates for:",
      ...body.events.map((e) => `- ${e.event}${e.label ? ` (${e.label})` : ""}${e.hint ? ` — hint: ${e.hint}` : ""}`),
      "",
      "Existing templates (avoid duplicates):",
      (body.existing || []).slice(0, 60).map((e) => `• ${e.name}: ${e.body.slice(0, 140).replace(/\n/g, " ")}`).join("\n") || "(none)",
    ].join("\n");

    const TOOL_SCHEMA = buildToolSchema(channel);
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[channel] },
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
    if (!toolCall?.function?.arguments) return json({ error: "AI returned no proposals" }, 500);
    let parsed: any;
    try { parsed = JSON.parse(toolCall.function.arguments); } catch { return json({ error: "Bad AI JSON" }, 500); }
    const templates = Array.isArray(parsed?.templates) ? parsed.templates : [];

    return json({ success: true, channel, templates });
  } catch (e) {
    console.error("ai-generate-whatsapp-templates error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
