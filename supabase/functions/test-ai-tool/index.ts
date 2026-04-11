// v1.0.0 — Manual AI Tool Test Endpoint
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller is staff
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const staffRoles = ["owner", "admin", "manager", "staff"];
    const hasAccess = roles?.some((r: any) => staffRoles.includes(r.role));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tool_name, arguments: args } = await req.json();
    if (!tool_name) {
      return new Response(JSON.stringify({ error: "tool_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute tool using direct DB queries (subset of tools safe for testing)
    let result: Record<string, any> = {};

    switch (tool_name) {
      case "get_membership_status": {
        const memberId = args?.member_id;
        if (!memberId) { result = { error: "member_id required in arguments" }; break; }
        const { data } = await supabase
          .from("memberships")
          .select("id, status, start_date, end_date, plan_id, membership_plans(name, price)")
          .eq("member_id", memberId)
          .order("end_date", { ascending: false })
          .limit(3);
        result = { memberships: data || [] };
        break;
      }

      case "get_benefit_balance": {
        const memberId = args?.member_id;
        if (!memberId) { result = { error: "member_id required in arguments" }; break; }
        const { data: membership } = await supabase
          .from("memberships")
          .select("id, plan_id")
          .eq("member_id", memberId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (!membership) { result = { message: "No active membership" }; break; }
        const { data: benefits } = await supabase
          .from("plan_benefits")
          .select("benefit_type, limit_count, frequency, benefit_types(name, code)")
          .eq("plan_id", membership.plan_id);
        result = { benefits: benefits || [] };
        break;
      }

      case "get_available_slots": {
        const facilityType = args?.facility_type;
        const date = args?.date || new Date().toISOString().split("T")[0];
        let query = supabase
          .from("benefit_slots")
          .select("id, slot_date, start_time, end_time, capacity, booked_count, benefit_type, facilities(name)")
          .eq("slot_date", date)
          .eq("is_active", true);
        if (facilityType) {
          query = query.ilike("benefit_type", `%${facilityType}%`);
        }
        const { data } = await query.order("start_time").limit(20);
        result = { slots: data || [] };
        break;
      }

      case "get_pt_balance": {
        const memberId = args?.member_id;
        if (!memberId) { result = { error: "member_id required in arguments" }; break; }
        const { data } = await supabase
          .from("member_pt_packages")
          .select("id, sessions_total, sessions_remaining, expiry_date, status, pt_packages(name)")
          .eq("member_id", memberId)
          .in("status", ["active"]);
        result = { packages: data || [] };
        break;
      }

      default:
        result = { error: `Tool '${tool_name}' is not available for manual testing. Only read-only tools are supported.` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("test-ai-tool error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
