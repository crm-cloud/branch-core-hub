import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-phonepe-signature, x-verify",
};

// Validation constants
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAYLOAD_SIZE = 102400; // 100KB
const ALLOWED_GATEWAYS = ['razorpay', 'phonepe'];

interface RazorpayPaymentEntity {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id: string | null;
  method: string;
  captured: boolean;
  notes: Record<string, string>;
}

interface PhonePeWebhookPayload {
  merchantId: string;
  merchantTransactionId: string;
  transactionId: string;
  amount: number;
  state: string;
  responseCode: string;
  paymentInstrument: {
    type: string;
    utr?: string;
  };
}

// Validate UUID format
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// Validate gateway
function isValidGateway(gateway: string): boolean {
  return ALLOWED_GATEWAYS.includes(gateway.toLowerCase());
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check request size
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_PAYLOAD_SIZE) {
      console.error("Request payload too large:", contentLength);
      return new Response(
        JSON.stringify({ error: "Request too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const gateway = url.searchParams.get("gateway") || "razorpay";
    const branchId = url.searchParams.get("branch_id");

    // Validate gateway
    if (!isValidGateway(gateway)) {
      console.error("Invalid gateway specified:", gateway);
      return new Response(
        JSON.stringify({ error: "Invalid payment gateway" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate branch_id format
    if (!branchId) {
      return new Response(
        JSON.stringify({ error: "branch_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUUID(branchId)) {
      console.error("Invalid branch_id format:", branchId);
      return new Response(
        JSON.stringify({ error: "Invalid branch_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify branch exists before processing
    const { data: branchExists } = await supabase
      .from("branches")
      .select("id")
      .eq("id", branchId)
      .single();

    if (!branchExists) {
      console.error("Branch not found:", branchId);
      return new Response(
        JSON.stringify({ error: "Branch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    
    // Parse JSON safely
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      console.error("Invalid JSON payload");
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${gateway} webhook for branch ${branchId}`);

    // Get integration settings for verification
    const { data: integration } = await supabase
      .from("integration_settings")
      .select("credentials")
      .eq("branch_id", branchId)
      .eq("integration_type", "payment_gateway")
      .eq("provider", gateway)
      .eq("is_active", true)
      .single();

    if (!integration) {
      console.error("No active integration found");
      return new Response(
        JSON.stringify({ error: "Integration not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let transactionData: {
      gateway_order_id: string;
      gateway_payment_id: string;
      amount: number;
      status: string;
      webhook_data: unknown;
    };

    if (gateway === "razorpay") {
      // Verify Razorpay signature
      const razorpaySignature = req.headers.get("x-razorpay-signature");
      const webhookSecret = integration.credentials?.webhook_secret;

      if (webhookSecret && razorpaySignature) {
        const expectedSignature = await generateHmacSha256(body, webhookSecret);
        if (razorpaySignature !== expectedSignature) {
          console.error("Invalid Razorpay signature");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (webhookSecret && !razorpaySignature) {
        console.error("Missing Razorpay signature when webhook secret is configured");
        return new Response(
          JSON.stringify({ error: "Missing signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const event = payload.event;
      const paymentEntity = payload.payload?.payment?.entity as RazorpayPaymentEntity;

      if (!paymentEntity) {
        return new Response(JSON.stringify({ status: "ignored" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let status = "created";
      if (event === "payment.captured") status = "captured";
      else if (event === "payment.authorized") status = "authorized";
      else if (event === "payment.failed") status = "failed";

      transactionData = {
        gateway_order_id: paymentEntity.order_id,
        gateway_payment_id: paymentEntity.id,
        amount: paymentEntity.amount / 100, // Razorpay sends in paise
        status,
        webhook_data: payload,
      };
    } else if (gateway === "phonepe") {
      // Verify PhonePe signature
      const phonePeSignature = req.headers.get("x-verify");
      const saltKey = integration.credentials?.salt_key;
      const saltIndex = integration.credentials?.salt_index || "1";

      if (saltKey && phonePeSignature) {
        const base64Body = btoa(body);
        const stringToSign = base64Body + "/pg/v1/status/" + saltKey;
        const expectedChecksum = await sha256(stringToSign) + "###" + saltIndex;
        
        if (phonePeSignature !== expectedChecksum) {
          console.error("Invalid PhonePe signature");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (saltKey && !phonePeSignature) {
        console.error("Missing PhonePe signature when salt key is configured");
        return new Response(
          JSON.stringify({ error: "Missing signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = payload.data as PhonePeWebhookPayload;
      let status = "created";
      if (data.state === "COMPLETED") status = "captured";
      else if (data.state === "FAILED") status = "failed";
      else if (data.state === "PENDING") status = "authorized";

      transactionData = {
        gateway_order_id: data.merchantTransactionId,
        gateway_payment_id: data.transactionId,
        amount: data.amount / 100, // PhonePe sends in paise
        status,
        webhook_data: payload,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported gateway" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find existing transaction
    const { data: existingTxn } = await supabase
      .from("payment_transactions")
      .select("id, invoice_id")
      .eq("gateway_order_id", transactionData.gateway_order_id)
      .single();

    if (existingTxn) {
      // Update existing transaction
      await supabase
        .from("payment_transactions")
        .update({
          gateway_payment_id: transactionData.gateway_payment_id,
          status: transactionData.status,
          webhook_data: transactionData.webhook_data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTxn.id);

      // If payment captured, update invoice and create payment record
      if (transactionData.status === "captured" && existingTxn.invoice_id) {
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            amount_paid: transactionData.amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingTxn.invoice_id);

        // Get invoice details for payment record
        const { data: invoice } = await supabase
          .from("invoices")
          .select("member_id, branch_id")
          .eq("id", existingTxn.invoice_id)
          .single();

        if (invoice) {
          await supabase.from("payments").insert({
            branch_id: invoice.branch_id,
            member_id: invoice.member_id,
            invoice_id: existingTxn.invoice_id,
            amount: transactionData.amount,
            payment_method: "online",
            status: "completed",
            transaction_id: transactionData.gateway_payment_id,
          });
        }
      }
    } else {
      // Create new transaction record
      await supabase.from("payment_transactions").insert({
        branch_id: branchId,
        gateway,
        ...transactionData,
      });
    }

    console.log(`Webhook processed successfully: ${transactionData.gateway_payment_id}`);

    return new Response(
      JSON.stringify({ status: "success" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}