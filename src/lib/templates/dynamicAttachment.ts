// Helpers for working with dynamic-PDF templates (invoice, receipt, scan,
// plan, etc.). These templates have:
//   header_type        = 'document' | 'image' | 'video'
//   attachment_source  = 'dynamic'  → caller supplies the file at send time
//                      = 'static'   → template.header_media_url is reused
//
// `attachment_filename_template` may contain {{variables}} that get rendered
// from the runtime context.

import { supabase } from '@/integrations/supabase/client';

export type TemplateChannel = 'whatsapp' | 'sms' | 'email';

export interface CommunicationTemplate {
  id: string;
  branch_id: string | null;
  name: string;
  type: TemplateChannel;
  subject: string | null;
  content: string;
  is_active: boolean;
  trigger_event?: string | null;
  header_type?: 'none' | 'image' | 'document' | 'video' | null;
  header_media_url?: string | null;
  attachment_source?: 'none' | 'static' | 'dynamic' | null;
  attachment_filename_template?: string | null;
}

/** Replace `{{var}}` placeholders with values from `vars`. Missing vars stay as-is. */
export function renderTemplate(input: string | null | undefined, vars: Record<string, string | number | null | undefined>): string {
  if (!input) return '';
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === null || v === undefined || v === '' ? `{{${key}}}` : String(v);
  });
}

