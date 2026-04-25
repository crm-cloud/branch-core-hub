// process-comm-retry-queue
// Picks up failed messages from communication_retry_queue and re-dispatches them
// via the existing send-email / send-sms / send-whatsapp edge functions.
// Uses exponential backoff: 5min -> 30min -> 2h, then marks as exhausted.
// Triggered by pg_cron every 5 minutes (and can be invoked manually).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MINUTES = [5, 30, 120]; // 5min, 30min, 2h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Optional manual single-row retry
    let manualId: string | null = null;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        manualId = body?.queue_id || null;
      }
    } catch { /* ignore */ }

    let query = supabase
      .from("communication_retry_queue")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(50);

    if (manualId) {
      query = supabase
        .from("communication_retry_queue")
        .select("*")
        .eq("id", manualId);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    if (!rows || rows.length === 0) {
      return json({ success: true, processed: 0, message: "No pending retries" });
    }

    const results: any[] = [];

    for (const row of rows) {
      // Mark processing (best effort — race-safe enough for this volume)
      await supabase
        .from("communication_retry_queue")
        .update({ status: "processing" })
        .eq("id", row.id)
        .eq("status", row.status);

      const fnName =
        row.type === "whatsapp" ? "send-whatsapp" :
        row.type === "sms"      ? "send-sms" :
        row.type === "email"    ? "send-email" : null;

      if (!fnName) {
        await supabase
          .from("communication_retry_queue")
          .update({ status: "exhausted", last_error: `Unknown channel type: ${row.type}` })
          .eq("id", row.id);
        results.push({ id: row.id, status: "exhausted", reason: "unknown_type" });
        continue;
      }

      // Build payload per channel
      const payload: Record<string, any> = {
        branch_id: row.branch_id,
        recipient: row.recipient,
        content: row.content,
        retry: true,
        original_log_id: row.original_log_id,
      };
      if (row.type === "email") {
        payload.to = row.recipient;
        payload.subject = row.subject || "(no subject)";
        payload.html = row.content;
      } else if (row.type === "whatsapp") {
        payload.to = row.recipient;
        payload.message = row.content;
        payload.phone = row.recipient;
      } else if (row.type === "sms") {
        payload.to = row.recipient;
        payload.phone = row.recipient;
        payload.message = row.content;
      }

      let success = false;
      let errorMsg = "";
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify(payload),
        });
        const text = await resp.text();
        if (resp.ok) {
          success = true;
        } else {
          errorMsg = `${fnName} ${resp.status}: ${text.slice(0, 300)}`;
        }
      } catch (e) {
        errorMsg = `dispatch error: ${e instanceof Error ? e.message : String(e)}`;
      }

      const newRetryCount = (row.retry_count || 0) + 1;

      if (success) {
        await supabase
          .from("communication_retry_queue")
          .update({
            status: "succeeded",
            retry_count: newRetryCount,
            succeeded_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", row.id);

        // Mark the original log as sent if we have it
        if (row.original_log_id) {
          await supabase
            .from("communication_logs")
            .update({ status: "sent", attempt_count: newRetryCount + 1 })
            .eq("id", row.original_log_id);
        }
        results.push({ id: row.id, status: "succeeded", attempts: newRetryCount });
      } else {
        if (newRetryCount >= (row.max_retries || 3)) {
          await supabase
            .from("communication_retry_queue")
            .update({
              status: "exhausted",
              retry_count: newRetryCount,
              last_error: errorMsg,
            })
            .eq("id", row.id);
          results.push({ id: row.id, status: "exhausted", error: errorMsg });
        } else {
          const backoffMin = BACKOFF_MINUTES[Math.min(newRetryCount, BACKOFF_MINUTES.length - 1)];
          const nextAt = new Date(Date.now() + backoffMin * 60_000).toISOString();
          await supabase
            .from("communication_retry_queue")
            .update({
              status: "pending",
              retry_count: newRetryCount,
              next_retry_at: nextAt,
              last_error: errorMsg,
            })
            .eq("id", row.id);
          results.push({ id: row.id, status: "rescheduled", next_retry_at: nextAt, attempts: newRetryCount });
        }
      }
    }

    return json({ success: true, processed: rows.length, results });
  } catch (e) {
    console.error("process-comm-retry-queue error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
