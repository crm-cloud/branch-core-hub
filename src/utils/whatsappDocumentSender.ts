// Centralized helper to send a WhatsApp document (PDF) message.
// v2.0: routes through `dispatch-communication` so the send is funnelled
// through the canonical communication pipeline (dedupe, preferences, quiet
// hours, communication_logs row, Live Feed, System Health).

import { dispatchCommunication } from '@/lib/comms/dispatch';
import { uploadAttachment } from './uploadAttachment';

export interface SendWhatsAppDocumentInput {
  branchId: string;
  phone: string; // raw, will be normalised to +91XXXXXXXXXX
  memberId?: string | null;
  caption: string; // visible text alongside the document
  filename: string;
  pdf: Blob;
  folder?: string; // storage subfolder, e.g. 'invoices', 'receipts'
  /** Stable idempotency key — defaults to filename+timestamp; pass an
   *  invoice/plan-scoped key for true dedupe. */
  dedupeKey?: string;
  /** Maps to dispatcher category. Defaults to 'transactional'. */
  category?: 'payment_receipt' | 'transactional' | 'membership_reminder' | 'announcement';
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

  try {
    const result = await dispatchCommunication({
      branch_id: input.branchId,
      channel: 'whatsapp',
      category: input.category ?? 'transactional',
      recipient: phone,
      member_id: input.memberId ?? null,
      payload: { body: input.caption },
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

    if (result.status === 'sent' || result.status === 'queued' || result.status === 'deduped') {
      return { url, fallback: false, status: result.status };
    }
    // Do not fall back to a signed storage link: WhatsApp rewrites/encodes these
    // links and recipients see InvalidJWT instead of the PDF attachment.
    return { url, fallback: false, status: result.status };
  } catch (err) {
    console.error('[sendWhatsAppDocument] dispatcher failed', err);
    return { url, fallback: false, status: 'failed' };
  }
}