/** Strip unrendered `{{...}}` placeholders from a string. */
export function stripUnrendered(input: string): string {
  return input.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Find the most relevant template for a (branch, type, trigger_event) combination.
 *  Falls back to a name-match if no trigger_event is set yet. */
export async function findTemplate(opts: {
  branchId: string;
  type: TemplateChannel;
  triggerEvent?: string | null;
  nameContains?: string;
}): Promise<CommunicationTemplate | null> {
  const { branchId, type, triggerEvent, nameContains } = opts;

  // 1. Exact branch + trigger_event + active. Prefer rows with a real
  //    document/image header (so PDFs attach via Meta header, not just a
  //    text link), then fall back to header-less rows. Finally, fall back
  //    to GLOBAL templates (branch_id IS NULL) — the same fallback the
  //    dispatcher already does for WhatsApp credentials.
  if (triggerEvent) {
    // 1a. Branch-scoped, with document/image/video header
    {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('branch_id', branchId)
        .eq('type', type)
        .eq('trigger_event', triggerEvent)
        .eq('is_active', true)
        .in('header_type', ['document', 'image', 'video'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as CommunicationTemplate;
    }
    // 1b. Branch-scoped, any header
    {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('branch_id', branchId)
        .eq('type', type)
        .eq('trigger_event', triggerEvent)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as CommunicationTemplate;
    }
    // 1c. GLOBAL fallback, with document/image/video header
    {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .is('branch_id', null)
        .eq('type', type)
        .eq('trigger_event', triggerEvent)
        .eq('is_active', true)
        .in('header_type', ['document', 'image', 'video'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as CommunicationTemplate;
    }
    // 1d. GLOBAL fallback, any header
    {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .is('branch_id', null)
        .eq('type', type)
        .eq('trigger_event', triggerEvent)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as CommunicationTemplate;
    }
  }

  // 2. Branch + name contains (e.g. "Invoice"), then global fallback
  if (nameContains) {
    {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('branch_id', branchId)
        .eq('type', type)
        .eq('is_active', true)
        .ilike('name', `%${nameContains}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as CommunicationTemplate;
    }
    {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .is('branch_id', null)
        .eq('type', type)
        .eq('is_active', true)
        .ilike('name', `%${nameContains}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as CommunicationTemplate;
    }
  }

  return null;
}

export interface ResolvedDynamicTemplate {
  body: string;
  subject: string | null;
  filename: string | null;
  headerType: 'none' | 'image' | 'document' | 'video';
  attachmentSource: 'none' | 'static' | 'dynamic';
  staticMediaUrl: string | null;
}

/** Apply variable rendering to a template + return an easy-to-use shape. */
export function resolveTemplate(template: CommunicationTemplate | null, vars: Record<string, string | number | null | undefined>, fallback: { body: string; subject?: string | null; filename?: string | null }): ResolvedDynamicTemplate {
  if (!template) {
    return {
      body: fallback.body,
      subject: fallback.subject ?? null,
      filename: fallback.filename ?? null,
      headerType: 'none',
      attachmentSource: 'none',
      staticMediaUrl: null,
    };
  }
  const body = stripUnrendered(renderTemplate(template.content, vars));
  const subject = template.subject ? stripUnrendered(renderTemplate(template.subject, vars)) : null;
  const filename = template.attachment_filename_template
    ? stripUnrendered(renderTemplate(template.attachment_filename_template, vars))
    : (fallback.filename ?? null);
  return {
    body: body || fallback.body,
    subject: subject || fallback.subject || null,
    filename,
    headerType: (template.header_type as any) || 'none',
    attachmentSource: (template.attachment_source as any) || 'none',
    staticMediaUrl: template.header_media_url || null,
  };
}

/** Quick presets used by Template Manager to one-click pre-fill the form. */
export interface TemplatePreset {
  id: string;
  label: string;
  type: TemplateChannel;
  trigger: string;
  subject?: string;
  content: string;
  header_type: 'none' | 'image' | 'document' | 'video';
  attachment_source: 'none' | 'static' | 'dynamic';
  attachment_filename_template?: string;
}

export const DYNAMIC_PDF_PRESETS: TemplatePreset[] = [
  {
    id: 'invoice_wa',
    label: 'Invoice PDF — WhatsApp',
    type: 'whatsapp',
    trigger: 'payment_received',
    content: 'Hi {{member_name}},\n\nYour invoice *{{invoice_number}}* for ₹{{amount}} is ready. The PDF is attached.\n\nDate: {{date}}\nBranch: {{branch_name}}\n\nThank you!',
    header_type: 'document',
    attachment_source: 'dynamic',
    attachment_filename_template: 'Invoice-{{invoice_number}}.pdf',
  },
  {
    id: 'invoice_email',
    label: 'Invoice PDF — Email',
    type: 'email',
    trigger: 'payment_received',
    subject: 'Invoice {{invoice_number}} from {{branch_name}}',
    content: '<p>Dear {{member_name}},</p><p>Your invoice <b>{{invoice_number}}</b> for ₹{{amount}} is attached.</p>',
    header_type: 'document',
    attachment_source: 'dynamic',
    attachment_filename_template: 'Invoice-{{invoice_number}}.pdf',
  },
  {
    id: 'receipt_wa',
    label: 'Payment Receipt PDF — WhatsApp',
    type: 'whatsapp',
    trigger: 'payment_received',
    content: 'Hi {{member_name}},\n\nWe have received your payment of ₹{{amount}} against invoice *{{invoice_number}}*. Receipt attached.',
    header_type: 'document',
    attachment_source: 'dynamic',
    attachment_filename_template: 'Receipt-{{invoice_number}}.pdf',
  },
  {
    id: 'body_scan_wa',
    label: 'Body Scan Report — WhatsApp',
    type: 'whatsapp',
    trigger: 'body_scan_ready',
    content: 'Hi {{member_name}}, your body scan from {{branch_name}} is ready. Report attached.',
    header_type: 'document',
    attachment_source: 'dynamic',
    attachment_filename_template: 'Body-Scan-{{member_code}}.pdf',
  },
  {
    id: 'posture_scan_wa',
    label: 'Posture Scan Report — WhatsApp',
    type: 'whatsapp',
    trigger: 'posture_scan_ready',
    content: 'Hi {{member_name}}, your posture scan from {{branch_name}} is ready. Report attached.',
    header_type: 'document',
    attachment_source: 'dynamic',
    attachment_filename_template: 'Posture-Scan-{{member_code}}.pdf',
  },
  {
    id: 'plan_wa',
    label: 'Diet/Workout Plan — WhatsApp',
    type: 'whatsapp',
    trigger: 'custom',
    content: 'Hi {{member_name}}, your trainer has assigned you a new {{plan_type}} plan: {{plan_name}}. PDF attached.',
    header_type: 'document',
    attachment_source: 'dynamic',
    attachment_filename_template: '{{plan_name}}.pdf',
  },
];
