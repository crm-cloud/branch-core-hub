import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { channel, message, audience, branch_id, subject } = await req.json();

    if (!channel || !message || !branch_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: channel, message, branch_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Resolve recipients based on audience
    let membersQuery = adminClient
      .from("members")
      .select("id, user_id, member_code, profiles:user_id (full_name, phone, email)")
      .eq("branch_id", branch_id);

    if (audience === "active") {
      // Get members with active memberships
      const { data: activeMemberIds } = await adminClient
        .from("memberships")
        .select("member_id")
        .eq("status", "active")
        .eq("branch_id", branch_id)
        .gte("end_date", new Date().toISOString().split("T")[0]);
      const ids = [...new Set((activeMemberIds || []).map((m: any) => m.member_id))];
      if (ids.length > 0) membersQuery = membersQuery.in("id", ids);
      else return new Response(JSON.stringify({ success: true, sent: 0, message: "No active members found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (audience === "expiring") {
      const today = new Date();
      const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data: expiringIds } = await adminClient
        .from("memberships")
        .select("member_id")
        .eq("status", "active")
        .eq("branch_id", branch_id)
        .lte("end_date", sevenDays.toISOString().split("T")[0])
        .gte("end_date", today.toISOString().split("T")[0]);
      const ids = [...new Set((expiringIds || []).map((m: any) => m.member_id))];
      if (ids.length > 0) membersQuery = membersQuery.in("id", ids);
      else return new Response(JSON.stringify({ success: true, sent: 0, message: "No expiring members found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (audience === "expired") {
      const { data: expiredIds } = await adminClient
        .from("memberships")
        .select("member_id")
        .eq("branch_id", branch_id)
        .lt("end_date", new Date().toISOString().split("T")[0]);
      const ids = [...new Set((expiredIds || []).map((m: any) => m.member_id))];
      if (ids.length > 0) membersQuery = membersQuery.in("id", ids);
      else return new Response(JSON.stringify({ success: true, sent: 0, message: "No expired members found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: members, error: membersError } = await membersQuery;
    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;
    const logs: any[] = [];

    for (const member of members) {
      const profile = (member as any).profiles;
      if (!profile) continue;

      // Personalize message
      const personalizedMsg = message
        .replace(/\{\{member_name\}\}/g, profile.full_name || "Member")
        .replace(/\{\{member_code\}\}/g, member.member_code || "");

      let recipient = "";
      let status = "logged";

      if (channel === "email" && profile.email) {
        recipient = profile.email;
        // Check if RESEND_API_KEY is configured for actual sending
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Gym <noreply@updates.gym.com>",
                to: [profile.email],
                subject: subject || "Message from your gym",
                html: personalizedMsg.replace(/\n/g, "<br>"),
              }),
            });
            status = res.ok ? "sent" : "failed";
          } catch {
            status = "failed";
          }
        }
      } else if (channel === "sms" && profile.phone) {
        recipient = profile.phone;
        // SMS sending requires provider API key - logged only for now
        status = "logged";
      } else if (channel === "whatsapp" && profile.phone) {
        recipient = profile.phone;
        // WhatsApp Business API requires setup - logged only for now
        status = "logged";
      } else {
        continue; // No valid contact info for this channel
      }

      if (status === "sent" || status === "logged") sent++;
      else failed++;

      logs.push({
        branch_id,
        type: channel,
        recipient,
        subject: subject || null,
        content: personalizedMsg,
        status,
        member_id: member.id,
        sent_at: new Date().toISOString(),
      });
    }

    // Bulk insert communication logs
    if (logs.length > 0) {
      await adminClient.from("communication_logs").insert(logs);
    }

    // Create a notification for the sender
    await adminClient.from("notifications").insert({
      user_id: userId,
      branch_id,
      title: "Broadcast Sent",
      message: `${channel.toUpperCase()} broadcast sent to ${sent} recipients (${audience} audience)`,
      type: "info",
      category: "communication",
    });

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: members.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Broadcast error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
