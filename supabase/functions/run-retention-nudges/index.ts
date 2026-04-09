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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const results = { stage_1: 0, stage_2: 0, stage_3: 0, skipped_cooldown: 0, skipped_returned: 0 };

    // Get all active branches
    const { data: branches } = await adminClient.from("branches").select("id").eq("is_active", true);
    if (!branches?.length) {
      return new Response(JSON.stringify({ success: true, message: "No active branches", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all active retention templates ordered by stage
    const { data: templates } = await adminClient
      .from("retention_templates")
      .select("*")
      .eq("is_active", true)
      .order("stage_level", { ascending: true });

    if (!templates?.length) {
      return new Response(JSON.stringify({ success: true, message: "No active templates", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const branch of branches) {
      // Get inactive members (5+ days absent, up to 200)
      const { data: inactiveMembers } = await adminClient.rpc("get_inactive_members", {
        p_branch_id: branch.id,
        p_days: 5,
        p_limit: 200,
      });

      if (!inactiveMembers?.length) continue;

      for (const member of inactiveMembers) {
        const daysAbsent = member.days_absent || 0;

        // Find the appropriate template based on days absent
        // Stage 1 = first threshold, Stage 2 = second, Stage 3 = third
        // We trigger at exact thresholds or slightly past (within 2 days buffer)
        let matchedTemplate = null;
        for (const tmpl of templates) {
          if (daysAbsent >= tmpl.days_trigger && daysAbsent < tmpl.days_trigger + 3) {
            matchedTemplate = tmpl;
            break;
          }
        }
        // Also allow exact match for higher stages if lower ones were already sent
        if (!matchedTemplate) {
          for (const tmpl of templates) {
            if (daysAbsent >= tmpl.days_trigger) {
              matchedTemplate = tmpl;
            }
          }
        }

        if (!matchedTemplate) continue;

        // SPAM GUARD: Check if this member already received this stage_level within 30 days
        const { count: recentNudgeCount } = await adminClient
          .from("retention_nudge_logs")
          .select("id", { count: "exact", head: true })
          .eq("member_id", member.member_id)
          .eq("stage_level", matchedTemplate.stage_level)
          .gte("sent_at", thirtyDaysAgo);

        if ((recentNudgeCount || 0) > 0) {
          results.skipped_cooldown++;
          continue;
        }

        // RESET GUARD: If member has attendance after their last nudge, skip
        const { data: lastNudge } = await adminClient
          .from("retention_nudge_logs")
          .select("sent_at")
          .eq("member_id", member.member_id)
          .order("sent_at", { ascending: false })
          .limit(1);

        if (lastNudge?.length) {
          const { count: attendanceAfterNudge } = await adminClient
            .from("member_attendance")
            .select("id", { count: "exact", head: true })
            .eq("member_id", member.member_id)
            .gte("check_in", lastNudge[0].sent_at);

          if ((attendanceAfterNudge || 0) > 0) {
            results.skipped_returned++;
            continue;
          }
        }

        // Personalize message
        const personalizedMessage = matchedTemplate.message_body.replace(
          /{member_name}/g,
          member.full_name || "there"
        );

        // Get channels for this template
        const channels: string[] = matchedTemplate.channels || ["whatsapp"];

        for (const channel of channels) {
          try {
            if (channel === "whatsapp" && member.phone) {
              // Create message row first, then call send-whatsapp with canonical payload.
              const { data: outboundMsg, error: msgInsertErr } = await adminClient
                .from("whatsapp_messages")
                .insert({
                  branch_id: branch.id,
                  member_id: member.member_id,
                  phone_number: member.phone,
                  content: personalizedMessage,
                  direction: "outbound",
                  status: "pending",
                  message_type: "text",
                })
                .select("id")
                .single();

              if (msgInsertErr || !outboundMsg?.id) {
                console.error("Failed to create WhatsApp message row:", msgInsertErr);
                throw new Error("Could not queue WhatsApp message");
              }

              try {
                const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    message_id: outboundMsg.id,
                    phone_number: member.phone,
                    content: personalizedMessage,
                    branch_id: branch.id,
                  }),
                });

                if (!sendRes.ok) {
                  const errBody = await sendRes.text();
                  throw new Error(`send-whatsapp failed (${sendRes.status}): ${errBody}`);
                }
              } catch (whatsappErr) {
                console.error("WhatsApp send error:", whatsappErr);
                throw whatsappErr;
              }
            }

            // send-whatsapp already writes communication_logs; avoid duplicates.
            if (channel !== "whatsapp") {
              await adminClient.from("communication_logs").insert({
                branch_id: branch.id,
                type: channel,
                recipient: channel === "email" ? (member.email || "") : (member.phone || ""),
                subject: `Retention Stage ${matchedTemplate.stage_level}: ${matchedTemplate.stage_name}`,
                content: personalizedMessage,
                status: "sent",
                member_id: member.member_id,
                sent_at: new Date().toISOString(),
              });
            }
          } catch (channelErr) {
            console.error(`Channel ${channel} error:`, channelErr);
          }
        }

        // Insert nudge log
        await adminClient.from("retention_nudge_logs").insert({
          member_id: member.member_id,
          branch_id: branch.id,
          template_id: matchedTemplate.id,
          stage_level: matchedTemplate.stage_level,
          channel: channels.join(","),
          status: "sent",
          message_content: personalizedMessage,
        });

        const stageKey = `stage_${matchedTemplate.stage_level}` as keyof typeof results;
        if (stageKey in results) {
          (results as any)[stageKey]++;
        }
      }
    }

    const totalSent = results.stage_1 + results.stage_2 + results.stage_3;
    console.log(`Retention nudges completed: ${totalSent} sent, ${results.skipped_cooldown} cooldown, ${results.skipped_returned} returned`);

    return new Response(
      JSON.stringify({ success: true, total_sent: totalSent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Retention nudges error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
