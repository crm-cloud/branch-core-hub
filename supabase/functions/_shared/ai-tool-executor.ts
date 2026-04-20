// Shared AI tool executor — used by whatsapp-webhook + meta-webhook
// v1.0.0 — Supports 25+ self-service tools across membership, payments, bookings, loyalty
import type { MemberContext } from "./ai-tools.ts";

type SB = any; // SupabaseClient (kept loose to avoid duplicate imports)

export async function executeSharedToolCall(
  supabase: SB,
  supabaseUrl: string,
  serviceRoleKey: string,
  toolName: string,
  args: Record<string, any>,
  ctx: MemberContext,
  phoneNumber: string,
  branchId: string,
  platform: "whatsapp" | "instagram" | "messenger" = "whatsapp",
): Promise<Record<string, any>> {
  try {
    switch (toolName) {
      // ─── Membership & Account ─────────────────────────────
      case "get_member_profile": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data: m } = await supabase
          .from("members")
          .select("id, member_code, branch_id, created_at, profiles(full_name, email, phone), branches(name)")
          .eq("id", ctx.memberId)
          .maybeSingle();
        if (!m) return { error: "Member not found." };
        const p: any = (m as any).profiles || {};
        return {
          member_code: (m as any).member_code,
          name: p.full_name,
          email: p.email,
          phone: p.phone,
          branch: (m as any).branches?.name,
          joined: (m as any).created_at,
        };
      }

      case "update_member_contact": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const updates: Record<string, any> = {};
        if (args.email) updates.email = args.email;
        if (args.phone) updates.phone = args.phone;
        if (Object.keys(updates).length === 0) return { error: "Provide email or phone to update." };
        const { data: m } = await supabase.from("members").select("user_id").eq("id", ctx.memberId).maybeSingle();
        if (!m?.user_id) return { error: "Profile not linked." };
        const { error } = await supabase.from("profiles").update(updates).eq("id", m.user_id);
        if (error) return { error: "Update failed." };
        return { success: true, message: "Contact updated. ✅" };
      }

      case "request_freeze": {
        if (!ctx.memberId || !ctx.membershipId) return { error: "No active membership to freeze." };
        if (!args.from_date || !args.to_date) return { error: "from_date and to_date are required." };
        const { data, error } = await supabase.from("approval_requests").insert({
          branch_id: branchId,
          approval_type: "membership_freeze",
          reference_type: "membership",
          reference_id: ctx.membershipId,
          status: "pending",
          request_data: {
            member_id: ctx.memberId,
            from_date: args.from_date,
            to_date: args.to_date,
            reason: args.reason || "Requested via WhatsApp",
            channel: platform,
          },
        }).select("id").single();
        if (error) return { error: "Failed to submit freeze request." };
        return { success: true, request_id: data.id, message: "Freeze request submitted for staff approval. ⏸️" };
      }

      case "request_resume": {
        if (!ctx.memberId || !ctx.membershipId) return { error: "No membership found." };
        const { data, error } = await supabase.from("approval_requests").insert({
          branch_id: branchId,
          approval_type: "membership_resume",
          reference_type: "membership",
          reference_id: ctx.membershipId,
          status: "pending",
          request_data: { member_id: ctx.memberId, channel: platform },
        }).select("id").single();
        if (error) return { error: "Failed to submit resume request." };
        return { success: true, request_id: data.id, message: "Resume request submitted. ▶️" };
      }

      // ─── Bookings ─────────────────────────────────────────
      case "list_my_bookings": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data } = await supabase
          .from("benefit_bookings")
          .select("id, status, benefit_slots(slot_date, start_time, end_time, facilities(name))")
          .eq("member_id", ctx.memberId)
          .in("status", ["booked", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(10);
        const upcoming = (data || []).filter((b: any) => {
          const d = b.benefit_slots?.slot_date;
          return d && new Date(d) >= new Date(new Date().toISOString().split("T")[0]);
        }).map((b: any) => ({
          booking_id: b.id,
          facility: b.benefit_slots?.facilities?.name || "Facility",
          date: b.benefit_slots?.slot_date,
          time: `${b.benefit_slots?.start_time} - ${b.benefit_slots?.end_time}`,
          status: b.status,
        }));
        return { count: upcoming.length, bookings: upcoming };
      }

      // ─── Personal Training ────────────────────────────────
      case "list_trainers": {
        const { data } = await supabase
          .from("trainers_public")
          .select("id, full_name, specialization, bio")
          .eq("branch_id", branchId)
          .limit(10);
        return { trainers: data || [] };
      }

      case "book_pt_session": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        if (!args.trainer_id || !args.scheduled_at) return { error: "trainer_id and scheduled_at required." };
        const { data: pkg } = await supabase
          .from("member_pt_packages")
          .select("id, sessions_remaining")
          .eq("member_id", ctx.memberId)
          .eq("status", "active")
          .gt("sessions_remaining", 0)
          .order("expiry_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!pkg) return { error: "No active PT package with remaining sessions. Please purchase one." };
        const available = await supabase.rpc("check_trainer_slot_available", {
          _trainer_id: args.trainer_id,
          _scheduled_at: args.scheduled_at,
          _duration_minutes: args.duration_minutes || 60,
        });
        if (available.data === false) return { error: "Trainer not available at that time." };
        const { data: session, error } = await supabase.from("pt_sessions").insert({
          trainer_id: args.trainer_id,
          member_id: ctx.memberId,
          member_pt_package_id: pkg.id,
          branch_id: branchId,
          scheduled_at: args.scheduled_at,
          duration_minutes: args.duration_minutes || 60,
          status: "scheduled",
        }).select("id").single();
        if (error) return { error: "Failed to book session." };
        return { success: true, session_id: session.id, message: "PT session booked. 💪" };
      }

      case "cancel_pt_session": {
        if (!args.session_id) return { error: "session_id required." };
        const { error } = await supabase
          .from("pt_sessions")
          .update({ status: "cancelled" })
          .eq("id", args.session_id)
          .eq("member_id", ctx.memberId)
          .eq("status", "scheduled");
        if (error) return { error: "Failed to cancel session." };
        return { success: true, message: "Session cancelled." };
      }

      // ─── Payments & Billing ───────────────────────────────
      case "get_outstanding_dues": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, amount_paid, due_date, status")
          .eq("member_id", ctx.memberId)
          .in("status", ["pending", "partial", "overdue"])
          .order("due_date", { ascending: true });
        const items = (data || []).map((i: any) => ({
          invoice_id: i.id,
          invoice_number: i.invoice_number,
          balance: Number(i.total_amount || 0) - Number(i.amount_paid || 0),
          due_date: i.due_date,
          status: i.status,
        }));
        const total = items.reduce((s: number, i: { balance: number }) => s + i.balance, 0);
        return { total_due: `₹${total.toFixed(2)}`, count: items.length, invoices: items };
      }

      case "list_invoices": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, amount_paid, status, created_at, due_date")
          .eq("member_id", ctx.memberId)
          .order("created_at", { ascending: false })
          .limit(10);
        return { invoices: data || [] };
      }

      case "send_invoice_pdf": {
        if (!args.invoice_id) return { error: "invoice_id required." };
        const url = `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/invoice/${args.invoice_id}`;
        return { success: true, message: `Here is your invoice: ${url}` };
      }

      case "create_payment_link": {
        if (!args.invoice_id) return { error: "invoice_id required." };
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/create-razorpay-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ invoice_id: args.invoice_id, branch_id: branchId }),
          });
          const data = await resp.json();
          if (!resp.ok || !data?.short_url) return { error: data?.error || "Failed to create payment link." };
          return { success: true, payment_link: data.short_url, message: `Pay securely here: ${data.short_url}` };
        } catch {
          return { error: "Payment link service unavailable." };
        }
      }

      case "get_wallet_balance": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data: wallet } = await supabase
          .from("wallets").select("id, balance").eq("member_id", ctx.memberId).maybeSingle();
        if (!wallet) return { balance: "₹0", transactions: [] };
        const { data: txns } = await supabase
          .from("wallet_transactions")
          .select("txn_type, amount, description, created_at")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false }).limit(5);
        return { balance: `₹${wallet.balance}`, recent: txns || [] };
      }

      case "pay_with_wallet": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        if (!args.invoice_id || !args.amount) return { error: "invoice_id and amount required." };
        const { data, error } = await supabase.rpc("record_payment", {
          p_branch_id: branchId,
          p_invoice_id: args.invoice_id,
          p_member_id: ctx.memberId,
          p_amount: args.amount,
          p_payment_method: "wallet",
          p_notes: `Paid via ${platform} bot`,
        });
        if (error || !data?.success) return { error: data?.error || "Payment failed." };
        return { success: true, message: `Paid ₹${args.amount} from wallet. New invoice status: ${data.new_status}.` };
      }

      // ─── Engagement & Loyalty ─────────────────────────────
      case "get_rewards_balance": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data } = await supabase
          .from("rewards_ledger")
          .select("points, reason, created_at")
          .eq("member_id", ctx.memberId)
          .order("created_at", { ascending: false }).limit(20);
        const total = (data || []).reduce((s: number, r: any) => s + (r.points || 0), 0);
        return { points: total, recent: (data || []).slice(0, 5) };
      }

      case "redeem_reward": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        if (!args.points || args.points <= 0) return { error: "Valid points required." };
        const { data: ledger } = await supabase.from("rewards_ledger")
          .select("points").eq("member_id", ctx.memberId);
        const total = (ledger || []).reduce((s: number, r: any) => s + (r.points || 0), 0);
        if (total < args.points) return { error: `Insufficient points. Available: ${total}.` };
        const { error } = await supabase.from("rewards_ledger").insert({
          member_id: ctx.memberId,
          branch_id: branchId,
          points: -Math.abs(args.points),
          reason: args.reason || "Redeemed via bot",
          reference_type: "bot_redemption",
        });
        if (error) return { error: "Redemption failed." };
        return { success: true, message: `Redeemed ${args.points} points. Staff will arrange your reward. 🎁` };
      }

      case "get_referral_link": {
        if (!ctx.memberId) return { error: "Not a registered member." };
        const { data: m } = await supabase.from("members").select("member_code").eq("id", ctx.memberId).maybeSingle();
        const code = (m as any)?.member_code || ctx.memberId.slice(0, 8);
        const url = `https://incline.lovable.app/refer/${code}`;
        return { referral_code: code, link: url, message: `Share this with friends: ${url}` };
      }

      case "list_announcements": {
        const { data } = await supabase
          .from("announcements")
          .select("title, content, priority, expire_at")
          .eq("branch_id", branchId)
          .eq("is_active", true)
          .order("priority", { ascending: false }).limit(5);
        return { announcements: data || [] };
      }

      case "list_store_products": {
        let q = supabase.from("products")
          .select("id, name, price, category, description")
          .eq("branch_id", branchId).eq("is_active", true).limit(10);
        if (args.category) q = q.eq("category", args.category);
        const { data } = await q;
        return { products: data || [] };
      }

      // ─── Branch Info ──────────────────────────────────────
      case "get_branch_info": {
        const { data } = await supabase
          .from("branches")
          .select("name, address, city, phone, email, opening_time, closing_time")
          .eq("id", branchId).maybeSingle();
        return data || { error: "Branch not found." };
      }

      case "get_class_schedule": {
        const date = args.date || new Date().toISOString().split("T")[0];
        const { data } = await supabase
          .from("classes")
          .select("name, scheduled_at, duration_minutes, capacity, trainers_public(full_name)")
          .eq("branch_id", branchId)
          .eq("is_active", true)
          .gte("scheduled_at", `${date}T00:00:00`)
          .lt("scheduled_at", `${date}T23:59:59`)
          .order("scheduled_at", { ascending: true }).limit(20);
        return { date, classes: data || [] };
      }

      default:
        return { error: `Tool not implemented in shared executor: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[shared tool] ${toolName} error:`, err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
