// process-comm-retry-queue v2.1.0
// v2.1.0: Treat dispatcher `suppressed` (channel toggled off in Settings →
//          Integrations) as TERMINAL — abandon the queue row instead of
//          consuming retry attempts and producing endless 4xx loops.
// v2.0.0: ALWAYS retry through `dispatch-communication` (was calling
//          send-whatsapp/send-sms/send-email directly with the wrong contract,
//          which produced `Missing required fields: message_id, phone_number,
//          branch_id` 400s on every WhatsApp retry). Reconstructs the dispatcher
//          payload from the original communication_logs row, including any PDF
//          attachment carried in delivery_metadata, so PDFs are resent natively.
// Picks up failed messages from communication_retry_queue and re-dispatches them
// via the canonical dispatch-communication edge function.
// Backoff: 5min -> 30min -> 2h, then marks as exhausted.

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
      await supabase
        .from("communication_retry_queue")
        .update({ status: "processing" })
        .eq("id", row.id)
        .eq("status", row.status);

      // Resolve original log to recover category/attachment when present
      let category: string | null = null;
      let attachment: any = null;
      let payloadVariables: Record<string, unknown> | undefined;
      let useBranded = true;

      if (row.original_log_id) {
        const { data: log } = await supabase
          .from("communication_logs")
          .select("category, delivery_metadata")
          .eq("id", row.original_log_id)
          .maybeSingle();
        if (log) {
          category = (log as any).category ?? null;
          const meta = ((log as any).delivery_metadata ?? {}) as Record<string, any>;
          if (meta.attachment) attachment = meta.attachment;
        }
      }
      // Fallback to retry-queue.metadata copy of delivery_metadata
      const meta = (row.metadata ?? {}) as Record<string, any>;
      if (!category && meta.category) category = meta.category;
      if (!attachment && meta.attachment) attachment = meta.attachment;

      if (!category) {
        category = row.type === "email" ? "transactional" : "transactional";
      }

      const dispatchPayload: Record<string, unknown> = {
        branch_id: row.branch_id,
        channel: row.type,                   // whatsapp | sms | email
        category,
        recipient: row.recipient,
        member_id: row.member_id ?? null,
        template_id: row.template_id ?? null,
        payload: {
          subject: row.subject ?? undefined,
          body: row.content ?? "",
          variables: payloadVariables,
          use_branded_template: row.type === "email" ? useBranded : undefined,
        },
        // Fresh dedupe key so the retry doesn't collide with the failed log row
        dedupe_key: `retry:${row.id}:${row.retry_count + 1}`,
        force: true,
        attachment: attachment ?? undefined,
      };

      let success = false;
      let errorMsg = "";
      let dispatchStatus: string | undefined;
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-communication`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify(dispatchPayload),
        });
        const text = await resp.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { /* keep raw */ }
        dispatchStatus = parsed?.status;
        if (resp.ok && (dispatchStatus === "sent" || dispatchStatus === "queued" || dispatchStatus === "deduped")) {
          success = true;
        } else {
          errorMsg = `dispatch ${resp.status}: ${parsed?.reason || parsed?.error || text.slice(0, 300)}`;
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
            .update({ status: "exhausted", retry_count: newRetryCount, last_error: errorMsg })
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
