// Full DB JSON backup import — owner/admin only.
// Strategy: upsert by primary key (id). Skips auth.users / storage.
// Tables are restored in dependency order (parents before children).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Restore order: parents first to satisfy FKs.
const RESTORE_ORDER = [
  "branches", "branch_settings", "branch_managers", "staff_branches",
  "profiles", "user_roles",
  "membership_plans", "plan_benefits",
  "benefit_types", "benefit_packages", "benefit_settings",
  "members", "memberships",
  "employees", "trainers", "trainer_availability",
  "contract_templates", "contracts",
  "leads", "follow_ups",
  "classes",
  "pt_packages", "member_pt_packages", "pt_sessions", "trainer_commissions",
  "diet_plans",
  "income_categories", "expense_categories",
  "discount_codes",
  "invoices", "invoice_items", "wallets", "wallet_transactions", "payments", "expenses",
  "product_categories", "products", "ecommerce_orders",
  "lockers",
  "equipment", "equipment_maintenance",
  "facilities", "benefit_slots", "benefit_bookings", "benefit_usage",
  "class_bookings", "class_waitlist",
  "announcements", "ad_banners",
  "feedback", "tasks",
  "templates", "whatsapp_triggers", "communication_logs",
  "notifications",
  "referrals",
  "rewards_ledger",
  "approval_requests",
  "ai_tool_logs",
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

    const payload = await req.json();
    if (!payload?.data || typeof payload.data !== "object") {
      return new Response(JSON.stringify({ error: "Invalid backup file (missing 'data' object)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dryRun = payload.dry_run === true;
    const conflictStrategy = payload.conflict_strategy || "skip"; // 'skip' | 'overwrite'
    const summary: Record<string, { inserted: number; updated: number; skipped: number; errors: string[] }> = {};

    for (const table of RESTORE_ORDER) {
      const entry = payload.data[table];
      if (!entry?.rows || !Array.isArray(entry.rows)) continue;
      const rows = entry.rows;
      const stat = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

      if (dryRun) {
        stat.skipped = rows.length;
        summary[table] = stat;
        continue;
      }

      // Process in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        try {
          if (conflictStrategy === "overwrite") {
            const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
            if (error) stat.errors.push(error.message);
            else stat.updated += chunk.length;
          } else {
            const { data, error } = await supabase
              .from(table)
              .upsert(chunk, { onConflict: "id", ignoreDuplicates: true })
              .select("id");
            if (error) stat.errors.push(error.message);
            else stat.inserted += (data?.length ?? 0);
          }
        } catch (e: any) {
          stat.errors.push(e.message);
        }
      }
      summary[table] = stat;
    }

    return new Response(JSON.stringify({ success: true, dry_run: dryRun, summary }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("backup-import error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
