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
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, content, trigger_event, channel, is_active')
        .eq('channel', 'whatsapp')
        .eq('is_active', true)
        .order('name', { ascending: true }) as any;
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; content: string; trigger_event: string | null; channel: string; is_active: boolean }>;
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

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone_number: phoneNumber, content, branch_id: branchId },
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
            <p className="text-center text-muted-foreground py-8 text-sm">No WhatsApp templates found. Add templates in Settings → Templates.</p>
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
                    <Badge variant="outline" className="text-xs">{t.trigger_event || 'Manual'}</Badge>
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

/** Auto-send a WhatsApp template by trigger event name */
export async function autoSendWhatsAppTemplate(triggerEvent: string, phoneNumber: string, recipientName: string, branchId: string) {
  try {
    const { data: templates } = await (supabase
      .from('templates')
      .select('id, content')
      .eq('channel', 'whatsapp')
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true)
      .limit(1) as any);

    if (!templates?.length) return;

    const content = templates[0].content
      ?.replace(/\{\{name\}\}/gi, recipientName)
      ?.replace(/\{\{1\}\}/g, recipientName);

    await supabase.functions.invoke('send-whatsapp', {
      body: { phone_number: phoneNumber, content, branch_id: branchId },
    });
  } catch {
    // Silently fail for auto-triggers — don't block the main flow
  }
}
