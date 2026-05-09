// Centralized helper to send a WhatsApp document (PDF) message.
// v3.0: resolve an approved Meta template via `trigger_event` and pass
//       `template_id` + `document_link` variable to the dispatcher. This
//       prevents Meta error 131047 (re-engagement message) when sending
//       outside the 24-hour customer-service window — which is the only
//       window where freeform document captions are accepted.

import { dispatchCommunication } from '@/lib/comms/dispatch';
import { uploadAttachment } from './uploadAttachment';
import { findTemplate } from '@/lib/templates/dynamicAttachment';

export interface SendWhatsAppDocumentInput {
  branchId: string;
  phone: string; // raw, will be normalised to +91XXXXXXXXXX
  memberId?: string | null;
  caption: string; // visible text alongside the document (fallback only)
  filename: string;
  pdf: Blob;
  folder?: string; // storage subfolder, e.g. 'invoices', 'receipts'
  /** Stable idempotency key — defaults to filename+timestamp; pass an
   *  invoice/plan-scoped key for true dedupe. */
  dedupeKey?: string;
  /** Maps to dispatcher category. Defaults to 'transactional'. */
  category?: 'payment_receipt' | 'transactional' | 'membership_reminder' | 'announcement';
  /** Trigger event of the approved Meta template to use. e.g.
   *  `payment_received`, `scan_report_ready`, `workout_plan_ready`. */
  triggerEvent?: string;
  /** Extra variables for template substitution (`{{member_name}}` etc.). */
  variables?: Record<string, string | number | null | undefined>;
}

function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export async function sendWhatsAppDocument(input: SendWhatsAppDocumentInput): Promise<{
  url: string;
  fallback: boolean;
  status: 'sent' | 'queued' | 'deduped' | 'suppressed' | 'failed';
}> {
  const phone = normalisePhone(input.phone);
  const { url } = await uploadAttachment(input.pdf, {
    folder: input.folder || 'shared',
    filename: input.filename,
    contentType: 'application/pdf',
  });

  // Resolve the approved Meta template (branch-scoped, then global) so we
  // never accidentally send a freeform message outside the 24h window.
  let templateId: string | undefined;
  if (input.triggerEvent) {
    const tpl = await findTemplate({
      branchId: input.branchId,
      type: 'whatsapp',
      triggerEvent: input.triggerEvent,
    });
    if (tpl) templateId = tpl.id;
  }

  try {
    const result = await dispatchCommunication({
      branch_id: input.branchId,
      channel: 'whatsapp',
      category: input.category ?? 'transactional',
      recipient: phone,
      member_id: input.memberId ?? null,
      template_id: templateId,
      payload: {
        body: input.caption,
        variables: { ...(input.variables ?? {}), document_link: url },
      },
      dedupe_key: input.dedupeKey ?? `wa-doc:${input.filename}:${phone}:${Date.now()}`,
      // Receipts/invoices are transactional; bypass member opt-out.
      force: (input.category ?? 'transactional') === 'transactional'
        || input.category === 'payment_receipt',
      attachment: {
        url,
        filename: input.filename,
        content_type: 'application/pdf',
        kind: 'document',
      },
    });

    return { url, fallback: false, status: result.status };
  } catch (err) {
    console.error('[sendWhatsAppDocument] dispatcher failed', err);
    return { url, fallback: false, status: 'failed' };
  }
}
