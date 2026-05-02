// Unified helper that takes a plan + member contact, generates a styled PDF,
// uploads it to the `attachments` bucket, and dispatches via the requested
// channels (download / WhatsApp document / email attachment).
//
// Used by:
//   - Member Plans hub (per-row send)
//   - Templates page (preview-as-PDF, send template to member)
//   - AssignPlanDrawer "Send PDF on assign" toggle
//
// All channels are best-effort: the function returns a per-channel result so
// the UI can show partial success without throwing.

import { supabase } from '@/integrations/supabase/client';
import { buildPlanPdf } from './pdfBlob';
import { uploadAttachment, blobToBase64 } from './uploadAttachment';
import { dispatchCommunication } from '@/services/preferencesService';

export type PlanSendChannel = 'download' | 'whatsapp' | 'email';

export interface PlanSendInput {
  member: {
    id: string;
    full_name: string;
    phone?: string | null;
    email?: string | null;
  };
  plan: {
    name: string;
    type: 'workout' | 'diet';
    description?: string | null;
    data: any;
    valid_from?: string | null;
    valid_until?: string | null;
    trainer_name?: string | null;
  };
  branchId?: string | null;
  channels: PlanSendChannel[];
}

export interface PlanSendResult {
  pdfUrl?: string;
  pdfBlob?: Blob;
  channels: Partial<
    Record<PlanSendChannel, { sent: boolean; error?: string }>
  >;
}

function safeFilename(plan: PlanSendInput['plan']) {
  const safeName = plan.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `${plan.type === 'workout' ? 'Workout' : 'Diet'}-Plan-${safeName}.pdf`;
}

function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export async function sendPlanToMember(input: PlanSendInput): Promise<PlanSendResult> {
  const channels: PlanSendResult['channels'] = {};

  // 1. Always build the PDF (cheap, all paths need it).
  const pdfBlob = buildPlanPdf({
    name: input.plan.name,
    type: input.plan.type,
    description: input.plan.description ?? undefined,
    member_name: input.member.full_name,
    validFrom: input.plan.valid_from ?? undefined,
    validUntil: input.plan.valid_until ?? undefined,
    data: input.plan.data,
  });
  const filename = safeFilename(input.plan);

  // 2. Download channel = trigger browser download right here.
  if (input.channels.includes('download')) {
    try {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      channels.download = { sent: true };
    } catch (err: any) {
      channels.download = { sent: false, error: err?.message || 'Download failed' };
    }
  }

  // 3. Anything network-bound needs the upload.
  let pdfUrl: string | undefined;
  const needsUpload =
    input.channels.includes('whatsapp') || input.channels.includes('email');
  if (needsUpload) {
    try {
      const { url } = await uploadAttachment(pdfBlob, {
        folder: `fitness-plans/${input.member.id}`,
        filename,
        contentType: 'application/pdf',
      });
      pdfUrl = url;
    } catch (err: any) {
      const msg = err?.message || 'PDF upload failed';
      if (input.channels.includes('whatsapp')) channels.whatsapp = { sent: false, error: msg };
      if (input.channels.includes('email')) channels.email = { sent: false, error: msg };
    }
  }

  // 4. WhatsApp document — routed through canonical dispatcher
  if (input.channels.includes('whatsapp') && pdfUrl) {
    if (!input.member.phone) {
      channels.whatsapp = { sent: false, error: 'No phone on file' };
    } else if (!input.branchId) {
      channels.whatsapp = { sent: false, error: 'No branch context' };
    } else {
      try {
        const phone = normalisePhone(input.member.phone);
        const caption = `Hi ${input.member.full_name}, here is your new ${input.plan.type} plan: ${input.plan.name}`;
        const result = await dispatchCommunication({
          branch_id: input.branchId,
          channel: 'whatsapp',
          category: 'transactional',
          recipient: phone,
          member_id: input.member.id,
          payload: { body: caption },
          dedupe_key: `plan:${input.member.id}:${input.plan.type}:${input.plan.name}:${Date.now()}`,
          force: true,
          attachment: { url: pdfUrl, filename, content_type: 'application/pdf', kind: 'document' },
        });
        if (result.status === 'failed' || result.status === 'suppressed') {
          channels.whatsapp = { sent: false, error: result.reason || result.status };
        } else {
          channels.whatsapp = { sent: true };
        }
      } catch (err: any) {
        channels.whatsapp = { sent: false, error: err?.message || 'WhatsApp failed' };
      }
    }
  }

  // 5. Email attachment
  if (input.channels.includes('email')) {
    if (!input.member.email) {
      channels.email = { sent: false, error: 'No email on file' };
    } else {
      try {
        const base64 = await blobToBase64(pdfBlob);
        const subject = `Your new ${input.plan.type} plan: ${input.plan.name}`;
        const html = `
          <p>Hi ${input.member.full_name},</p>
          <p>Your ${input.plan.trainer_name ? `trainer <b>${input.plan.trainer_name}</b>` : 'trainer'} has assigned you a new <b>${input.plan.type}</b> plan: <b>${input.plan.name}</b>.</p>
          ${input.plan.valid_until ? `<p>Valid until <b>${input.plan.valid_until}</b>.</p>` : ''}
          <p>The full plan is attached as a PDF.</p>
          <p>— Team Incline</p>`;
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            to: input.member.email,
            subject,
            html,
            branch_id: input.branchId,
            attachments: [
              { filename, content_base64: base64, content_type: 'application/pdf' },
            ],
          },
        });
        if (error) throw error;
        channels.email = { sent: true };
      } catch (err: any) {
        channels.email = { sent: false, error: err?.message || 'Email failed' };
      }
    }
  }

  return { pdfUrl, pdfBlob, channels };
}
