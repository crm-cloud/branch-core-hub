import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const today = new Date().toISOString().split("T")[0];
    const revoked: string[] = [];
    const errors: string[] = [];

    // ── 1. Members with active hardware but no active membership ──
    const { data: activeHardwareMembers, error: queryError } = await supabase
      .from("members")
      .select("id, member_code, mips_person_sn, mips_person_id, branch_id")
      .eq("hardware_access_status", "active")
      .not("mips_person_sn", "is", null);

    if (queryError) throw queryError;

    for (const member of activeHardwareMembers || []) {
      const { data: activeMembership } = await supabase
        .from("memberships")
        .select("id, status, end_date")
        .eq("member_id", member.id)
        .eq("status", "active")
        .gte("end_date", today)
        .limit(1)
        .maybeSingle();

      if (!activeMembership) {
        try {
          const { data: revokeResult, error: revokeError } = await supabase.functions.invoke("revoke-mips-access", {
            body: {
              member_id: member.id,
              action: "revoke",
              reason: "Auto-revoked: membership expired or inactive",
              branch_id: member.branch_id,
            },
          });

          if (revokeError) {
            errors.push(`${member.member_code}: ${revokeError.message}`);
          } else {
            revoked.push(member.member_code || member.id);
            console.log(`Revoked access for ${member.member_code}: ${JSON.stringify(revokeResult)}`);
          }
        } catch (e) {
          errors.push(`${member.member_code}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // ── 2. Frozen memberships with active hardware ──
    const { data: frozenMembers } = await supabase
      .from("memberships")
      .select("member_id, members!inner(id, member_code, hardware_access_status, mips_person_sn, branch_id)")
      .eq("status", "frozen")
      .eq("members.hardware_access_status", "active");

    for (const ms of frozenMembers || []) {
      const m = (ms as any).members;
      if (!m?.mips_person_sn) continue;
      try {
        await supabase.functions.invoke("revoke-mips-access", {
          body: {
            member_id: m.id,
            action: "revoke",
            reason: "Auto-revoked: membership frozen",
            branch_id: m.branch_id,
          },
        });
        revoked.push(m.member_code || m.id);
      } catch (e) {
        errors.push(`${m.member_code}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── 3. Members with overdue invoices ──
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("member_id, members!inner(id, member_code, hardware_access_status, mips_person_sn, branch_id)")
      .in("status", ["overdue"])
      .eq("members.hardware_access_status", "active");

    for (const inv of overdueInvoices || []) {
      const m = (inv as any).members;
      if (!m?.mips_person_sn) continue;
      // Don't double-revoke if already in the revoked list
      if (revoked.includes(m.member_code || m.id)) continue;
      try {
        await supabase.functions.invoke("revoke-mips-access", {
          body: {
            member_id: m.id,
            action: "revoke",
            reason: "Auto-revoked: overdue invoice",
            branch_id: m.branch_id,
          },
        });
        revoked.push(m.member_code || m.id);
      } catch (e) {
        errors.push(`${m.member_code}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      revoked_count: revoked.length,
      revoked,
      errors,
      checked_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("check-expired-access error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
