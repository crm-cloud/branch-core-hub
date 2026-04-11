// v1.0.0 — Razorpay Payment Link Generator
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { invoiceId, amount, branchId } = await req.json();

    if (!invoiceId || !amount || !branchId) {
      return new Response(
        JSON.stringify({ error: "invoiceId, amount, and branchId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch Razorpay credentials from integration_settings
    const { data: integration } = await supabase
      .from("integration_settings")
      .select("credentials, config")
      .eq("branch_id", branchId)
      .eq("integration_type", "payment_gateway")
      .eq("provider", "razorpay")
      .eq("is_active", true)
      .maybeSingle();

    if (!integration?.credentials?.key_id || !integration?.credentials?.key_secret) {
      return new Response(
        JSON.stringify({ error: "Razorpay not configured for this branch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyId = integration.credentials.key_id as string;
    const keySecret = integration.credentials.key_secret as string;

    // Fetch invoice + member details
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, amount_paid, member_id, branch_id")
      .eq("id", invoiceId)
      .single();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get member profile
    let customerName = "Member";
    let customerPhone = "";
    let customerEmail = "";

    if (invoice.member_id) {
      const { data: member } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", invoice.member_id)
        .single();

      if (member?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("id", member.user_id)
          .single();

        if (profile) {
          customerName = profile.full_name || "Member";
          customerPhone = (profile.phone || "").replace(/[^0-9]/g, "");
          if (customerPhone && !customerPhone.startsWith("91")) {
            customerPhone = "91" + customerPhone;
          }
          customerEmail = profile.email || "";
        }
      }
    }

    // Call Razorpay Payment Links API
    const amountInPaise = Math.round(amount * 100);
    const authHeader = btoa(`${keyId}:${keySecret}`);

    const razorpayPayload: any = {
      amount: amountInPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: invoiceId,
      description: `Payment for Invoice ${invoice.invoice_number || invoiceId}`,
      customer: {
        name: customerName,
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      callback_method: "get",
    };

    // Only add contact/email if available
    if (customerPhone) razorpayPayload.customer.contact = `+${customerPhone}`;
    if (customerEmail) razorpayPayload.customer.email = customerEmail;

    console.log("Creating Razorpay payment link for invoice:", invoiceId, "amount:", amountInPaise);

    const rzpResponse = await fetch("https://api.razorpay.com/v1/payment_links/", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(razorpayPayload),
    });

    const rzpResult = await rzpResponse.json();

    if (!rzpResponse.ok) {
      console.error("Razorpay API error:", JSON.stringify(rzpResult));
      return new Response(
        JSON.stringify({ error: rzpResult.error?.description || "Failed to create payment link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Razorpay payment link created:", rzpResult.short_url, "plink_id:", rzpResult.id);

    // Store in payment_transactions
    await supabase.from("payment_transactions").insert({
      branch_id: branchId,
      invoice_id: invoiceId,
      gateway: "razorpay",
      gateway_order_id: rzpResult.id,
      amount: amount,
      status: "created",
      webhook_data: { short_url: rzpResult.short_url, plink_id: rzpResult.id },
    });

    return new Response(
      JSON.stringify({
        short_url: rzpResult.short_url,
        plink_id: rzpResult.id,
        amount: amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("create-razorpay-link error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
