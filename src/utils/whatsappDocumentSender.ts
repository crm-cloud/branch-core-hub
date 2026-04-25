// Centralized helper to send a WhatsApp document (PDF) message via Meta Cloud API.
// Falls back to a wa.me text-only link if the branch has no active WhatsApp
// integration so the share flow never silently fails.

import { supabase } from '@/integrations/supabase/client';
import { uploadAttachment } from './uploadAttachment';

export interface SendWhatsAppDocumentInput {
  branchId: string;
  phone: string; // raw, will be normalised to +91XXXXXXXXXX
  memberId?: string | null;
  caption: string; // visible text alongside the document
  filename: string;
  pdf: Blob;
  folder?: string; // storage subfolder, e.g. 'invoices', 'receipts'
}

function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/**
 * Upload a PDF to the public attachments bucket and dispatch it as a WhatsApp
 * document via the `send-whatsapp` edge function. Returns the public PDF URL
 * and the DB row id so callers can link to it from invoice timelines.
 *
 * If the branch has no active WhatsApp integration the function falls back to
 * opening wa.me with the caption + a link to the uploaded PDF, so the recipient
 * still receives the document.
 */
export async function sendWhatsAppDocument(input: SendWhatsAppDocumentInput): Promise<{
  url: string;
  messageId?: string;
  fallback: boolean;
}> {
  const phone = normalisePhone(input.phone);
  const { url } = await uploadAttachment(input.pdf, {
    folder: input.folder || 'shared',
    filename: input.filename,
    contentType: 'application/pdf',
  });

  // Insert the outbound message row first so send-whatsapp can update its status
  // and so the chat thread shows it.
  const { data: row, error: insertErr } = await supabase
    .from('whatsapp_messages')
    .insert({
      branch_id: input.branchId,
      phone_number: phone,
      member_id: input.memberId || null,
      content: input.caption,
      direction: 'outbound',
      status: 'pending',
      message_type: 'document',
      media_url: url,
    } as never)
    .select('id')
    .single();

  if (insertErr) {
    // If we can't even log it, fall back to wa.me with the link in the caption.
    const wa = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${input.caption}\n\n${url}`)}`;
    window.open(wa, '_blank');
    return { url, fallback: true };
  }

  const messageId = (row as { id: string }).id;

  const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
    body: {
      message_id: messageId,
      phone_number: phone,
      branch_id: input.branchId,
      message_type: 'document',
      media_url: url,
      caption: input.caption,
      filename: input.filename,
    },
  });

  const failed = !!sendErr || (sendData && typeof sendData === 'object' && 'error' in sendData && (sendData as { error?: unknown }).error);
  if (failed) {
    // Mark the row failed and fall back to wa.me so the recipient still gets the link
    await supabase.from('whatsapp_messages').update({ status: 'failed' }).eq('id', messageId);
    const wa = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${input.caption}\n\n${url}`)}`;
    window.open(wa, '_blank');
    return { url, messageId, fallback: true };
  }

  await supabase.from('whatsapp_messages').update({ status: 'sent' }).eq('id', messageId);
  return { url, messageId, fallback: false };
}
