import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, MessageSquare, Loader2 } from 'lucide-react';

interface WhatsAppTemplateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  recipientName: string;
  branchId: string;
}

export function WhatsAppTemplateDrawer({ open, onOpenChange, phoneNumber, recipientName, branchId }: WhatsAppTemplateDrawerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates', branchId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('templates')
        .select('id, name, content, type, meta_template_status, meta_template_name')
        .eq('type', 'whatsapp')
        .eq('meta_template_status', 'APPROVED')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; content: string; type: string; meta_template_status: string; meta_template_name: string | null }>;
    },
    enabled: open,
  });

  const handleSend = async () => {
    if (!selectedTemplate || !phoneNumber) return;
    setSending(true);
    try {
      const content = selectedTemplate.content
        ?.replace(/\{\{name\}\}/gi, recipientName)
        ?.replace(/\{\{1\}\}/g, recipientName);

      const { data: msgRecord, error: msgError } = await (supabase as any)
        .from('whatsapp_messages')
        .insert({
          branch_id: branchId,
          phone_number: phoneNumber,
          direction: 'outbound',
          content,
          status: 'pending',
        })
        .select('id')
        .single();

      if (msgError) throw msgError;

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { message_id: msgRecord.id, phone_number: phoneNumber, content, branch_id: branchId },
      });
      if (error) throw error;
      toast.success(`Template "${selectedTemplate.name}" sent to ${recipientName}`);
      onOpenChange(false);
      setSelectedTemplate(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            Send WhatsApp Template
          </SheetTitle>
          <SheetDescription>Select a template to send to {recipientName}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No approved WhatsApp templates found. Add templates in Settings → Templates.</p>
          ) : (
            templates.map((t: any) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-all rounded-xl ${
                  selectedTemplate?.id === t.id
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'hover:border-emerald-500/50'
                }`}
                onClick={() => setSelectedTemplate(t)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{t.name}</p>
                    <Badge variant="outline" className="text-xs">{t.meta_template_status || 'Manual'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{t.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={!selectedTemplate || sending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? 'Sending...' : 'Send Template'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * E5: Auto-send a WhatsApp template by mapped trigger event.
 * Looks up `whatsapp_triggers` for the (event_name, branch_id) pair, with global fallback,
 * resolves the linked template, substitutes simple variables, inserts a `whatsapp_messages`
 * row, and dispatches via the `send-whatsapp` edge function. Failures are logged to
 * `communication_logs` (status=failed) for auditability.
 */
export async function autoSendWhatsAppTemplate(
  triggerEvent: string,
  phoneNumber: string,
  recipientName: string,
  branchId: string,
  vars: Record<string, string | number> = {},
) {
  try {
    // 1. Find branch-specific trigger; fall back to global (branch_id IS NULL)
    let { data: trigger } = await (supabase as any)
      .from('whatsapp_triggers')
      .select('id, template_id, is_active, branch_id')
      .eq('event_name', triggerEvent)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    if (!trigger) {
      const { data: globalTrigger } = await (supabase as any)
        .from('whatsapp_triggers')
        .select('id, template_id, is_active, branch_id')
        .eq('event_name', triggerEvent)
        .is('branch_id', null)
        .eq('is_active', true)
        .maybeSingle();
      trigger = globalTrigger;
    }

    if (!trigger?.template_id) {
      console.log(`[autoSendWhatsAppTemplate] no trigger for event=${triggerEvent} branch=${branchId}`);
      return { skipped: true, reason: 'no_trigger' };
    }

    // 2. Load the template
    const { data: template, error: tplErr } = await (supabase as any)
      .from('templates')
      .select('id, name, content, meta_template_status')
      .eq('id', trigger.template_id)
      .maybeSingle();

    if (tplErr || !template?.content) {
      throw new Error(tplErr?.message || 'Template not found or empty');
    }

    // 3. Variable substitution
    const allVars: Record<string, string> = {
      name: recipientName,
      '1': recipientName,
      ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])),
    };
    let content = template.content as string;
    for (const [k, v] of Object.entries(allVars)) {
      content = content.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi'), v);
    }

    // 4. Insert message record
    const { data: msgRecord, error: msgError } = await (supabase as any)
      .from('whatsapp_messages')
      .insert({
        branch_id: branchId,
        phone_number: phoneNumber,
        direction: 'outbound',
        content,
        status: 'pending',
      })
      .select('id')
      .single();

    if (msgError || !msgRecord) throw new Error(msgError?.message || 'Failed to create message record');

    // 5. Dispatch via send-whatsapp
    const { error: invokeErr } = await supabase.functions.invoke('send-whatsapp', {
      body: { message_id: msgRecord.id, phone_number: phoneNumber, content, branch_id: branchId },
    });

    if (invokeErr) throw invokeErr;

    return { success: true, message_id: msgRecord.id, template_name: template.name };
  } catch (err: any) {
    // Audit failure to communication_logs instead of swallowing silently
    console.error(`[autoSendWhatsAppTemplate] event=${triggerEvent} failed:`, err?.message || err);
    try {
      await (supabase as any).from('communication_logs').insert({
        branch_id: branchId,
        recipient: phoneNumber,
        type: 'whatsapp',
        content: `[auto-trigger ${triggerEvent} failed] ${err?.message || 'unknown error'}`,
        status: 'failed',
        sent_at: new Date().toISOString(),
      });
    } catch { /* ignore log failure */ }
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
