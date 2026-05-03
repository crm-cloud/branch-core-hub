import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, Phone, Mail, Send, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BroadcastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  initialType?: 'sms' | 'email' | 'whatsapp';
  initialMessage?: string;
}

const CHANNELS = [
  { value: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500' },
  { value: 'sms' as const, label: 'SMS', icon: Phone, color: 'text-sky-500' },
  { value: 'email' as const, label: 'Email', icon: Mail, color: 'text-amber-500' },
];

export function BroadcastDrawer({ open, onOpenChange, branchId, initialType = 'whatsapp', initialMessage = '' }: BroadcastDrawerProps) {
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set([initialType]));
  const [message, setMessage] = useState(initialMessage);
  const [audience, setAudience] = useState('all');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [isSending, setIsSending] = useState(false);

  const templateQueryType = selectedChannels.size === 1 ? Array.from(selectedChannels)[0] : '';

  const { data: savedTemplates = [] } = useQuery({
    queryKey: ['broadcast-templates', templateQueryType],
    queryFn: async () => {
      if (!templateQueryType) return [];
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, content, subject')
        .eq('type', templateQueryType)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!templateQueryType,
  });

  const toggleChannel = (channel: string) => {
    const next = new Set(selectedChannels);
    if (next.has(channel)) {
      if (next.size > 1) next.delete(channel);
    } else {
      next.add(channel);
    }
    setSelectedChannels(next);
    setTemplateId('');
  };

  const toggleAll = () => {
    if (selectedChannels.size === 3) {
      setSelectedChannels(new Set(['whatsapp']));
    } else {
      setSelectedChannels(new Set(['whatsapp', 'sms', 'email']));
    }
    setTemplateId('');
  };

  const handleTemplateSelect = (tid: string) => {
    const template = savedTemplates.find((t: any) => t.id === tid);
    if (template) {
      setTemplateId(tid);
      setMessage(template.content);
      setSubject(template.subject || '');
    }
  };

  const handleBroadcast = async () => {
    if (!message.trim()) { toast.error('Please enter a message'); return; }
    if (!branchId) { toast.error('No branch selected'); return; }
    if (selectedChannels.size === 0) { toast.error('Select at least one channel'); return; }

    setIsSending(true);
    const results: { channel: string; sent: number; failed: number }[] = [];

    try {
      for (const channel of selectedChannels) {
        const { data, error } = await supabase.functions.invoke('send-broadcast', {
          body: {
            channel,
            message,
            audience,
            branch_id: branchId,
            subject: channel === 'email' ? subject || undefined : undefined,
            template_id: channel === 'whatsapp' && templateId ? templateId : undefined,
          },
        });
        if (error) {
          results.push({ channel, sent: 0, failed: -1 });
        } else {
          results.push({ channel, sent: data?.sent || 0, failed: data?.failed || 0 });
        }
      }

      const totalSent = results.reduce((s, r) => s + r.sent, 0);
      const totalFailed = results.filter(r => r.failed === -1).length;
      const summary = results.map(r => `${r.channel}: ${r.failed === -1 ? 'error' : `${r.sent} sent`}`).join(', ');

      if (totalSent > 0) {
        toast.success(`Broadcast complete — ${summary}`);
      } else if (totalFailed === results.length) {
        toast.error('All channels failed');
      } else {
        toast.info(`Broadcast sent — ${summary}`);
      }

      onOpenChange(false);
      setMessage(''); setSubject(''); setTemplateId(''); setAudience('all');
      setSelectedChannels(new Set(['whatsapp']));
    } catch (error: any) {
      toast.error(error.message || 'Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const showSubject = selectedChannels.has('email');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Broadcast Message</SheetTitle>
          <SheetDescription>Send a message to multiple members across channels</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Channel Multi-Select */}
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedChannels.size === 3}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">All Channels</span>
              </label>
              <div className="w-px h-5 bg-border" />
              {CHANNELS.map(ch => {
                const Icon = ch.icon;
                return (
                  <label key={ch.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedChannels.has(ch.value)}
                      onCheckedChange={() => toggleChannel(ch.value)}
                    />
                    <Icon className={`h-4 w-4 ${ch.color}`} />
                    <span className="text-sm">{ch.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Template Selector (only when single channel) */}
          {templateQueryType && (
            <div className="space-y-2">
              <Label>Use Template (Optional)</Label>
              <Select value={templateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a saved template..." />
                </SelectTrigger>
                <SelectContent>
                  {savedTemplates.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No templates found for {templateQueryType}
                    </div>
                  ) : (
                    savedTemplates.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Manage templates in Settings → Templates</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="active">Active Members Only</SelectItem>
                <SelectItem value="expiring">Expiring Soon (7 days)</SelectItem>
                <SelectItem value="expired">Expired Members</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showSubject && (
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line..." />
            </div>
          )}

          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enter your message..." rows={6} />
            <p className="text-xs text-muted-foreground">Use variables like {'{{member_name}}'}, {'{{member_code}}'}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Messages will be sent to each selected channel. Email requires SMTP configured in Settings → Integrations. SMS and WhatsApp require their respective API keys.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
          <Button onClick={handleBroadcast} disabled={!message.trim() || isSending}>
            {isSending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Send to {selectedChannels.size} Channel{selectedChannels.size > 1 ? 's' : ''}</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
