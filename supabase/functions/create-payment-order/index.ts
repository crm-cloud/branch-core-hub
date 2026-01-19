import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoiceId, gateway, branchId } = await req.json();

    if (!invoiceId || !gateway || !branchId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, member:members(user_id)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountDue = invoice.total_amount - (invoice.amount_paid || 0);
    if (amountDue <= 0) {
      return new Response(
        JSON.stringify({ error: "Invoice already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payment gateway settings
    const { data: gatewaySettings, error: settingsError } = await supabase
      .from("integration_settings")
      .select("*")
      .eq("branch_id", branchId)
      .eq("integration_type", "payment")
      .eq("provider", gateway)
      .eq("is_active", true)
      .single();

    if (settingsError || !gatewaySettings) {
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let orderResponse: any = {
      orderId: `ORD-${Date.now()}`,
      amount: amountDue,
      currency: "INR",
      invoiceId,
      gateway,
    };

    // Create order based on gateway
    if (gateway === "razorpay") {
      const credentials = gatewaySettings.credentials as { key_id?: string; key_secret?: string } || {};
      const razorpayKeyId = credentials.key_id || Deno.env.get("RAZORPAY_KEY_ID");
      const razorpayKeySecret = credentials.key_secret || Deno.env.get("RAZORPAY_KEY_SECRET");

      if (!razorpayKeyId || !razorpayKeySecret) {
        return new Response(
          JSON.stringify({ error: "Razorpay credentials not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create Razorpay order
      const razorpayOrder = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        },
        body: JSON.stringify({
          amount: Math.round(amountDue * 100), // Amount in paise
          currency: "INR",
          receipt: invoice.invoice_number,
          notes: {
            invoice_id: invoiceId,
            branch_id: branchId,
          },
        }),
      });

      if (!razorpayOrder.ok) {
        const errorText = await razorpayOrder.text();
        console.error("Razorpay error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to create Razorpay order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const razorpayData = await razorpayOrder.json();
      orderResponse.gatewayOrderId = razorpayData.id;
      orderResponse.razorpayKey = razorpayKeyId;
    } else if (gateway === "phonepe") {
      // PhonePe integration
      const credentials = gatewaySettings.credentials as { merchant_id?: string; salt_key?: string; salt_index?: string } || {};
      const merchantId = credentials.merchant_id || Deno.env.get("PHONEPE_MERCHANT_ID");
      const saltKey = credentials.salt_key || Deno.env.get("PHONEPE_SALT_KEY");
      const saltIndex = credentials.salt_index || Deno.env.get("PHONEPE_SALT_INDEX") || "1";

      if (!merchantId || !saltKey) {
        return new Response(
          JSON.stringify({ error: "PhonePe credentials not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For PhonePe, return checkout URL
      orderResponse.checkoutUrl = `https://checkout.phonepe.com/pay/${merchantId}`;
    }

    // Record the payment transaction
    await supabase.from("payment_transactions").insert({
      invoice_id: invoiceId,
      branch_id: branchId,
      gateway,
      gateway_order_id: orderResponse.gatewayOrderId,
      amount: amountDue,
      currency: "INR",
      status: "pending",
    });

    return new Response(JSON.stringify(orderResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating payment order:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
