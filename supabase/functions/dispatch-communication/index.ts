// dispatch-communication v1.3.1
// v1.3.1: extract real edge-function error bodies and pre-create WA rows for all WhatsApp sends.
// v1.3.0: route channel=email to send-email (was incorrectly hitting send-message);
//         pass attachments (auto base64-fetched from attachment.url) and
//         use_branded_template flag; mirror provider_message_id into delivery_metadata.
// v1.2.0: re-allow retry of previously failed/suppressed dedupe_key; surface real Meta error body.
// v1.1.0: WhatsApp attachment passthrough (PDF / image documents).
// All other edge functions MUST route through this instead of writing
// communication_logs directly. Enforces:
//   1. dedupe_key uniqueness (cron retries / webhook replays cannot double-send)
//   2. member channel + category preferences
//   3. quiet hours (deferred to communication_retry_queue)
//   4. provider routing (whatsapp / sms / email / in_app)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Channel = 'whatsapp' | 'sms' | 'email' | 'in_app';
type Category =
  | 'membership_reminder' | 'payment_receipt' | 'class_notification'
  | 'announcement' | 'low_stock' | 'new_lead' | 'payment_alert'
  | 'task_reminder' | 'retention_nudge' | 'review_request'
  | 'marketing' | 'transactional';

interface DispatchInput {
  branch_id: string;
  channel: Channel;
  category: Category;
  recipient: string;             // email, phone with +91, or user_id for in_app
  member_id?: string | null;
  user_id?: string | null;
  template_id?: string | null;
  payload: {
    subject?: string;
    body: string;
    variables?: Record<string, unknown>;
    /** When true, send-email wraps the body in the branded HTML shell. */
    use_branded_template?: boolean;
  };
  dedupe_key: string;
  ttl_seconds?: number;          // dedupe lookback window, default 86400
  force?: boolean;               // bypass preferences (transactional)
  attachment?: {                 // optional file attachment (whatsapp document/image, or email PDF)
    url: string;
    filename: string;
    content_type?: string;       // e.g. application/pdf
    kind?: 'document' | 'image';
  };
}

interface DispatchResult {
  status: 'sent' | 'queued' | 'deduped' | 'suppressed' | 'failed';
  log_id?: string;
  reason?: string;
  provider_message_id?: string;
}

