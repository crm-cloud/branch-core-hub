// Single source of truth for outbound communications from the client.
// All client code that needs to send an Email / WhatsApp / SMS / in-app
// notification MUST go through dispatchCommunication() — never call
// `send-email`, `send-whatsapp`, `send-sms` directly.
//
// The dispatcher (supabase/functions/dispatch-communication) handles:
//   • dedupe via dedupe_key
//   • member channel + category preferences
//   • quiet-hours deferral
//   • provider routing (whatsapp / sms / email / in_app)
//   • communication_logs writes (with provider_message_id)
import { supabase } from '@/integrations/supabase/client';

export type CommChannel = 'whatsapp' | 'sms' | 'email' | 'in_app';

export type CommCategory =
  | 'membership_reminder'
  | 'payment_receipt'
  | 'class_notification'
  | 'announcement'
  | 'low_stock'
  | 'new_lead'
  | 'payment_alert'
  | 'task_reminder'
  | 'retention_nudge'
  | 'review_request'
  | 'marketing'
  | 'transactional';

export interface DispatchAttachment {
  url: string;
  filename: string;
  content_type?: string; // e.g. application/pdf
  kind?: 'document' | 'image';
}

export interface DispatchPayload {
  branch_id: string;
  channel: CommChannel;
  category: CommCategory;
  /** Email address, +91 phone, or user_id for in_app. */
  recipient: string;
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
  /** Stable per-message key. Reused across retries — guarantees no double sends. */
  dedupe_key: string;
  /** Lookback window for the dedupe lookup, default 86400 (24h). */
  ttl_seconds?: number;
  /** Bypass member preferences. Use only for transactional / receipts. */
  force?: boolean;
  attachment?: DispatchAttachment;
}

export interface DispatchResult {
  status: 'sent' | 'queued' | 'deduped' | 'suppressed' | 'failed';
  log_id?: string;
  reason?: string;
  provider_message_id?: string;
}

export async function dispatchCommunication(
  input: DispatchPayload,
): Promise<DispatchResult> {
  const { data, error } = await supabase.functions.invoke<DispatchResult>(
    'dispatch-communication',
    { body: input },
  );
  if (error) {
    return {
      status: 'failed',
      reason: (error as { message?: string }).message ?? 'invoke_failed',
    };
  }
  return data ?? { status: 'failed', reason: 'no_response' };
}

/** Build a stable dedupe key from a domain + entity + channel. */
export function buildDedupeKey(parts: Array<string | number | null | undefined>): string {
  return parts.filter(Boolean).join(':');
}
