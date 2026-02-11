import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export function BroadcastDrawer({ open, onOpenChange, branchId, initialType = 'whatsapp', initialMessage = '' }: BroadcastDrawerProps) {
  const [broadcastData, setBroadcastData] = useState({
    type: initialType,
    message: initialMessage,
    audience: 'all',
    templateId: '',
    subject: '',
  });
  const [isSending, setIsSending] = useState(false);

  // Fetch saved templates from database
  const { data: savedTemplates = [] } = useQuery({
    queryKey: ['broadcast-templates', broadcastData.type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, content, subject')
        .eq('type', broadcastData.type)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = savedTemplates.find((t: any) => t.id === templateId);
    if (template) {
      setBroadcastData({
        ...broadcastData,
        templateId,
        message: template.content,
        subject: template.subject || '',
      });
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastData.message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!branchId) {
      toast.error('No branch selected. Please select a branch first.');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-broadcast', {
        body: {
          channel: broadcastData.type,
          message: broadcastData.message,
          audience: broadcastData.audience,
          branch_id: branchId,
          subject: broadcastData.subject || undefined,
        },
      });

      if (error) throw error;

      if (data?.sent > 0) {
        toast.success(`Broadcast sent to ${data.sent} recipient${data.sent > 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
      } else {
        toast.info(data?.message || 'No recipients found for this audience.');
      }

      onOpenChange(false);
      setBroadcastData({ type: 'whatsapp', message: '', audience: 'all', templateId: '', subject: '' });
    } catch (error: any) {
      console.error('Broadcast error:', error);
      toast.error(error.message || 'Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Broadcast Message</SheetTitle>
          <SheetDescription>Send a message to multiple members at once</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={broadcastData.type} onValueChange={(v: 'sms' | 'email' | 'whatsapp') => setBroadcastData({ ...broadcastData, type: v, templateId: '', message: '', subject: '' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-success" />
                    WhatsApp
                  </div>
                </SelectItem>
                <SelectItem value="sms">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-info" />
                    SMS
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-warning" />
                    Email
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Use Template (Optional)</Label>
            <Select value={broadcastData.templateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a saved template..." />
              </SelectTrigger>
              <SelectContent>
                {savedTemplates.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No templates found for {broadcastData.type}
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
            <p className="text-xs text-muted-foreground">
              Manage templates in Settings → Templates
            </p>
          </div>

          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={broadcastData.audience} onValueChange={(v) => setBroadcastData({ ...broadcastData, audience: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="active">Active Members Only</SelectItem>
                <SelectItem value="expiring">Expiring Soon (7 days)</SelectItem>
                <SelectItem value="expired">Expired Members</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {broadcastData.type === 'email' && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={broadcastData.subject}
                onChange={(e) => setBroadcastData({ ...broadcastData, subject: e.target.value })}
                placeholder="Email subject line..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              value={broadcastData.message}
              onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
              placeholder="Enter your message..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Use variables like {'{{member_name}}'}, {'{{member_code}}'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Email sending requires a Resend API key configured in Settings → Integrations. SMS and WhatsApp bulk sending require their respective API keys. Without API keys, messages will be logged but not delivered externally.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
          <Button onClick={handleBroadcast} disabled={!broadcastData.message.trim() || isSending}>
            {isSending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Send Broadcast</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
