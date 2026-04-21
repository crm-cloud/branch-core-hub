// Full DB JSON backup export — owner/admin only.
// Returns a single JSON document containing rows from every CRM table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to back up (skip auth.* and storage.*)
const TABLES = [
  "branches", "branch_settings", "branch_managers", "staff_branches",
  "profiles", "user_roles",
  "members", "memberships", "membership_plans", "plan_benefits",
  "benefit_types", "benefit_packages", "benefit_settings", "benefit_slots",
  "benefit_bookings", "benefit_usage",
  "employees", "trainers", "trainer_availability", "trainer_commissions",
  "contracts", "contract_templates",
  "leads", "follow_ups",
  "classes", "class_bookings", "class_waitlist",
  "pt_packages", "member_pt_packages", "pt_sessions",
  "diet_plans", "diet_templates", "workout_plans", "workout_templates", "exercises",
  "invoices", "invoice_items", "payments", "wallets", "wallet_transactions",
  "expenses", "expense_categories", "income_categories",
  "discount_codes",
  "products", "product_categories",
  "ecommerce_orders",
  "lockers",
  "equipment", "equipment_maintenance",
  "facilities",
  "announcements", "ad_banners",
  "feedback",
  "tasks",
  "communication_logs", "templates", "whatsapp_triggers",
  "notifications",
  "referrals",
  "rewards_ledger",
  "approval_requests",
  "ai_plan_logs", "ai_tool_logs",
  "audit_logs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify caller and verify owner/admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "owner" || r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Owner/admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backup: Record<string, any> = {
      meta: {
        version: 1,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        tables: TABLES,
      },
      data: {},
    };

    for (const table of TABLES) {
      try {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.warn(`Skipped ${table}: ${error.message}`);
          backup.data[table] = { error: error.message, rows: [] };
        } else {
          backup.data[table] = { rows: data || [] };
        }
      } catch (e: any) {
        console.warn(`Failed ${table}: ${e.message}`);
        backup.data[table] = { error: e.message, rows: [] };
      }
    }

    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="incline-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e: any) {
    console.error("backup-export error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
