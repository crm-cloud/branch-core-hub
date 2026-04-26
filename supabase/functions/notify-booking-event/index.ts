// notify-booking-event v1.0
// Dispatches WhatsApp / SMS / Email / in-app notifications when a benefit slot
// booking is created or cancelled. Called fire-and-forget from
// book_facility_slot / cancel_facility_slot RPCs (and may be invoked from UI).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EventName = "facility_slot_booked" | "facility_slot_cancelled";

const DEFAULT_TEMPLATES: Record<EventName, string> = {
  facility_slot_booked:
    "Hi {{member_name}}, your {{benefit_name}} slot is booked for {{slot_date}} at {{slot_time}} at {{branch_name}}. See you there!",
  facility_slot_cancelled:
    "Hi {{member_name}}, your {{benefit_name}} booking for {{slot_date}} at {{slot_time}} has been cancelled.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event, booking_id } = await req.json();
    if (!event || !booking_id) {
      return json({ error: "Missing event or booking_id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Load booking + slot + member + branch
    const { data: booking, error: bErr } = await supabase
      .from("benefit_bookings")
      .select(`
        id, status, member_id,
        slot:benefit_slots(id, slot_date, start_time, end_time, branch_id, benefit_type, benefit_type_id, facility_id)
      `)
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

    const slot = booking.slot as any;
    if (!slot) return json({ error: "Slot not found" }, 404);

    const branchId = slot.branch_id;

    // 2. Member contact info
    const { data: member } = await supabase
      .from("members")
      .select("user_id, member_code, profiles:user_id (full_name, phone, email)")
      .eq("id", booking.member_id)
      .single();
    const memberProfile = (member as any)?.profiles;
    if (!member?.user_id) return json({ error: "Member profile missing" }, 404);

    // 3. Branch + benefit name
    const [{ data: branch }, { data: benefitType }, { data: facility }] = await Promise.all([
      supabase.from("branches").select("name").eq("id", branchId).single(),
      slot.benefit_type_id
        ? supabase.from("benefit_types").select("name").eq("id", slot.benefit_type_id).single()
        : Promise.resolve({ data: null } as any),
      slot.facility_id
        ? supabase.from("facilities").select("name").eq("id", slot.facility_id).single()
        : Promise.resolve({ data: null } as any),
    ]);

    // 4. Resolve trigger config
    const { data: trigger } = await supabase
      .from("whatsapp_triggers")
      .select("template_id, is_active")
      .eq("branch_id", branchId)
      .eq("event_name", event)
      .maybeSingle();

    if (trigger && trigger.is_active === false) {
      return json({ success: true, skipped: true, reason: "trigger_disabled" });
    }

    // 5. Resolve template body
    let body = DEFAULT_TEMPLATES[event as EventName] || "";
    if (trigger?.template_id) {
      const { data: tmpl } = await supabase
        .from("whatsapp_templates")
        .select("body_text")
        .eq("id", trigger.template_id)
        .maybeSingle();
      if (tmpl?.body_text) body = tmpl.body_text;
    }

    const benefitName = benefitType?.name || facility?.name || slot.benefit_type || "your session";
    const placeholders: Record<string, string> = {
      "{{member_name}}": memberProfile?.full_name || "Member",
      "{{benefit_name}}": benefitName,
      "{{slot_date}}": slot.slot_date,
      "{{slot_time}}": (slot.start_time || "").slice(0, 5),
      "{{branch_name}}": branch?.name || "Our Gym",
    };
    for (const [k, v] of Object.entries(placeholders)) {
      body = body.split(k).join(v);
    }

    const subject =
      event === "facility_slot_booked" ? "Booking Confirmed" : "Booking Cancelled";

    const results: any[] = [];

    // 6. In-app notification
    try {
      await supabase.from("notifications").insert({
        user_id: member.user_id,
        branch_id: branchId,
        title: subject,
        message: body,
        type: event === "facility_slot_booked" ? "success" : "info",
        category: "benefit",
        action_url: "/my-benefits",
      });
      results.push({ channel: "notification", success: true });
    } catch (e) {
      results.push({ channel: "notification", success: false, error: String(e) });
    }

    // 7. WhatsApp
    if (memberProfile?.phone) {
      try {
        const r = await supabase.functions.invoke("send-whatsapp", {
          body: { branchId, memberId: booking.member_id, phone: memberProfile.phone, message: body, subject },
        });
        results.push({ channel: "whatsapp", success: !r.error, error: r.error?.message });
      } catch (e) {
        results.push({ channel: "whatsapp", success: false, error: String(e) });
      }
    }

    // 8. Email (only if address exists)
    if (memberProfile?.email) {
      try {
        const r = await supabase.functions.invoke("send-email", {
          body: { branchId, memberId: booking.member_id, to: memberProfile.email, subject, message: body },
        });
        results.push({ channel: "email", success: !r.error, error: r.error?.message });
      } catch (e) {
        results.push({ channel: "email", success: false, error: String(e) });
      }
    }

    // 9. Audit log
    try {
      await supabase.from("communication_logs").insert({
        branch_id: branchId,
        type: "whatsapp",
        recipient: memberProfile?.phone || memberProfile?.email || (member as any).member_code,
        content: body.slice(0, 500),
        status: results.some((r) => r.success) ? "sent" : "failed",
        delivery_metadata: { event, booking_id, results },
      });
    } catch (_) { /* best effort */ }

    return json({ success: true, sent: results.filter((r) => r.success).length, results });
  } catch (e) {
    console.error("notify-booking-event error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