function bad(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function ok(body: DispatchResult): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function functionErrorDetail(error: unknown): Promise<string> {
  const base = error instanceof Error ? error.message : String(error ?? 'edge_function_error');
  try {
    const ctx = (error as { context?: unknown })?.context;
    if (ctx instanceof Response) {
      const text = await ctx.clone().text();
      return text || base;
    }
  } catch (_) { /* noop */ }
  return base;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad(405, { error: 'method_not_allowed' });

  let input: DispatchInput;
  try {
    input = await req.json();
  } catch {
    return bad(400, { error: 'invalid_json' });
  }

  // ── validate ──
  const required = ['branch_id', 'channel', 'category', 'recipient', 'payload', 'dedupe_key'] as const;
  for (const k of required) {
    if (!input[k as keyof DispatchInput]) return bad(400, { error: `missing_${k}` });
  }
  const validChannels: Channel[] = ['whatsapp', 'sms', 'email', 'in_app'];
  if (!validChannels.includes(input.channel)) return bad(400, { error: 'invalid_channel' });
  if (!input.payload?.body) return bad(400, { error: 'missing_payload_body' });

  // Normalize phone recipients to E.164 (digits only) for whatsapp/sms.
  // Defaults to India (+91) when no country code is present.
  if (input.channel === 'whatsapp' || input.channel === 'sms') {
    let digits = String(input.recipient || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) digits = '91' + digits;
    if (digits.length < 10 || digits.length > 15) {
      return bad(400, { error: 'invalid_recipient_phone', details: input.recipient });
    }
    input.recipient = digits;
  }

  const ttl = Math.max(60, Math.min(input.ttl_seconds ?? 86400, 7 * 86400));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // ── 1) dedupe lookup ──
    const cutoff = new Date(Date.now() - ttl * 1000).toISOString();
    const { data: existing } = await supabase
      .from('communication_logs')
      .select('id, delivery_status, provider_message_id')
      .eq('dedupe_key', input.dedupe_key)
      .gte('created_at', cutoff)
      .maybeSingle();

    if (existing) {
      const prev = String(existing.delivery_status || '').toLowerCase();
      // Only treat terminal-success or in-flight states as deduped. A previous
      // `failed` / `suppressed` attempt should be retryable from the UI.
      const dedupeStates = ['sent', 'delivered', 'read', 'queued', 'sending'];
      if (dedupeStates.includes(prev)) {
        return ok({
          status: 'deduped',
          log_id: existing.id,
          reason: `existing_log_${existing.delivery_status}`,
          provider_message_id: existing.provider_message_id ?? undefined,
        });
      }
      // Clear the old failed row so the unique dedupe_key index allows a fresh attempt.
      await supabase.from('communication_logs').delete().eq('id', existing.id);
    }

    // ── 2) preference enforcement ──
    if (!input.force) {
      const { data: pref } = await supabase.rpc('should_send_communication', {
        p_member_id: input.member_id ?? null,
        p_channel: input.channel,
        p_category: input.category,
      });

      const allowed = Array.isArray(pref) ? pref[0]?.allowed : pref?.allowed;
      const reason  = Array.isArray(pref) ? pref[0]?.reason  : pref?.reason;

      if (allowed === false) {
        const { data: log } = await supabase
          .from('communication_logs')
          .insert({
            branch_id: input.branch_id,
            member_id: input.member_id ?? null,
            user_id: input.user_id ?? null,
            type: input.channel,
            channel: input.channel,
            category: input.category,
            recipient: input.recipient,
            subject: input.payload.subject ?? null,
            content: input.payload.body,
            template_id: input.template_id ?? null,
            dedupe_key: input.dedupe_key,
            status: 'suppressed',
            delivery_status: 'suppressed',
            error_message: reason ?? 'preference_block',
          })
          .select('id')
          .single();

        return ok({ status: 'suppressed', log_id: log?.id, reason: reason ?? 'preference_block' });
      }

      // ── 3) quiet hours ──
      if (input.member_id && input.channel !== 'in_app') {
        const { data: quiet } = await supabase.rpc('is_in_quiet_hours', { p_member_id: input.member_id });
        if (quiet === true) {
          const { data: log } = await supabase
            .from('communication_logs')
            .insert({
              branch_id: input.branch_id,
              member_id: input.member_id,
              user_id: input.user_id ?? null,
              type: input.channel,
              channel: input.channel,
              category: input.category,
              recipient: input.recipient,
              subject: input.payload.subject ?? null,
              content: input.payload.body,
              template_id: input.template_id ?? null,
              dedupe_key: input.dedupe_key,
              status: 'queued',
              delivery_status: 'queued',
              error_message: 'quiet_hours_deferred',
            })
            .select('id')
            .single();
          // Producer-side retry queue insert; process-comm-retry-queue will pick it up.
          if (log) {
            await supabase.from('communication_retry_queue').insert({
              original_log_id: log.id,
              retry_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              attempt_count: 0,
            }).then(() => {}, () => {});
          }
          return ok({ status: 'queued', log_id: log?.id, reason: 'quiet_hours' });
        }
      }
    }

    // ── 4) insert log row (unique dedupe_key index makes this safe under concurrency) ──
    const { data: log, error: logError } = await supabase
      .from('communication_logs')
      .insert({
        branch_id: input.branch_id,
        member_id: input.member_id ?? null,
        user_id: input.user_id ?? null,
        type: input.channel,
        channel: input.channel,
        category: input.category,
        recipient: input.recipient,
        subject: input.payload.subject ?? null,
        content: input.payload.body,
        template_id: input.template_id ?? null,
        dedupe_key: input.dedupe_key,
        status: 'sending',
        delivery_status: 'sending',
        delivery_metadata: input.attachment ? { attachment: input.attachment } : {},
      })
      .select('id')
      .single();

    if (logError) {
      // Likely a concurrent insert hit the dedupe_key unique index; treat as deduped.
      if (logError.code === '23505') {
        const { data: dupe } = await supabase
          .from('communication_logs')
          .select('id, delivery_status, provider_message_id')
          .eq('dedupe_key', input.dedupe_key)
          .maybeSingle();
        return ok({
          status: 'deduped',
          log_id: dupe?.id,
          reason: 'unique_violation_race',
          provider_message_id: dupe?.provider_message_id ?? undefined,
        });
      }
      return bad(500, { error: 'log_insert_failed', detail: logError.message });
    }

    // ── 5) channel routing ──
    let providerMessageId: string | undefined;
    let sendError: string | undefined;

    try {
      switch (input.channel) {
        case 'whatsapp': {
          // For attachments (PDF/image), pre-create the whatsapp_messages row so
          // send-whatsapp (which requires message_id) can update its delivery
          // status. The chat thread also relies on this row to render the bubble.
          if (input.attachment) {
            const kind = input.attachment.kind ?? 'document';
            const { data: waRow, error: waErr } = await supabase
              .from('whatsapp_messages')
              .insert({
                branch_id: input.branch_id,
                phone_number: input.recipient,
                member_id: input.member_id ?? null,
                content: input.payload.body,
                direction: 'outbound',
                status: 'pending',
                message_type: kind,
                media_url: input.attachment.url,
              })
              .select('id')
              .single();
            if (waErr) throw new Error(waErr.message);
            const r = await supabase.functions.invoke('send-whatsapp', {
              body: {
                message_id: waRow!.id,
                phone_number: input.recipient,
                branch_id: input.branch_id,
                message_type: kind,
                media_url: input.attachment.url,
                caption: input.payload.body,
                filename: input.attachment.filename,
                skip_log: true,
              },
            });
            // supabase-js wraps non-2xx as `error`; the real Meta reason lives
            // inside response body. Try to extract it for clearer logs.
            if (r.error) throw new Error(await functionErrorDetail(r.error));
            const errPayload = (r.data as { error?: unknown; meta_error?: unknown })?.error;
            const metaErr = (r.data as { meta_error?: string })?.meta_error;
            if (errPayload) throw new Error(metaErr || (typeof errPayload === 'string' ? errPayload : JSON.stringify(errPayload)));
            providerMessageId = (r.data as { whatsapp_message_id?: string })?.whatsapp_message_id;
            break;
          }
          const messageType = 'text';
          const { data: waRow, error: waErr } = await supabase
            .from('whatsapp_messages')
            .insert({
              branch_id: input.branch_id,
              phone_number: input.recipient,
              member_id: input.member_id ?? null,
              content: input.payload.body,
              direction: 'outbound',
              status: 'pending',
              message_type: messageType,
            })
            .select('id')
            .single();
          if (waErr) throw new Error(waErr.message);
          const r = await supabase.functions.invoke('send-whatsapp', {
            body: {
              message_id: waRow!.id,
              phone_number: input.recipient,
              content: input.payload.body,
              branch_id: input.branch_id,
              message_type: messageType,
              template_id: input.template_id,
              variables: input.payload.variables,
              member_id: input.member_id,
              skip_log: true,                // dispatcher owns the log
              source_log_id: log!.id,
            },
          });
          if (r.error) throw new Error(await functionErrorDetail(r.error));
          providerMessageId = (r.data as { message_id?: string })?.message_id;
          break;
        }
        case 'sms': {
          const r = await supabase.functions.invoke('send-sms', {
            body: {
              branch_id: input.branch_id,
              recipient: input.recipient,
              message: input.payload.body,
              template_id: input.template_id,
              member_id: input.member_id,
              skip_log: true,
              source_log_id: log!.id,
            },
          });
          if (r.error) throw new Error(await functionErrorDetail(r.error));
          providerMessageId = (r.data as { message_id?: string })?.message_id;
          break;
        }
        case 'email': {
          // Build email attachments by fetching the attachment.url and base64-encoding.
          let emailAttachments: Array<{ filename: string; content_base64: string; content_type: string }> | undefined;
          if (input.attachment?.url) {
            try {
              const res = await fetch(input.attachment.url);
              if (!res.ok) throw new Error(`attachment_fetch_${res.status}`);
              const buf = new Uint8Array(await res.arrayBuffer());
              if (buf.byteLength < 1024) {
                throw new Error(`attachment_too_small_${buf.byteLength}b`);
              }
              // Chunked base64 to avoid stack overflow on large PDFs
              let bin = '';
              for (let i = 0; i < buf.length; i += 0x8000) {
                bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
              }
              emailAttachments = [{
                filename: input.attachment.filename,
                content_base64: btoa(bin),
                content_type: input.attachment.content_type ?? 'application/pdf',
              }];
            } catch (e) {
              throw new Error(`attachment_error: ${(e as Error).message}`);
            }
          }
          const r = await supabase.functions.invoke('send-email', {
            body: {
              to: input.recipient,
              subject: input.payload.subject,
              html: input.payload.body,
              branch_id: input.branch_id,
              use_branded_template: input.payload.use_branded_template ?? false,
              variables: input.payload.variables,
              attachments: emailAttachments,
              skip_log: true,
              source_log_id: log!.id,
            },
          });
          if (r.error) throw new Error(await functionErrorDetail(r.error));
          providerMessageId = (r.data as { message_id?: string })?.message_id;
          break;
        }
        case 'in_app': {
          // In-app notifications go through notifications table; dedupe handled there too.
          const r = await supabase.from('notifications').insert({
            user_id: input.user_id,
            branch_id: input.branch_id,
            title: input.payload.subject ?? 'Notification',
            body: input.payload.body,
            category: input.category,
          }).select('id').single();
          if (r.error && r.error.code !== '23505') throw new Error(r.error.message);
          providerMessageId = r.data?.id;
          break;
        }
      }
    } catch (e) {
      sendError = (e as Error).message ?? 'send_failed';
    }

    // ── 6) finalize log ──
    const finalMeta: Record<string, unknown> = {};
    if (input.attachment) finalMeta.attachment = input.attachment;
    if (providerMessageId) finalMeta.provider_message_id = providerMessageId;

    await supabase
      .from('communication_logs')
      .update({
        delivery_status: sendError ? 'failed' : 'sent',
        status: sendError ? 'failed' : 'sent',
        provider_message_id: providerMessageId ?? null,
        delivery_metadata: Object.keys(finalMeta).length ? finalMeta : null,
        error_message: sendError ?? null,
        sent_at: new Date().toISOString(),
        attempt_count: 1,
      })
      .eq('id', log!.id);

    if (sendError) {
      return ok({ status: 'failed', log_id: log!.id, reason: sendError });
    }
    return ok({ status: 'sent', log_id: log!.id, provider_message_id: providerMessageId });
  } catch (e) {
    return bad(500, { error: 'unexpected', detail: (e as Error).message });
  }
});
