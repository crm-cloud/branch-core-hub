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

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const results = {
      payment_reminders: 0,
      birthday_wishes: 0,
      membership_expiry: 0,
      class_reminders: 0,
      pt_reminders: 0,
      benefit_reminders: 0,
      inactive_member_alerts: 0,
    };
    const notifications: any[] = [];
    const commLogs: any[] = [];

    // 1. Payment reminders
    const { data: pendingReminders } = await adminClient
      .from("payment_reminders")
      .select("*, members:member_id (user_id, member_code, branch_id, profiles:user_id (full_name, phone, email))")
      .eq("status", "pending")
      .lte("scheduled_for", now.toISOString());

    for (const reminder of pendingReminders || []) {
      const member = reminder.members as any;
      if (!member?.user_id) continue;
      const name = member.profiles?.full_name || "Member";
      notifications.push({
        user_id: member.user_id, branch_id: reminder.branch_id, title: "Payment Reminder",
        message: `Hi ${name}, your payment is ${reminder.reminder_type === "before_due" ? "due soon" : reminder.reminder_type === "on_due" ? "due today" : "overdue"}.`,
        type: "warning", category: "payment", action_url: "/member/invoices",
      });
      commLogs.push({
        branch_id: reminder.branch_id, type: "notification",
        recipient: member.profiles?.email || member.profiles?.phone || member.member_code,
        subject: "Payment Reminder", content: `Payment ${reminder.reminder_type} reminder for ${name}`,
        status: "sent", member_id: reminder.member_id, sent_at: now.toISOString(),
      });
      await adminClient.from("payment_reminders").update({ status: "sent", sent_at: now.toISOString() }).eq("id", reminder.id);
      results.payment_reminders++;
    }

    // 2. Birthday wishes
    const { data: birthdayProfiles } = await adminClient.from("profiles").select("id, full_name, date_of_birth, email, phone");
    for (const profile of birthdayProfiles || []) {
      if (!profile.date_of_birth) continue;
      const dob = new Date(profile.date_of_birth);
      if (dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate()) {
        const { count } = await adminClient.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("category", "birthday").gte("created_at", today + "T00:00:00");
        if ((count || 0) > 0) continue;
        notifications.push({ user_id: profile.id, title: "🎂 Happy Birthday!", message: `Happy Birthday, ${profile.full_name || ""}! Wishing you a great day!`, type: "info", category: "birthday" });
        results.birthday_wishes++;
      }
    }

    // 3. Membership expiry reminders (7, 3, 1 day before)
    for (const daysOut of [7, 3, 1]) {
      const targetDate = daysOut === 7 ? sevenDaysFromNow : daysOut === 3 ? threeDaysFromNow : oneDayFromNow;
      const { data: expiringMemberships } = await adminClient
        .from("memberships")
        .select("id, member_id, end_date, branch_id, members:member_id (user_id, member_code, profiles:user_id (full_name, phone, email)), membership_plans:plan_id (name)")
        .eq("status", "active").eq("end_date", targetDate);

      for (const ms of expiringMemberships || []) {
        const member = ms.members as any;
        if (!member?.user_id) continue;
        const { count } = await adminClient.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", member.user_id).eq("category", "membership").ilike("message", `%${daysOut} day%`).gte("created_at", today + "T00:00:00");
        if ((count || 0) > 0) continue;
        const planName = (ms.membership_plans as any)?.name || "your plan";
        notifications.push({
          user_id: member.user_id, branch_id: ms.branch_id, title: "Membership Expiring Soon",
          message: `Hi ${member.profiles?.full_name || "Member"}, your membership (${planName}) expires in ${daysOut} day${daysOut > 1 ? "s" : ""}. Renew now.`,
          type: "warning", category: "membership", action_url: "/member/plans",
        });
        commLogs.push({
          branch_id: ms.branch_id, type: "notification",
          recipient: member.profiles?.email || member.profiles?.phone || member.member_code,
          subject: "Membership Expiry Reminder", content: `${planName} expires in ${daysOut} days for ${member.profiles?.full_name}`,
          status: "sent", member_id: ms.member_id, sent_at: now.toISOString(),
        });
        results.membership_expiry++;
      }
    }

    // 4. Class reminders (tomorrow)
    const { data: tomorrowClasses } = await adminClient
      .from("class_bookings")
      .select("id, member_id, class_id, classes:class_id (name, scheduled_at, branch_id), members:member_id (user_id, profiles:user_id (full_name))")
      .eq("status", "booked");
    for (const booking of tomorrowClasses || []) {
      const cls = booking.classes as any;
      if (!cls?.scheduled_at || cls.scheduled_at.split("T")[0] !== tomorrow) continue;
      const member = booking.members as any;
      if (!member?.user_id) continue;
      notifications.push({ user_id: member.user_id, branch_id: cls.branch_id, title: "Class Tomorrow", message: `Reminder: You have "${cls.name}" scheduled for tomorrow.`, type: "info", category: "class", action_url: "/member/classes" });
      results.class_reminders++;
    }

    // 5. PT session reminders (tomorrow)
    const { data: tomorrowPT } = await adminClient
      .from("pt_sessions")
      .select("id, member_pt_package_id, trainer_id, scheduled_at, member_pt_packages:member_pt_package_id (member_id, branch_id, members:member_id (user_id, profiles:user_id (full_name)))")
      .eq("status", "scheduled").gte("scheduled_at", tomorrow + "T00:00:00").lt("scheduled_at", tomorrow + "T23:59:59");
    for (const session of tomorrowPT || []) {
      const pkg = session.member_pt_packages as any;
      const member = pkg?.members;
      if (!member?.user_id) continue;
      notifications.push({ user_id: member.user_id, branch_id: pkg.branch_id, title: "PT Session Tomorrow", message: `Reminder: You have a Personal Training session scheduled for tomorrow.`, type: "info", category: "pt_session", action_url: "/member/pt-sessions" });
      results.pt_reminders++;
    }

    // 6. Benefit booking reminders (tomorrow)
    const { data: tomorrowBenefits } = await adminClient
      .from("benefit_bookings")
      .select("id, member_id, slot_id, benefit_slots:slot_id (slot_date, start_time, branch_id, benefit_type), members:member_id (user_id, profiles:user_id (full_name))")
      .eq("status", "booked");
    for (const booking of tomorrowBenefits || []) {
      const slot = booking.benefit_slots as any;
      if (!slot || slot.slot_date !== tomorrow) continue;
      const member = booking.members as any;
      if (!member?.user_id) continue;
      notifications.push({ user_id: member.user_id, branch_id: slot.branch_id, title: "Benefit Booking Tomorrow", message: `Reminder: You have a ${slot.benefit_type} booking tomorrow at ${slot.start_time}.`, type: "info", category: "benefit", action_url: "/member/benefits" });
      results.benefit_reminders++;
    }

    // 7. Inactive member alerts (no visit in 7+ days)
    try {
      const { data: branches } = await adminClient.from("branches").select("id").eq("is_active", true);
      for (const branch of branches || []) {
        const { data: inactiveMembers } = await adminClient.rpc("get_inactive_members", {
          p_branch_id: branch.id,
          p_days: 7,
          p_limit: 20,
        });

        for (const member of inactiveMembers || []) {
          // Check if we already sent this alert today
          const { count } = await adminClient.from("notifications").select("id", { count: "exact", head: true })
            .eq("category", "retention").ilike("message", `%${member.member_code}%`).gte("created_at", today + "T00:00:00");
          if ((count || 0) > 0) continue;

          // Notify admin/staff about inactive member
          const { data: staffUsers } = await adminClient.from("user_roles").select("user_id").in("role", ["owner", "admin", "staff"]);
          for (const staff of staffUsers || []) {
            notifications.push({
              user_id: staff.user_id, branch_id: branch.id,
              title: "Inactive Member Alert",
              message: `${member.full_name} (${member.member_code}) hasn't visited in ${member.days_absent || '7+'} days. Consider reaching out for retention.`,
              type: "warning", category: "retention",
            });
          }

          // Notify the member themselves
          const { data: memberRow } = await adminClient.from("members").select("user_id").eq("id", member.member_id).single();
          if (memberRow?.user_id) {
            notifications.push({
              user_id: memberRow.user_id, branch_id: branch.id,
              title: "We Miss You! 💪",
              message: `Hi ${member.full_name}, we haven't seen you in a while! Come visit the gym today and keep your fitness goals on track.`,
              type: "info", category: "retention", action_url: "/member/dashboard",
            });
          }

          results.inactive_member_alerts++;
        }
      }
    } catch (err) {
      console.error("Inactive member alerts error:", err);
    }

    // Bulk insert notifications
    if (notifications.length > 0) {
      const { error: notifErr } = await adminClient.from("notifications").insert(notifications);
      if (notifErr) console.error("Notification insert error:", notifErr);
    }

    if (commLogs.length > 0) {
      const { error: logErr } = await adminClient.from("communication_logs").insert(commLogs);
      if (logErr) console.error("Comm log insert error:", logErr);
    }

    const totalProcessed = Object.values(results).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({ success: true, total_processed: totalProcessed, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Reminders error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
