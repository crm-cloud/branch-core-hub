// v1.0.0 — Notify a staff member on their personal WhatsApp when chat handoff is requested.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { staff_user_id, member_phone, reason, branch_id } = await req.json();
    if (!staff_user_id || !member_phone) return json({ error: "missing fields" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Lookup staff routing entry
    const { data: route } = await admin
      .from("staff_whatsapp_routing")
      .select("personal_phone, is_available")
      .eq("user_id", staff_user_id)
      .eq("branch_id", branch_id)
      .maybeSingle();

    // Always create an in-app notification
    await admin.from("notifications").insert({
      user_id: staff_user_id,
      title: "Chat assigned to you",
      message: `${member_phone} needs human assistance${reason ? `: ${reason}` : ""}`,
      action_url: `/whatsapp-chat?phone=${member_phone}`,
    });

    if (!route?.personal_phone || !route.is_available) {
      return json({ delivered: false, reason: "no_routing" });
    }

    // Fire WhatsApp template via existing send-whatsapp dispatcher
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        to: route.personal_phone,
        branch_id,
        message: `🔔 *Chat Handoff*\nMember: ${member_phone}\nReason: ${reason || "Member needs human assistance"}\nOpen chat: ${supabaseUrl.replace(".supabase.co", "")}/whatsapp-chat?phone=${member_phone}`,
      }),
    });

    return json({ delivered: resp.ok });
  } catch (e: any) {
    return json({ error: e?.message }, 500);
  }
});

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
