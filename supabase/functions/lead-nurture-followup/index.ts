// v2.0.0 — AI-powered contextual lead nurture follow-up
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("lead_nurture_config")
      .limit(1)
      .maybeSingle();

    const config = (orgSettings?.lead_nurture_config as any) ?? {
      enabled: true,
      delay_hours: 4,
      max_retries: 2,
    };

    if (!config.enabled) {
      return new Response(JSON.stringify({ message: "Lead nurture disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const delayHours = config.delay_hours || 4;
    const maxRetries = config.max_retries || 2;
    const nurturePrompt = config.nurture_prompt || "";
    const cutoffTime = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();

    // Find chats where:
    // 1. Bot is active (AI is handling)
    // 2. Last message was outbound (AI asked a question) 
    // 3. No reply from user since cutoff
    // 4. Retry count < max
    const { data: staleChats, error: chatErr } = await supabase
      .from("whatsapp_chat_settings")
      .select("id, phone_number, branch_id, nurture_retry_count, partial_lead_data")
      .eq("bot_active", true)
      .lt("nurture_retry_count", maxRetries);

    if (chatErr) {
      console.error("Failed to query stale chats:", chatErr);
      return new Response(JSON.stringify({ error: chatErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nudgedCount = 0;

    for (const chat of staleChats || []) {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("direction, created_at")
        .eq("phone_number", chat.phone_number)
        .eq("branch_id", chat.branch_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastMsg || lastMsg.direction !== "outbound" || lastMsg.created_at > cutoffTime) {
        continue;
      }

      // Check if there's an existing lead
      const cleanPhone = chat.phone_number.replace(/^\+/, "");
      const { data: lead } = await supabase
        .from("leads")
        .select("id, full_name")
        .or(`phone.eq.${chat.phone_number},phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
        .eq("branch_id", chat.branch_id)
        .limit(1)
        .maybeSingle();

      const partialData = chat.partial_lead_data as Record<string, any> | null;

      // Generate contextual nudge message
      let nudgeMessage: string;

      if (LOVABLE_API_KEY && (partialData || lead)) {
        // AI-powered contextual follow-up
        const missingFields: string[] = [];
        if (!partialData?.email && !lead) missingFields.push("email address");
        if (!partialData?.name && !lead?.full_name) missingFields.push("full name");
        if (!partialData?.goal) missingFields.push("fitness goal");

        const contextInfo = partialData
          ? `Partial data collected so far: ${JSON.stringify(partialData)}. Missing: ${missingFields.join(", ") || "none"}.`
          : lead
          ? `Lead exists: ${lead.full_name}. This is a re-engagement nudge.`
          : "No data collected yet.";

        const systemPrompt = `You are a friendly gym assistant for Incline Fitness. Write a single short WhatsApp follow-up message (max 2 sentences) to re-engage a lead who stopped responding.
${nurturePrompt ? `Additional context from admin: ${nurturePrompt}` : ""}
${contextInfo}
${missingFields.length > 0 ? `Naturally ask for their ${missingFields[0]} in the message.` : "Just encourage them to visit or reply."}
Keep it warm, casual, and use 1-2 emoji. Do NOT mention that they stopped replying.`;

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the follow-up message." },
              ],
            }),
          });

          if (aiRes.ok) {
            const aiResult = await aiRes.json();
            const generated = aiResult.choices?.[0]?.message?.content?.trim();
            if (generated) nudgeMessage = generated;
          }
        } catch (aiErr) {
          console.warn("AI nudge generation failed, using fallback:", aiErr);
        }
      }

      // Fallback message
      if (!nudgeMessage!) {
        const name = lead?.full_name || partialData?.name || partialData?.whatsapp_name || "there";
        nudgeMessage = `Hi ${name}! 👋 Just checking in — we'd love to help you get started on your fitness journey at Incline Fitness. Feel free to reply anytime with your questions! 💪`;
      }

      // Skip if no lead AND no partial data (nothing to nurture)
      if (!lead && !partialData) continue;

      const contactName = lead?.full_name || partialData?.name || partialData?.whatsapp_name || null;

      const { data: msgData, error: msgErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          branch_id: chat.branch_id,
          phone_number: chat.phone_number,
          contact_name: contactName,
          content: nudgeMessage,
          direction: "outbound",
          status: "pending",
          message_type: "text",
        })
        .select()
        .single();

      if (msgErr) {
        console.error(`Failed to insert nudge for ${chat.phone_number}:`, msgErr);
        continue;
      }

      try {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message_id: msgData.id,
            phone_number: chat.phone_number,
            content: nudgeMessage,
            branch_id: chat.branch_id,
          }),
        });

        if (!sendRes.ok) {
          console.error(`Send failed for ${chat.phone_number}: ${sendRes.status}`);
        }
      } catch (sendErr) {
        console.error(`Send error for ${chat.phone_number}:`, sendErr);
      }

      await supabase
        .from("whatsapp_chat_settings")
        .update({
          nurture_retry_count: (chat.nurture_retry_count || 0) + 1,
          last_nurture_at: new Date().toISOString(),
        })
        .eq("id", chat.id);

      nudgedCount++;
    }

    return new Response(
      JSON.stringify({ success: true, nudged: nudgedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("lead-nurture-followup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
