// v1.0.0 — Scheduled AI follow-up for silent leads
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get nurture config from organization_settings
    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("lead_nurture_config")
      .limit(1)
      .maybeSingle();

    const config = orgSettings?.lead_nurture_config ?? {
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
    const cutoffTime = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();

    // Find chats where:
    // 1. Bot is active (AI is handling)
    // 2. Last message was outbound (AI asked a question) 
    // 3. No reply from user since cutoff
    // 4. Retry count < max
    const { data: staleChats, error: chatErr } = await supabase
      .from("whatsapp_chat_settings")
      .select("id, phone_number, branch_id, nurture_retry_count")
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
      // Get the last message for this chat
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("direction, created_at")
        .eq("phone_number", chat.phone_number)
        .eq("branch_id", chat.branch_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Only nudge if last message was outbound and older than cutoff
      if (!lastMsg || lastMsg.direction !== "outbound" || lastMsg.created_at > cutoffTime) {
        continue;
      }

      // Check if there's a lead for this phone
      const cleanPhone = chat.phone_number.replace(/^\+/, "");
      const { data: lead } = await supabase
        .from("leads")
        .select("id, full_name")
        .or(`phone.eq.${chat.phone_number},phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
        .eq("branch_id", chat.branch_id)
        .limit(1)
        .maybeSingle();

      if (!lead) continue; // Only nudge known leads

      const nudgeMessage = `Hi ${lead.full_name || "there"}! 👋 Just checking in — we'd love to help you get started on your fitness journey at Incline Fitness. Feel free to reply anytime with your questions! 💪`;

      // Insert the nudge message
      const { data: msgData, error: msgErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          branch_id: chat.branch_id,
          phone_number: chat.phone_number,
          contact_name: lead.full_name,
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

      // Send via WhatsApp
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

      // Update retry count
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
